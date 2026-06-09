import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
        message: `Consultation terminée — ${patientNom} à encaisser`,
        type: 'ENCAISSEMENT',
        patientId,
        consultationId,
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
