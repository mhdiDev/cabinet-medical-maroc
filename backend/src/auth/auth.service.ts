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
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaSansFiltre, PrismaService } from '../prisma/prisma.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
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
    return this.prisma.user.findMany({
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        role: true,
        actif: true,
        doitChangerMdp: true,
        estTitulaire: true,
        createdAt: true,
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async resetPassword(adminId: string, userId: string) {
    if (adminId === userId) {
      throw new BadRequestException(
        'Utilisez « Mon compte » pour changer votre propre mot de passe',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

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
