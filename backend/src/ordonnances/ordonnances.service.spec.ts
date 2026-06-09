import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdonnancesService } from './ordonnances.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const mockPrisma = {
  ordonnance: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('OrdonnancesService', () => {
  let service: OrdonnancesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdonnancesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<OrdonnancesService>(OrdonnancesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée une ordonnance avec ses médicaments', async () => {
      const dto = {
        patientId: 'patient-1',
        medecinNom: 'Dr Benali',
        medicaments: [{ posologie: '1cp/j', nomLibre: 'Paracétamol' }],
      };
      const created = {
        id: 'ord-1',
        patientId: 'patient-1',
        patient: { nom: 'Tazi', prenom: 'Ahmed', dateNaissance: new Date() },
        medicaments: [],
      };

      mockPrisma.ordonnance.create.mockResolvedValue(created);

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.ordonnance.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', 'CREATE', 'Ordonnance', 'ord-1');
      expect(result.id).toBe('ord-1');
    });
  });

  describe('findByPatient', () => {
    it('retourne les ordonnances du patient', async () => {
      mockPrisma.ordonnance.findMany.mockResolvedValue([
        { id: 'o1', patientId: 'patient-1' },
        { id: 'o2', patientId: 'patient-1' },
      ]);

      const result = await service.findByPatient('patient-1');

      expect(mockPrisma.ordonnance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'patient-1' } }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('lève NotFoundException si ordonnance inexistante', async () => {
      mockPrisma.ordonnance.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
