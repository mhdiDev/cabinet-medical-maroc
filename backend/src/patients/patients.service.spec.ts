import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Sexe } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  patient: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      nom: 'Tazi', prenom: 'Ahmed',
      dateNaissance: '1985-03-15',
      sexe: Sexe.MASCULIN, cin: 'AB123456', telephone: '0671234567',
    };

    it('crée un patient avec succès', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      mockPrisma.patient.create.mockResolvedValue({ id: 'uuid-1', ...dto });

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.patient.create).toHaveBeenCalledWith({ data: dto });
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', 'CREATE', 'Patient', 'uuid-1', expect.any(Object));
      expect(result).toMatchObject({ nom: 'Tazi' });
    });

    it('lève ConflictException si CIN déjà existant', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto as any, 'user-1')).rejects.toThrow(ConflictException);
      expect(mockPrisma.patient.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('retourne le patient avec ses données liées', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: 'uuid-1', nom: 'Tazi', rendezVous: [], consultations: [], ordonnances: [], documents: [],
      });

      const result = await service.findOne('uuid-1');
      expect(result.nom).toBe('Tazi');
    });

    it('lève NotFoundException si patient inexistant', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportCsv', () => {
    it('génère un CSV valide', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([
        {
          id: '1', nom: 'Tazi', prenom: 'Ahmed',
          dateNaissance: new Date('1985-03-15'),
          sexe: 'MASCULIN', cin: 'AB123456',
          telephone: '0671234567', email: '', ville: 'Casablanca',
        },
      ]);

      const csv = await service.exportCsv();
      expect(csv).toContain('Nom');
      expect(csv).toContain('Tazi');
      expect(csv).toContain('AB123456');
    });
  });
});
