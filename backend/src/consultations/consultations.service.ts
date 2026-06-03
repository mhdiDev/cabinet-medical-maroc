import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';

@Injectable()
export class ConsultationsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

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
    const consultation = await this.prisma.consultation.create({
      data: dto,
      include: {
        patient: { select: { nom: true, prenom: true } },
        medecin: { select: { nom: true, prenom: true } },
      },
    });
    await this.audit.log(userId, 'CREATE', 'Consultation', consultation.id);
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
        documents: true,
      },
    });
    if (!c) throw new NotFoundException(`Consultation ${id} introuvable`);
    return c;
  }

  async update(id: string, dto: Partial<CreateConsultationDto>, userId: string) {
    await this.findOne(id);
    const c = await this.prisma.consultation.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'UPDATE', 'Consultation', id, dto);
    return c;
  }
}
