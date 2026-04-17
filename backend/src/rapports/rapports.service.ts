import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RapportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fin = new Date();
    fin.setHours(23, 59, 59, 999);

    const [totalPatients, rdvAujourdhui, rdvSemaine, recetteJour] = await Promise.all([
      this.prisma.patient.count({ where: { actif: true } }),
      this.prisma.rendezVous.count({
        where: { dateHeure: { gte: today, lte: fin }, statut: { not: 'ANNULE' } },
      }),
      this.prisma.rendezVous.count({
        where: {
          dateHeure: {
            gte: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
            lte: fin,
          },
          statut: { not: 'ANNULE' },
        },
      }),
      this.prisma.paiement.aggregate({
        _sum: { montant: true },
        where: { dateHeure: { gte: today, lte: fin } },
      }),
    ]);

    const stockAlertes = await this.prisma.stockArticle.findMany({
      where: { actif: true },
    });

    return {
      totalPatients,
      rdvAujourdhui,
      rdvSemaine,
      recetteJour: recetteJour._sum.montant || 0,
      stockAlertes: stockAlertes.filter((a) => a.quantite <= a.seuilAlerte).length,
    };
  }
}
