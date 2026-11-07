import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaSansFiltre } from '../prisma/prisma.service';
import { genererMotDePasse } from '../auth/generer-mot-de-passe';
import { CreateCabinetDto, UpdateCabinetDto } from './dto/cabinet.dto';

// Le SUPER_ADMIN n'a pas de cabinet : ce service lit sans filtre, mais uniquement
// les cabinets, les comptes, les sessions et l'écriture de l'audit (garde-fou dans
// prisma-sans-filtre.spec.ts). Le type restreint fait refuser les autres modèles à TypeScript.
type ClientPlateforme = Pick<
  PrismaSansFiltre,
  'cabinet' | 'user' | 'auditLog' | 'refreshToken' | '$transaction'
>;

@Injectable()
export class PlateformeService {
  private readonly logger = new Logger(PlateformeService.name);
  private readonly prismaSansFiltre: ClientPlateforme;

  constructor(prismaSansFiltre: PrismaSansFiltre) {
    this.prismaSansFiltre = prismaSansFiltre;
  }

  async lister() {
    const cabinets = await this.prismaSansFiltre.cabinet.findMany({
      orderBy: { nom: 'asc' },
      include: {
        users: {
          where: { estTitulaire: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, prenom: true, nom: true, email: true },
        },
        _count: { select: { users: true } },
      },
    });
    return cabinets.map(({ users, _count, updatedAt: _maj, ...cabinet }) => ({
      ...cabinet,
      nbUtilisateurs: _count.users,
      titulaire: users[0] ?? null,
    }));
  }

  async creer(superAdminId: string, dto: CreateCabinetDto) {
    const { titulaire, ...infos } = dto;
    const existant = await this.prismaSansFiltre.user.findUnique({
      where: { email: titulaire.email },
    });
    if (existant) throw new ConflictException('Email déjà utilisé');

    const motDePasseInitial = genererMotDePasse();
    const hash = await argon2.hash(motDePasseInitial);

    const resultat = await this.prismaSansFiltre
      .$transaction(async (tx) => {
        const cabinet = await tx.cabinet.create({ data: infos });
        const compte = await tx.user.create({
          data: {
            ...titulaire,
            cabinetId: cabinet.id,
            role: Role.MEDECIN,
            estTitulaire: true,
            doitChangerMdp: true,
            motDePasse: hash,
          },
          select: { id: true, email: true, nom: true, prenom: true },
        });
        return { cabinet, titulaire: compte };
      })
      .catch((e) => {
        // Deux créations simultanées : la contrainte unique l'emporte sur le pré-contrôle
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Email déjà utilisé');
        }
        throw e;
      });

    await this.auditer(superAdminId, 'CREATE_CABINET', 'Cabinet', resultat.cabinet.id);
    // Renvoyé une seule fois : seul le hash est stocké
    return { ...resultat, motDePasseInitial };
  }

  async modifier(superAdminId: string, id: string, dto: UpdateCabinetDto) {
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, valeur]) => valeur !== undefined),
    ) as UpdateCabinetDto;
    if (Object.keys(data).length === 0) throw new BadRequestException('Aucune modification');
    await this.trouver(id);
    const cabinet = await this.prismaSansFiltre.cabinet.update({ where: { id }, data });
    await this.auditer(superAdminId, 'UPDATE_CABINET', 'Cabinet', id, data);
    return cabinet;
  }

  async changerStatut(superAdminId: string, id: string, actif: boolean) {
    const actuel = await this.trouver(id);
    if (actuel.actif === actif) return actuel;

    const [cabinet] = await this.prismaSansFiltre.$transaction([
      this.prismaSansFiltre.cabinet.update({ where: { id }, data: { actif } }),
      // Suspension : toutes les sessions du cabinet sont fermées
      ...(actif
        ? []
        : [this.prismaSansFiltre.refreshToken.deleteMany({ where: { user: { cabinetId: id } } })]),
    ]);
    await this.auditer(
      superAdminId,
      actif ? 'REACTIVATE_CABINET' : 'SUSPEND_CABINET',
      'Cabinet',
      id,
    );
    return cabinet;
  }

  async reinitialiserTitulaire(superAdminId: string, id: string) {
    await this.trouver(id);
    const titulaire = await this.prismaSansFiltre.user.findFirst({
      where: { cabinetId: id, estTitulaire: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!titulaire) throw new NotFoundException('Aucun titulaire pour ce cabinet');
    if (!titulaire.actif) {
      throw new ConflictException(
        'Le compte du titulaire est désactivé : réactivez-le avant de réinitialiser son mot de passe.',
      );
    }

    const motDePasseTemporaire = genererMotDePasse();
    await this.prismaSansFiltre.$transaction([
      this.prismaSansFiltre.user.update({
        where: { id: titulaire.id },
        data: { motDePasse: await argon2.hash(motDePasseTemporaire), doitChangerMdp: true },
      }),
      this.prismaSansFiltre.refreshToken.deleteMany({ where: { userId: titulaire.id } }),
    ]);
    await this.auditer(superAdminId, 'RESET_PASSWORD', 'User', titulaire.id);
    return { motDePasseTemporaire };
  }

  private async trouver(id: string) {
    const cabinet = await this.prismaSansFiltre.cabinet.findUnique({ where: { id } });
    if (!cabinet) throw new NotFoundException('Cabinet introuvable');
    return cabinet;
  }

  // Actions de la plateforme : sans cabinet. Ne jamais y mettre de mot de passe.
  private async auditer(
    userId: string,
    action: string,
    entite: string,
    entiteId: string,
    details?: object,
  ) {
    try {
      await this.prismaSansFiltre.auditLog.create({
        data: {
          userId,
          action,
          entite,
          entiteId,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Audit ${action} non enregistré : ${(err as Error).message}`);
    }
  }
}
