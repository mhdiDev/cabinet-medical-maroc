// backend/src/notifications/notifications.service.spec.ts
import { Role, StatutRDV } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import type { AlerteConstante } from '../constantes/seuils';

jest.mock('../prisma/contexte-cabinet', () => ({ cabinetCourant: () => 'cabinet-test' }));

const prisma = {
  rendezVous: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { createMany: jest.fn() },
};
const service = new NotificationsService(prisma as any);
const patient = { id: 'p1', prenom: 'Ahmed', nom: 'Tazi' };
const alertes: AlerteConstante[] = [
  {
    cle: 'tension',
    sens: 'elevee',
    niveau: 'attention',
    etat: 'élevée',
    texte: 'tension 160/100 mmHg élevée',
  },
  {
    cle: 'temperature',
    sens: 'elevee',
    niveau: 'attention',
    etat: 'élevée',
    texte: 'température 39,5 °C élevée',
  },
];

beforeEach(() => jest.clearAllMocks());

describe('notifierConstantesAnormales', () => {
  it('prévient le médecin du rendez-vous du jour', async () => {
    prisma.rendezVous.findMany.mockResolvedValue([{ medecinId: 'dr-1' }, { medecinId: 'dr-1' }]);
    await service.notifierConstantesAnormales(patient, alertes);

    expect(prisma.rendezVous.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: 'p1', statut: { not: StatutRDV.ANNULE } }),
      }),
    );
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'dr-1',
          cabinetId: 'cabinet-test',
          type: 'CONSTANTES_ANORMALES',
          patientId: 'p1',
          message:
            'Constantes anormales — Ahmed Tazi : tension 160/100 mmHg élevée, température 39,5 °C élevée',
        },
      ],
    });
  });

  it('sans rendez-vous, prévient tous les médecins actifs', async () => {
    prisma.rendezVous.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([{ id: 'dr-1' }, { id: 'dr-2' }]);
    await service.notifierConstantesAnormales(patient, alertes);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.MEDECIN, actif: true },
      select: { id: true },
    });
    expect(prisma.notification.createMany.mock.calls[0][0].data.map((n: any) => n.userId)).toEqual([
      'dr-1',
      'dr-2',
    ]);
  });

  it('aucune alerte : rien', async () => {
    await service.notifierConstantesAnormales(patient, []);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
