import { Injectable } from '@nestjs/common';
import { Role, StatutRDV } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { aujourdhui, bornesSemaine, compterParJour } from './semaine';

@Injectable()
export class RapportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard(user: { id: string; role: Role }) {
    // Bornes calculées dans le fuseau du cabinet (le serveur tourne en UTC)
    const jour = aujourdhui();
    const semaine = bornesSemaine();

    // Un médecin voit son activité ; la secrétaire, celle de tout le cabinet
    const filtreMedecin = user.role === Role.MEDECIN ? { medecinId: user.id } : {};

    const [totalPatients, rdvAujourdhui, rdvDeLaSemaine, recetteJour, stockAlertes] =
      await Promise.all([
        this.prisma.patient.count({ where: { actif: true } }),
        this.prisma.rendezVous.count({
          where: {
            ...filtreMedecin,
            dateHeure: { gte: jour.debut, lt: jour.fin },
            statut: { not: StatutRDV.ANNULE },
          },
        }),
        this.prisma.rendezVous.findMany({
          where: {
            ...filtreMedecin,
            dateHeure: { gte: semaine.debut, lt: semaine.fin },
            statut: { not: StatutRDV.ANNULE },
          },
          select: { dateHeure: true },
        }),
        this.prisma.paiement.aggregate({
          _sum: { montant: true },
          where: { dateHeure: { gte: jour.debut, lt: jour.fin } },
        }),
        this.prisma.stockArticle.findMany({ where: { actif: true } }),
      ]);

    return {
      totalPatients,
      rdvAujourdhui,
      // Semaine calendaire en cours (lundi → dimanche)
      rdvSemaine: rdvDeLaSemaine.length,
      rdvParJour: compterParJour(rdvDeLaSemaine.map((r) => r.dateHeure)),
      // Lundi de la semaine (AAAA-MM-JJ, heure du cabinet)
      semaineDebut: semaine.lundi,
      recetteJour: recetteJour._sum.montant || 0,
      stockAlertes: stockAlertes.filter((a) => a.quantite <= a.seuilAlerte).length,
    };
  }
}
