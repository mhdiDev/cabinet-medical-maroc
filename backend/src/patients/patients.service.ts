import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DOCUMENT_PUBLIC } from '../documents/document-public';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';
import { AuditService } from '../audit/audit.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { SearchPatientDto } from './dto/search-patient.dto';
import { journeeEnUtc } from '../common/dates/journee';
import { conditionsRecherche } from './recherche-patients';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreatePatientDto, userId: string) {
    const patient = await this.prisma.patient.create({
      data: { ...dto, dateNaissance: new Date(dto.dateNaissance), cabinetId: cabinetCourant() },
    });

    await this.audit.log(userId, 'CREATE', 'Patient', patient.id, {
      nom: patient.nom,
      prenom: patient.prenom,
    });

    this.logger.log(`Patient créé: ${patient.id} par user ${userId}`);
    return patient;
  }

  async findAll(dto: SearchPatientDto) {
    const { q, date, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const conditions = q ? conditionsRecherche(q) : [];
    const journee = date ? journeeEnUtc(date) : undefined;
    // Le client filtré ne cloisonne que le premier niveau : le cabinet est donné explicitement
    // pour la relation (filtre et sélection des consultations).
    const duJour = journee && {
      cabinetId: cabinetCourant(),
      dateConsultation: { gte: journee.debut, lt: journee.fin },
    };

    const where: Prisma.PatientWhereInput = {
      actif: true,
      ...(conditions.length > 0 && { AND: conditions }),
      ...(duJour && { consultations: { some: duJour } }),
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
          telephone: true,
          email: true,
          ville: true,
          groupeSanguin: true,
          createdAt: true,
          // Avec une date : les consultations de ce jour (heure et médecin)
          ...(duJour && {
            consultations: {
              where: duJour,
              orderBy: { dateConsultation: 'asc' as const },
              select: {
                id: true,
                dateConsultation: true,
                medecin: { select: { nom: true, prenom: true } },
              },
            },
          }),
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    const data = duJour
      ? patients.map((patient) => {
          const { consultations, ...p } = patient as typeof patient & {
            consultations: unknown[];
          };
          return { ...p, consultationsDuJour: consultations };
        })
      : patients;

    return {
      data,
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
        documents: { orderBy: { createdAt: 'desc' }, select: DOCUMENT_PUBLIC },
      },
    });

    if (!patient) throw new NotFoundException(`Patient ${id} introuvable`);
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, userId: string) {
    await this.findOne(id);

    const data = dto.dateNaissance ? { ...dto, dateNaissance: new Date(dto.dateNaissance) } : dto;
    const patient = await this.prisma.patient.update({ where: { id }, data });

    await this.audit.log(userId, 'UPDATE', 'Patient', id, dto);
    return patient;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);

    await this.prisma.patient.update({ where: { id }, data: { actif: false } });

    await this.audit.log(userId, 'DELETE', 'Patient', id);
  }

  async exportCsv() {
    const patients = await this.prisma.patient.findMany({
      where: { actif: true },
      orderBy: { nom: 'asc' },
    });

    const headers = ['ID', 'Nom', 'Prénom', 'Date Naissance', 'Sexe', 'Téléphone', 'Email', 'Ville'];
    const rows = patients.map((p) => [
      p.id,
      p.nom,
      p.prenom,
      p.dateNaissance.toISOString().split('T')[0],
      p.sexe,
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
