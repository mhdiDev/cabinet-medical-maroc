import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class PaiementsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async create(dto: CreatePaiementDto, userId: string) {
    const paiement = await this.prisma.paiement.create({
      data: { ...dto, createdById: userId },
    });
    await this.audit.log(userId, 'CREATE', 'Paiement', paiement.id, { montant: dto.montant });
    return paiement;
  }

  async caisse(date?: string) {
    const jour = date ? new Date(date) : new Date();
    jour.setHours(0, 0, 0, 0);
    const fin = new Date(jour);
    fin.setHours(23, 59, 59, 999);

    const paiements = await this.prisma.paiement.findMany({
      where: { dateHeure: { gte: jour, lte: fin } },
      orderBy: { dateHeure: 'asc' },
      include: {
        patient: { select: { id: true, nom: true, prenom: true, estAssure: true, numeroAssurance: true } },
        consultation: { select: { id: true, motif: true, actes: true } },
      },
    });

    const total = paiements.reduce((s, p) => s + p.montant - p.montantRemise, 0);
    const parType = paiements.reduce((acc, p) => {
      acc[p.typePaiement] = (acc[p.typePaiement] || 0) + (p.montant - p.montantRemise);
      return acc;
    }, {} as Record<string, number>);

    return { date: jour.toISOString().split('T')[0], paiements, total, parType };
  }

  async rapport(debut: string, fin: string) {
    const paiements = await this.prisma.paiement.findMany({
      where: {
        dateHeure: { gte: new Date(debut), lte: new Date(fin + 'T23:59:59') },
      },
      orderBy: { dateHeure: 'asc' },
    });

    const total = paiements.reduce((s, p) => s + p.montant - p.montantRemise, 0);
    return { debut, fin, total, count: paiements.length, paiements };
  }

  async exportExcel(debut: string, fin: string, assurance: 'tous' | 'assures' | 'non_assures') {
    const paiements = await this.prisma.paiement.findMany({
      where: {
        dateHeure: { gte: new Date(debut), lte: new Date(fin + 'T23:59:59') },
        ...(assurance === 'assures' && { patient: { estAssure: true } }),
        ...(assurance === 'non_assures' && { patient: { estAssure: false } }),
      },
      orderBy: { dateHeure: 'asc' },
      include: {
        patient: true,
        consultation: true,
      },
    });

    const rows = paiements.map(p => ({
      'Date': p.dateHeure.toLocaleDateString('fr-MA'),
      'Patient': p.patient ? `${p.patient.nom} ${p.patient.prenom}` : '-',
      'CIN': p.patient?.cin || '-',
      'Assuré': p.patient?.estAssure ? 'Oui' : 'Non',
      'N° Assurance': p.patient?.numeroAssurance || '-',
      'Motif': p.consultation?.motif || p.description || '-',
      'Actes': p.consultation?.actes?.join(', ') || '-',
      'Montant (MAD)': p.montant,
      'Remise (MAD)': p.montantRemise,
      'Net (MAD)': p.montant - p.montantRemise,
      'Type paiement': p.typePaiement,
      'Réf. assurance': p.referenceAssurance || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consultations');

    ws['!cols'] = [
      { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 8 },
      { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    ];

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
