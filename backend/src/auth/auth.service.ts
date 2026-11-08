import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, StatutRDV } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaSansFiltre, PrismaService } from '../prisma/prisma.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { genererMotDePasse } from './generer-mot-de-passe';
import {
  CODE_CABINET_SUSPENDU,
  MESSAGE_CABINET_SUSPENDU,
  cabinetSuspendu,
} from './cabinet-suspendu';

// Hash vérifié quand le compte n'existe pas, pour que la réponse prenne le même temps
// qu'avec un vrai compte. Calculé une seule fois, avec les options par défaut d'argon2.hash,
// les mêmes que pour les vrais mots de passe
let hashFactice: Promise<string> | undefined;
function obtenirHashFactice(): Promise<string> {
  hashFactice ??= argon2.hash(uuidv4()).catch((e) => {
    hashFactice = undefined; // réessayé à la prochaine connexion
    throw e;
  });
  return hashFactice;
}

// Un titulaire ne gère pas un autre titulaire du cabinet depuis la page de l'équipe
function refuserAutreTitulaire(user: { id: string; estTitulaire: boolean }, titulaireId: string) {
  if (user.estTitulaire && user.id !== titulaireId) {
    throw new ForbiddenException('Ce compte ne peut pas être modifié ici');
  }
}

function selectUtilisateur() {
  return {
    id: true,
    nom: true,
    prenom: true,
    email: true,
    telephone: true,
    role: true,
    actif: true,
    doitChangerMdp: true,
    estTitulaire: true,
    createdAt: true,
    _count: {
      select: {
        rendezVous: {
          where: { dateHeure: { gte: new Date() }, statut: { not: StatutRDV.ANNULE } },
        },
      },
    },
  } satisfies Prisma.UserSelect;
}

