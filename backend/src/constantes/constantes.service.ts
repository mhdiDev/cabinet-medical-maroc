import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReferencesService } from '../prisma/references.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { jourCabinet, journeeEnUtc } from '../common/dates/journee';
import { CreateConstantesDto } from './dto/create-constantes.dto';
import { UpdateConstantesDto } from './dto/update-constantes.dto';
import {
  enrichirPrises,
  peutModifier,
  type PriseBrute,
  type PriseEnrichie,
  valeursDe,
  verifierDatePrise,
  verifierMesures,
} from './regles';

export interface Auteur {
  id: string;
  role: Role | string;
}

const INCLURE = {
  prisePar: { select: { id: true, prenom: true, nom: true, role: true } },
  patient: { select: { id: true, prenom: true, nom: true, dateNaissance: true } },
  consultation: { select: { id: true, dateConsultation: true } },
} as const;

type Ligne = PriseBrute & {
  patientId: string;
  priseParId: string;
  createdAt: Date;
  patient: { id: string; prenom: string; nom: string; dateNaissance: Date };
};

@Injectable()
export class ConstantesService {
  private readonly logger = new Logger(ConstantesService.name);

  constructor(
    private prisma: PrismaService,
    private references: ReferencesService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateConstantesDto, auteur: Auteur) {
    const { patientId, consultationId, datePrise, ...mesures } = dto;
    verifierMesures(mesures);
    verifierDatePrise(datePrise);
    await this.references.verifier({ patientId, consultationId });
    if (consultationId) {
      const c = await this.prisma.consultation.findUnique({
        where: { id: consultationId },
        select: { patientId: true },
      });
      if (c?.patientId !== patientId)
        throw new BadRequestException('Cette consultation ne concerne pas ce patient');
    }

    let prise: Ligne;
    try {
      prise = await this.prisma.constantes.create({
        data: {
          ...mesures,
          patientId,
          consultationId,
          datePrise: datePrise ? new Date(datePrise) : undefined,
          priseParId: auteur.id,
          cabinetId: cabinetCourant(),
        },
        include: INCLURE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Cette consultation a déjà des constantes');
      }
      throw err;
    }

    await this.audit.log(auteur.id, 'CREATE_CONSTANTES', 'Constantes', prise.id);
    const enrichie = await this.enrichir(prise);
    await this.signaler(enrichie, auteur);
    return enrichie;
  }

  async findByPatient(patientId: string) {
    const patient = await this.patientOu404(patientId);
    const prises = await this.prisma.constantes.findMany({
      where: { patientId },
      include: INCLURE,
      orderBy: { datePrise: 'desc' },
    });
    return enrichirPrises(prises, patient.dateNaissance);
  }

  /** Dernière prise du jour (heure du cabinet) pas encore rattachée à une consultation */
  async duJour(patientId: string) {
    await this.patientOu404(patientId);
    const { debut, fin } = journeeEnUtc(jourCabinet());
    const prise = await this.prisma.constantes.findFirst({
      where: { patientId, consultationId: null, datePrise: { gte: debut, lt: fin } },
      include: INCLURE,
      orderBy: { datePrise: 'desc' },
    });
    return { prise: prise ? await this.enrichir(prise) : null };
  }

  async update(id: string, dto: UpdateConstantesDto, auteur: Auteur) {
    const prise = await this.trouver(id);
    this.exigerDroit(prise, auteur);
    const { datePrise, ...mesures } = dto;
    verifierMesures({ ...valeursDe(prise), ...mesures });
    verifierDatePrise(datePrise);

    const maj = await this.prisma.constantes.update({
      where: { id },
      data: { ...mesures, ...(datePrise ? { datePrise: new Date(datePrise) } : {}) },
      include: INCLURE,
    });
    await this.audit.log(auteur.id, 'UPDATE_CONSTANTES', 'Constantes', id, dto);
    const enrichie = await this.enrichir(maj);
    await this.signaler(enrichie, auteur);
    return enrichie;
  }

  async remove(id: string, auteur: Auteur) {
    const prise = await this.trouver(id);
    this.exigerDroit(prise, auteur);
    await this.prisma.constantes.delete({ where: { id } });
    await this.audit.log(auteur.id, 'DELETE_CONSTANTES', 'Constantes', id);
    return { supprime: true };
  }

  private async patientOu404(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { dateNaissance: true },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');
    return patient;
  }

  private async trouver(id: string): Promise<Ligne> {
    const prise = await this.prisma.constantes.findUnique({ where: { id }, include: INCLURE });
    if (!prise) throw new NotFoundException('Constantes introuvables');
    return prise;
  }

  private exigerDroit(prise: Ligne, auteur: Auteur) {
    if (!peutModifier(prise, auteur)) {
      throw new ForbiddenException(
        "Seul un médecin ou l'auteur de la prise, le jour même, peut la modifier",
      );
    }
  }

  /** IMC et alertes d'une prise ; sans taille, l'IMC reprend la dernière taille mesurée avant elle */
  private async enrichir<T extends Ligne>(prise: T): Promise<PriseEnrichie<T>> {
    const avant: PriseBrute[] = [];
    if (prise.poids != null && prise.taille == null) {
      const t = await this.prisma.constantes.findFirst({
        where: {
          patientId: prise.patientId,
          taille: { not: null },
          datePrise: { lt: prise.datePrise },
        },
        orderBy: { datePrise: 'desc' },
        select: { id: true, datePrise: true, taille: true },
      });
      if (t) avant.push(t);
    }
    const [enrichie] = enrichirPrises<PriseBrute>([prise, ...avant], prise.patient.dateNaissance);
    return enrichie as PriseEnrichie<T>;
  }

  /** Valeur anormale saisie par la secrétaire : le médecin est prévenu (sans bloquer l'enregistrement) */
  private async signaler(prise: PriseEnrichie<Ligne>, auteur: Auteur) {
    if (auteur.role !== Role.SECRETAIRE || prise.alertes.length === 0) return;
    try {
      const { id, prenom, nom } = prise.patient;
      await this.notifications.notifierConstantesAnormales({ id, prenom, nom }, prise.alertes);
    } catch (err) {
      this.logger.error(`Notification des constantes impossible : ${(err as Error).message}`);
    }
  }
}
