import { Test, TestingModule } from '@nestjs/testing';
import { ReferencesService } from '../prisma/references.service';
import { NotFoundException } from '@nestjs/common';
import { ConsultationsService } from './consultations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('../prisma/contexte-cabinet', () => ({ cabinetCourant: () => 'cabinet-test' }));

const mockPrisma: any = {
  consultation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  constantes: { findUnique: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};

const mockAudit = { log: jest.fn() };
const mockNotifications = { notifySecretaires: jest.fn().mockResolvedValue(undefined) };

describe('ConsultationsService', () => {
  let service: ConsultationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ReferencesService, useValue: { verifier: jest.fn() } },
        ConsultationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ConsultationsService>(ConsultationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée une consultation et notifie les secrétaires', async () => {
      const dto = {
        patientId: 'patient-1',
        medecinId: 'medecin-1',
        motif: 'Grippe',
      };
      const created = {
        id: 'consult-1',
        ...dto,
        patient: { nom: 'Tazi', prenom: 'Ahmed' },
        medecin: { nom: 'Benali', prenom: 'Hassan' },
      };

      mockPrisma.consultation.create.mockResolvedValue(created);
      mockNotifications.notifySecretaires.mockResolvedValue(undefined);

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.consultation.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', 'CREATE', 'Consultation', 'consult-1');
      expect(result.id).toBe('consult-1');
    });

    it('rattache la prise de constantes du patient', async () => {
      mockPrisma.constantes.findUnique.mockResolvedValue({ patientId: 'patient-1' });
      mockPrisma.constantes.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.consultation.create.mockResolvedValue({
        id: 'consult-1',
        patientId: 'patient-1',
        patient: { nom: 'Tazi', prenom: 'Ahmed' },
      });

      await service.create(
        { patientId: 'patient-1', medecinId: 'medecin-1', constantesId: 'k1' },
        'user-1',
      );

      expect(mockPrisma.consultation.create.mock.calls[0][0].data.constantesId).toBeUndefined();
      expect(mockPrisma.constantes.updateMany).toHaveBeenCalledWith({
        where: { id: 'k1', consultationId: null },
        data: { consultationId: 'consult-1' },
      });
    });

    it('refuse les constantes d un autre patient', async () => {
      mockPrisma.constantes.findUnique.mockResolvedValue({ patientId: 'autre' });
      await expect(
        service.create(
          { patientId: 'patient-1', medecinId: 'medecin-1', constantesId: 'k1' },
          'user-1',
        ),
      ).rejects.toThrow('Ces constantes concernent un autre patient');
      expect(mockPrisma.consultation.create).not.toHaveBeenCalled();
    });

    it('refuse des constantes déjà rattachées (la transaction annule la consultation)', async () => {
      mockPrisma.constantes.findUnique.mockResolvedValue({ patientId: 'patient-1' });
      mockPrisma.constantes.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.consultation.create.mockResolvedValue({
        id: 'consult-2',
        patient: { nom: 'T', prenom: 'A' },
      });
      await expect(
        service.create(
          { patientId: 'patient-1', medecinId: 'medecin-1', constantesId: 'k1' },
          'user-1',
        ),
      ).rejects.toThrow('Ces constantes sont déjà rattachées à une consultation');
    });
  });

  describe('findByPatient', () => {
    it('retourne la liste des consultations du patient', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'c1', patientId: 'patient-1', motif: 'Grippe' },
        { id: 'c2', patientId: 'patient-1', motif: 'Fièvre' },
      ]);

      const result = await service.findByPatient('patient-1');

      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'patient-1' } }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('retourne la consultation si elle existe', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        id: 'c1',
        motif: 'Grippe',
        patient: {},
        medecin: {},
        ordonnances: [],
        documents: [],
      });

      const result = await service.findOne('c1');
      expect(result.motif).toBe('Grippe');
    });

    it('lève NotFoundException si consultation inexistante', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