function versUtilisateur<T extends { _count: { rendezVous: number } }>({ _count, ...u }: T) {
  return { ...u, rdvAVenir: _count.rendezVous };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private prismaSansFiltre: PrismaSansFiltre,
    private jwt: JwtService,
    private audit: AuditService,
  ) {
    // Calculé dès le démarrage : la première tentative ne doit pas être plus lente
    obtenirHashFactice().catch(() => undefined);
  }

  async validateUser(email: string, motDePasse: string) {
    // Le cabinet n'est pas encore connu à la connexion
    const user = await this.prismaSansFiltre.user.findUnique({
      where: { email },
      include: { cabinet: { select: { actif: true } } },
    });

    // Toujours vérifier un hash : sinon un compte inexistant ou inactif répondrait plus vite
    const motDePasseValide = await argon2.verify(
      user?.motDePasse ?? (await obtenirHashFactice()),
      motDePasse,
    );
    if (!user || !user.actif || !motDePasseValide) return null;

    // Vérifiée après le mot de passe : la suspension n'est révélée qu'au titulaire du compte
    if (cabinetSuspendu(user.cabinet)) {
      throw new ForbiddenException({
        code: CODE_CABINET_SUSPENDU,
        message: MESSAGE_CABINET_SUSPENDU,
      });
    }

    const { motDePasse: _, cabinet: _cabinet, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.motDePasse);
    if (!user) {
      this.logger.warn(`Tentative de connexion échouée pour: ${loginDto.email}`);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    this.logger.log(`Connexion réussie: ${user.email} (${user.role})`);
    return { user, ...tokens };
  }

  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { cabinet: { select: { actif: true } } } } },
    });

    if (!stored) {
      throw new UnauthorizedException('Token de rafraîchissement invalide ou expiré');
    }

    const { user } = stored;
    if (stored.expiresAt < new Date() || !user.actif || cabinetSuspendu(user.cabinet)) {
      await this.prisma.refreshToken.delete({ where: { token: refreshToken } });
      throw new UnauthorizedException(
        cabinetSuspendu(user.cabinet)
          ? MESSAGE_CABINET_SUSPENDU
          : 'Token de rafraîchissement invalide ou expiré',
      );
    }

    await this.prisma.refreshToken.delete({ where: { token: refreshToken } });

    return this.generateTokens(user.id, user.email, user.role);
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  async createUser(adminId: string, dto: CreateUserDto) {
    // L'email est unique sur toute la plateforme, pas seulement dans le cabinet
    const existing = await this.prismaSansFiltre.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const motDePasseInitial = genererMotDePasse();
    const user = await this.prisma.user
      .create({
        data: {
          ...dto,
          cabinetId: cabinetCourant(),
          motDePasse: await argon2.hash(motDePasseInitial),
          doitChangerMdp: true,
        },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          telephone: true,
          actif: true,
          doitChangerMdp: true,
          estTitulaire: true,
          createdAt: true,
        },
      })
      .catch((e) => {
        // Deux créations simultanées : la contrainte unique l'emporte sur le pré-contrôle
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Email déjà utilisé');
        }
        throw e;
      });
    await this.audit.log(adminId, 'CREATE_USER', 'User', user.id);

    // Renvoyé une seule fois à l'admin : seul le hash est stocké
    return { user, motDePasseInitial };
  }

  async changePassword(userId: string, ancienMdp: string, nouveauMdp: string) {
    // Sans filtre : un SUPER_ADMIN n'a pas de cabinet. L'identifiant vient du token,
    // l'appelant ne modifie donc que son propre compte
    const user = await this.prismaSansFiltre.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    // 400 et non 401 : un 401 déclencherait le refresh/déconnexion côté frontend
    const valid = await argon2.verify(user.motDePasse, ancienMdp);
    if (!valid) throw new BadRequestException('Ancien mot de passe incorrect');

    if (ancienMdp === nouveauMdp) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'ancien");
    }

    const hash = await argon2.hash(nouveauMdp);
    await this.prismaSansFiltre.$transaction([
      this.prismaSansFiltre.user.update({
        where: { id: userId },
        data: { motDePasse: hash, doitChangerMdp: false },
      }),
      // Révoque toutes les sessions (une nouvelle est ouverte pour l'appelant ci-dessous)
      this.prismaSansFiltre.refreshToken.deleteMany({ where: { userId } }),
      // Sans filtre et dans la transaction : AuditService lèverait 403 pour un SUPER_ADMIN
      this.prismaSansFiltre.auditLog.create({
        data: {
          userId,
          action: 'CHANGE_PASSWORD',
          entite: 'User',
          entiteId: userId,
          cabinetId: user.cabinetId,
        },
      }),
    ]);

    return this.generateTokens(user.id, user.email, user.role);
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: selectUtilisateur(),
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    return users.map(versUtilisateur);
  }

  async modifierUser(titulaireId: string, id: string, dto: UpdateUserDto) {
    // Champs nommés : un corps [] devient un tableau dont Object.entries garderait d'autres clés
    const { nom, prenom, email, telephone } = dto;
    const champs = Object.fromEntries(
      Object.entries({ nom, prenom, email, telephone }).filter(([, v]) => v !== undefined),
    ) as UpdateUserDto;
    if (Object.keys(champs).length === 0) throw new BadRequestException('Aucune modification');

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    refuserAutreTitulaire(user, titulaireId);

    const emailChange = champs.email !== undefined && champs.email !== user.email;
    if (emailChange && id === titulaireId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre email');
    }

    const data = {
      ...champs,
      ...(champs.telephone !== undefined && { telephone: champs.telephone || null }),
    };

    const [modifie] = await this.prisma
      .$transaction([
        this.prisma.user.update({ where: { id }, data, select: selectUtilisateur() }),
        // Nouvel identifiant de connexion : les sessions ouvertes avec l'ancien sont fermées
        ...(emailChange ? [this.prisma.refreshToken.deleteMany({ where: { userId: id } })] : []),
      ])
      .catch((e) => {
        // L'email est unique sur toute la plateforme : la contrainte de la base le garantit
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Email déjà utilisé');
        }
        throw e;
      });

    await this.audit.log(titulaireId, 'UPDATE_USER', 'User', id, {
      champs: Object.keys(champs),
      ...(emailChange && { email: champs.email }),
    });
    return versUtilisateur(
      modifie as Prisma.UserGetPayload<{ select: ReturnType<typeof selectUtilisateur> }>,
    );
  }

  async changerStatutUser(titulaireId: string, id: string, actif: boolean) {
    if (id === titulaireId) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    }
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUtilisateur() });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    refuserAutreTitulaire(user, titulaireId);
    if (user.actif === actif) return versUtilisateur(user);

    await this.prisma.$transaction(async (tx) => {
      // Conditionnel : parmi des demandes simultanées, une seule change l'état
      // (le client filtré ajoute le cabinet au where)
      const { count } = await tx.user.updateMany({
        where: { id, actif: !actif },
        data: { actif },
      });
      if (count !== 1) return;
      // Désactivation : les sessions ouvertes sont fermées tout de suite
      if (!actif) await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.auditLog.create({
        data: {
          userId: titulaireId,
          action: actif ? 'REACTIVATE_USER' : 'DEACTIVATE_USER',
          entite: 'User',
          entiteId: id,
          cabinetId: cabinetCourant(),
        },
      });
    });

    const modifie = await this.prisma.user.findUnique({
      where: { id },
      select: selectUtilisateur(),
    });
    if (!modifie) throw new NotFoundException('Utilisateur non trouvé');
    return versUtilisateur(modifie);
  }

  async resetPassword(adminId: string, userId: string) {
    if (adminId === userId) {
      throw new BadRequestException(
        'Utilisez « Mon compte » pour changer votre propre mot de passe',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    refuserAutreTitulaire(user, adminId);
    if (!user.actif) {
      throw new ConflictException(
        'Le compte est désactivé : réactivez-le avant de réinitialiser son mot de passe.',
      );
    }

    const motDePasseTemporaire = genererMotDePasse();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { motDePasse: await argon2.hash(motDePasseTemporaire), doitChangerMdp: true },
      }),
      // Révoque toutes les sessions
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    await this.audit.log(adminId, 'RESET_PASSWORD', 'User', userId);

    // Renvoyé une seule fois à l'admin : seul le hash est stocké
    return { motDePasseTemporaire };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwt.sign(payload);

    // Refresh token stocké en base pour invalidation possible
    const refreshToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { token: refreshToken, userId, expiresAt },
    });

    return { accessToken, refreshToken };
  }
}
