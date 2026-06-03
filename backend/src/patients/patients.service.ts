import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientDto } from './dto/search-patient.dto';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePatientDto, userId: string) {
    // Vérification CIN unique si fourni
    if (dto.cin) {
      const existing = await this.prisma.patient.findUnique({ where: { cin: dto.cin } });
      if (existing) throw new ConflictException(`CIN ${dto.cin} déjà enregistré`);
    }

    const patient = await this.prisma.patient.create({ data: dto });

    await this.audit.log(userId, 'CREATE', 'Patient', patient.id, {
      nom: patient.nom,
      prenom: patient.prenom,
    });

    this.logger.log(`Patient créé: ${patient.id} par user ${userId}`);
    return patient;
  }

  async findAll(dto: SearchPatientDto) {
    const { q, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {
      actif: true,
      ...(q && {
        OR: [
          { nom: { contains: q, mode: 'insensitive' } },
          { prenom: { contains: q, mode: 'insensitive' } },
          { cin: { contains: q, mode: 'insensitive' } },
          { telephone: { contains: q } },
        ],
      }),
    };

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: 'asc' },
        select: {
          id: true,
          nom: true,
          prenom: true,
          dateNaissance: true,
          sexe: true,
          cin: true,
          telephone: true,
          email: true,
          ville: true,
          groupeSanguin: true,
          createdAt: true,
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data: patients,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id, actif: true },
      include: {
        rendezVous: {
          orderBy: { dateHeure: 'desc' },
          take: 10,
          include: { medecin: { select: { nom: true, prenom: true } } },
        },
        consultations: {
          orderBy: { dateConsultation: 'desc' },
          take: 10,
          include: { medecin: { select: { nom: true, prenom: true } } },
        },
        ordonnances: { orderBy: { createdAt: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!patient) throw new NotFoundException(`Patient ${id} introuvable`);
    return patient;
  }

  async findByCin(cin: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { cin, actif: true },
    });
    if (!patient) throw new NotFoundException(`Aucun patient avec CIN: ${cin}`);
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, userId: string) {
    await this.findOne(id);

    // Normaliser les champs optionnels : chaîne vide → null (évite violation UNIQUE sur cin)
    if (dto.cin !== undefined && dto.cin?.trim() === '') dto.cin = undefined;

    // Vérification CIN unique si modification
    if (dto.cin) {
      const existing = await this.prisma.patient.findFirst({
        where: { cin: dto.cin, id: { not: id } },
      });
      if (existing) throw new ConflictException(`CIN ${dto.cin} déjà utilisé`);
    }

    const patient = await this.prisma.patient.update({ where: { id }, data: dto });

    await this.audit.log(userId, 'UPDATE', 'Patient', id, dto);
    return patient;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);

    // Suppression logique — les données médicales sont conservées
    await this.prisma.patient.update({ where: { id }, data: { actif: false } });

    await this.audit.log(userId, 'DELETE', 'Patient', id);
  }

  async exportCsv() {
    const patients = await this.prisma.patient.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
    });

    const headers = ['ID', 'Nom', 'Prénom', 'Date Naissance', 'Sexe', 'CIN', 'Téléphone', 'Email', 'Ville'];
    const rows = patients.map((p) => [
      p.id,
      p.nom,
      p.prenom,
      p.dateNaissance.toISOString().split('T')[0],
      p.sexe,
      p.cin || '',
      p.telephone,
      p.email || '',
      p.ville || '',
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    return csv;
  }

  async getStats() {
    const [total, parSexe, parVille] = await Promise.all([
      this.prisma.patient.count({ where: { actif: true } }),
      this.prisma.patient.groupBy({
        by: ['sexe'],
        where: { actif: true },
        _count: true,
      }),
      this.prisma.patient.groupBy({
        by: ['ville'],
        where: { actif: true, ville: { not: null } },
        _count: true,
        orderBy: { _count: { ville: 'desc' } },
        take: 5,
      }),
    ]);

    return { total, parSexe, parVille };
  }
}
