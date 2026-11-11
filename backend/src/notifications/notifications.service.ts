import { Injectable } from '@nestjs/common';
import { Role, StatutRDV } from '@prisma/client';
import { jourCabinet, journeeEnUtc } from '../common/dates/journee';
import type { AlerteConstante } from '../constantes/seuils';
import { PrismaService } from '../prisma/prisma.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async notifySecretaires(patientId: string, patientNom: string, consultationId: string) {
    const secretaires = await this.prisma.user.findMany({
      where: { role: Role.SECRETAIRE, actif: true },
      select: { id: true },
    });
    if (!secretaires.length) return;

    await this.prisma.notification.createMany({
      data: secretaires.map((s) => ({
        userId: s.id,
        cabinetId: cabinetCourant(),
        message: `Consultation terminée — ${patientNom} à encaisser`,
        type: 'ENCAISSEMENT',
        patientId,
        consultationId,
      })),
    });
  }

  /**
   * Constantes anormales saisies par la secrétaire : le médecin du rendez-vous du jour
   * est prévenu, ou à défaut tous les médecins actifs du cabinet.
   */
  async notifierConstantesAnormales(
    patient: { id: string; prenom: string; nom: string },
    alertes: AlerteConstante[],
  ) {
    if (!alertes.length) return;
    const { debut, fin } = journeeEnUtc(jourCabinet());
    const rdv = await this.prisma.rendezVous.findMany({
      where: {
        patientId: patient.id,
        dateHeure: { gte: debut, lt: fin },
        statut: { not: StatutRDV.ANNULE },
      },
      select: { medecinId: true },
    });
    let destinataires = [...new Set(rdv.map((r) => r.medecinId))];
    if (!destinataires.length) {
      const medecins = await this.prisma.user.findMany({
        where: { role: Role.MEDECIN, actif: true },
        select: { id: true },
      });
      destinataires = medecins.map((m) => m.id);
    }
    if (!destinataires.length) return;

    const message = `Constantes anormales — ${patient.prenom} ${patient.nom} : ${alertes.map((a) => a.texte).join(', ')}`;
    await this.prisma.notification.createMany({
      data: destinataires.map((userId) => ({
        userId,
        cabinetId: cabinetCourant(),
        type: 'CONSTANTES_ANORMALES',
        patientId: patient.id,
        message,
      })),
    });
  }

  async findForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: {
        patient: { select: { id: true, nom: true, prenom: true } },
      },
    });
  }

  async markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { lu: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, lu: false },
      data: { lu: true },
    });
  }
}
