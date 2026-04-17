import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { StatutRDV } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRendezVousDto } from './dto/create-rendez-vous.dto';
import { UpdateRendezVousDto } from './dto/update-rendez-vous.dto';

@Injectable()
export class RendezVousService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(dto: CreateRendezVousDto, userId: string) {
    const debut = new Date(dto.dateHeure);
    const fin = new Date(debut.getTime() + (dto.dureeMinutes || 30) * 60000);

    // Vérification collision — aucun RDV ne doit chevaucher pour ce médecin
    const collision = await this.prisma.rendezVous.findFirst({
      where: {
        medecinId: dto.medecinId,
        statut: { notIn: [StatutRDV.ANNULE] },
        AND: [
          { dateHeure: { lt: fin } },
          {
            dateHeure: {
              gt: new Date(debut.getTime() - (30 * 60000)),
            },
          },
        ],
      },
    });

    if (collision) {
      throw new ConflictException('Créneau déjà occupé pour ce médecin');
    }

    const rdv = await this.prisma.rendezVous.create({
      data: { ...dto, dateHeure: debut },
      include: {
        patient: { select: { nom: true, prenom: true, telephone: true } },
        medecin: { select: { nom: true, prenom: true } },
      },
    });

    await this.audit.log(userId, 'CREATE', 'RendezVous', rdv.id);
    return rdv;
  }

  async findByMedecin(medecinId: string, debut: string, fin: string) {
    return this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        dateHeure: { gte: new Date(debut), lte: new Date(fin) },
      },
      include: {
        patient: { select: { id: true, nom: true, prenom: true, telephone: true } },
      },
      orderBy: { dateHeure: 'asc' },
    });
  }

  async findOne(id: string) {
    const rdv = await this.prisma.rendezVous.findUnique({
      where: { id },
      include: {
        patient: true,
        medecin: { select: { id: true, nom: true, prenom: true } },
        paiements: true,
        consultation: true,
      },
    });
    if (!rdv) throw new NotFoundException(`RDV ${id} introuvable`);
    return rdv;
  }

  async updateStatut(id: string, statut: StatutRDV, userId: string) {
    await this.findOne(id);
    const rdv = await this.prisma.rendezVous.update({
      where: { id },
      data: { statut },
    });
    await this.audit.log(userId, 'UPDATE_STATUT', 'RendezVous', id, { statut });
    return rdv;
  }

  async update(id: string, dto: UpdateRendezVousDto, userId: string) {
    await this.findOne(id);
    const rdv = await this.prisma.rendezVous.update({ where: { id }, data: dto });
    await this.audit.log(userId, 'UPDATE', 'RendezVous', id, dto);
    return rdv;
  }

  async remove(id: string, userId: string) {
    await this.findOne(id);
    await this.prisma.rendezVous.update({
      where: { id },
      data: { statut: StatutRDV.ANNULE },
    });
    await this.audit.log(userId, 'CANCEL', 'RendezVous', id);
  }

  async findToday(medecinId: string) {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    const fin = new Date();
    fin.setHours(23, 59, 59, 999);

    return this.prisma.rendezVous.findMany({
      where: {
        medecinId,
        dateHeure: { gte: debut, lte: fin },
        statut: { not: StatutRDV.ANNULE },
      },
      include: {
        patient: { select: { id: true, nom: true, prenom: true, telephone: true } },
      },
      orderBy: { dateHeure: 'asc' },
    });
  }
}
