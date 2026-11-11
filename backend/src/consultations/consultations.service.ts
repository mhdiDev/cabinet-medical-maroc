import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DOCUMENT_PUBLIC } from '../documents/document-public';
import { PrismaService } from '../prisma/prisma.service';
import { ReferencesService } from '../prisma/references.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';

@Injectable()
export class ConsultationsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private references: ReferencesService,
  ) {}

  async findAll(page = 1, limit = 20, q?: string, date?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (q) {
      where.OR = [
        { patient: { nom: { contains: q, mode: 'insensitive' as const } } },
        { patient: { prenom: { contains: q, mode: 'insensitive' as const } } },
        { diagnostic: { contains: q, mode: 'insensitive' as const } },
        { motif: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.dateConsultation = { gte: start, lte: end };
    }

    const [consultations, total] = await Promise.all([
      this.prisma.consultation.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: { select: { id: true, nom: true, prenom: true, estAssure: true } },
          medecin: { select: { nom: true, prenom: true } },
        },
        orderBy: { dateConsultation: 'desc' },
      }),
      this.prisma.consultation.count({ where }),
    ]);

    return { consultations, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async create(dto: CreateConsultationDto, userId: string) {
    const { constantesId, ...donnees } = dto;
    await this.references.verifier(donnees);
    if (constantesId) {
      const prise = await this.prisma.constantes.findUnique({
        where: { id: constantesId },
        select: { patientId: true },
      });
      if (!prise) throw new NotFoundException('Constantes introuvables');
      if (prise.patientId !== donnees.patientId) {
        throw new BadRequestException('Ces constantes concernent un autre patient');
      }
    }

    // Consultation et rattachement des constantes : tout ou rien
    const consultation = await this.prisma.$transaction(async (tx) => {
      const c = await tx.consultation.create({
        data: {
          ...donnees,
          dateConsultation: donnees.dateConsultation
            ? new Date(donnees.dateConsultation)
            : undefined,
          cabinetId: cabinetCourant(),
        },
        include: {
          patient: { select: { nom: true, prenom: true } },
          medecin: { select: { nom: true, prenom: true } },
        },
      });
      if (constantesId) {
        // consultationId: null dans le filtre : deux consultations ne prennent pas la même prise
        const { count } = await tx.constantes.updateMany({
          where: { id: constantesId, consultationId: null },
          data: { consultationId: c.id },
        });
        if (count === 0)
          throw new BadRequestException('Ces constantes sont déjà rattachées à une consultation');
      }
      return c;
    });

    await this.audit.log(userId, 'CREATE', 'Consultation', consultation.id);

    const patientNom = `${consultation.patient.prenom} ${consultation.patient.nom}`;
    this.notifications
      .notifySecretaires(consultation.patientId, patientNom, consultation.id)
      .catch(() => {});

    return consultation;
  }

  async findByPatient(patientId: string) {
    return this.prisma.consultation.findMany({
      where: { patientId },
      include: {
        medecin: { select: { nom: true, prenom: true } },
        ordonnances: true,
      },
      orderBy: { dateConsultation: 'desc' },
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: true,
        medecin: { select: { id: true, nom: true, prenom: true } },
        ordonnances: { include: { medicaments: { include: { medicament: true } } } },
        documents: { select: DOCUMENT_PUBLIC },
        constantes: { include: { prisePar: { select: { prenom: true, nom: true, role: true } } } },
      },
    });
    if (!c) throw new NotFoundException(`Consultation ${id} introuvable`);
    return c;
  }

  async update(id: string, dto: UpdateConsultationDto, userId: string) {
    await this.findOne(id);
    await this.references.verifier(dto);
    const data = dto.dateConsultation
      ? { ...dto, dateConsultation: new Date(dto.dateConsultation) }
      : dto;
    const c = await this.prisma.consultation.update({ where: { id }, data });
    await this.audit.log(userId, 'UPDATE', 'Consultation', id, dto);
    return c;
  }
}
