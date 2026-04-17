import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaiementDto } from './dto/create-paiement.dto';

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
}
