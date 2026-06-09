import { Test, TestingModule } from '@nestjs/testing';
import { PaiementsService } from './paiements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TypePaiement } from '@prisma/client';

const mockPrisma = {
  paiement: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('PaiementsService', () => {
  let service: PaiementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaiementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PaiementsService>(PaiementsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée un paiement et log l\'audit', async () => {
      const dto = { montant: 200, typePaiement: TypePaiement.ESPECE };
      mockPrisma.paiement.create.mockResolvedValue({ id: 'p1', ...dto });

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.paiement.create).toHaveBeenCalledWith({
        data: { ...dto, createdById: 'user-1' },
      });
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', 'CREATE', 'Paiement', 'p1', { montant: 200 });
      expect(result.id).toBe('p1');
    });
  });

  describe('caisse', () => {
    it('retourne les paiements du jour avec total et parType', async () => {
      mockPrisma.paiement.findMany.mockResolvedValue([
        { id: 'p1', montant: 150, montantRemise: 0, typePaiement: TypePaiement.ESPECE, dateHeure: new Date(), patient: null, consultation: null },
        { id: 'p2', montant: 200, montantRemise: 20, typePaiement: TypePaiement.CARTE, dateHeure: new Date(), patient: null, consultation: null },
      ]);

      const result = await service.caisse();

      expect(result.total).toBe(330);
      expect(result.parType[TypePaiement.ESPECE]).toBe(150);
      expect(result.parType[TypePaiement.CARTE]).toBe(180);
      expect(result.paiements).toHaveLength(2);
    });
  });

  describe('rapport', () => {
    it('retourne total et count sur la période', async () => {
      mockPrisma.paiement.findMany.mockResolvedValue([
        { id: 'p1', montant: 100, montantRemise: 0 },
        { id: 'p2', montant: 200, montantRemise: 50 },
      ]);

      const result = await service.rapport('2026-01-01', '2026-01-31');

      expect(result.total).toBe(250);
      expect(result.count).toBe(2);
      expect(result.debut).toBe('2026-01-01');
    });
  });

  describe('exportExcel', () => {
    it('retourne un Buffer sans erreur de type', async () => {
      mockPrisma.paiement.findMany.mockResolvedValue([]);

      const result = await service.exportExcel('2026-01-01', '2026-01-31', 'tous');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
