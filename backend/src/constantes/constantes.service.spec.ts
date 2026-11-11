import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConstantesService } from './constantes.service';

jest.mock('../prisma/contexte-cabinet', () => ({ cabinetCourant: () => 'cabinet-test' }));

const prisma = {
  patient: { findUnique: jest.fn() },
  consultation: { findUnique: jest.fn() },
  constantes: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
const references = { verifier: jest.fn() };
const audit = { log: jest.fn() };
const notifications = { notifierConstantesAnormales: jest.fn() };
const service = new ConstantesService(
  prisma as any,
  references as any,
  audit as any,
  notifications as any,
);

const secretaire = { id: 'sec-1', role: 'SECRETAIRE' };
const medecin = { id: 'dr-1', role: 'MEDECIN' };
const patient = { id: 'p1', prenom: 'Ahmed', nom: 'Tazi', dateNaissance: new Date('1980-01-01') };

function ligne(champs: Record<string, unknown> = {}) {
  return {
    id: 'k1',
    patientId: 'p1',
    consultationId: null,
    priseParId: 'sec-1',
    datePrise: new Date(),
    createdAt: new Date(),
    patient,
    prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
    consultation: null,
    ...champs,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.constantes.findFirst.mockResolvedValue(null);
  notifications.notifierConstantesAnormales.mockResolvedValue(undefined);
});

describe('create', () => {
  it('enregistre la prise au nom de l utilisateur connecté', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ poids: 72, taille: 170 }));
    const res = await service.create({ patientId: 'p1', poids: 72, taille: 170 }, secretaire);

    expect(references.verifier).toHaveBeenCalledWith({
      patientId: 'p1',
      consultationId: undefined,
    });
    expect(prisma.constantes.create.mock.calls[0][0].data).toMatchObject({
      patientId: 'p1',
      priseParId: 'sec-1',
      cabinetId: 'cabinet-test',
      poids: 72,
      taille: 170,
    });
    expect(res.imc).toBe(24.9);
    expect(audit.log).toHaveBeenCalledWith('sec-1', 'CREATE_CONSTANTES', 'Constantes', 'k1');
  });

  it('refuse une prise vide sans écrire', async () => {
    await expect(service.create({ patientId: 'p1' }, secretaire)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.constantes.create).not.toHaveBeenCalled();
  });

  it('refuse une consultation d un autre patient', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ patientId: 'autre' });
    await expect(
      service.create({ patientId: 'p1', consultationId: 'c1', poids: 70 }, medecin),
    ).rejects.toThrow('Cette consultation ne concerne pas ce patient');
  });

  it('consultation déjà pourvue : 400', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ patientId: 'p1' });
    prisma.constantes.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(
      service.create({ patientId: 'p1', consultationId: 'c1', poids: 70 }, medecin),
    ).rejects.toThrow('Cette consultation a déjà des constantes');
  });

  it('secrétaire + valeur anormale : le médecin est prévenu', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 39.5 }));
    await service.create({ patientId: 'p1', temperature: 39.5 }, secretaire);
    expect(notifications.notifierConstantesAnormales).toHaveBeenCalledWith(
      { id: 'p1', prenom: 'Ahmed', nom: 'Tazi' },
      [expect.objectContaining({ cle: 'temperature' })],
    );
  });

  it('médecin ou valeurs normales : aucune notification', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 39.5 }));
    await service.create({ patientId: 'p1', temperature: 39.5 }, medecin);
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 37 }));
    await service.create({ patientId: 'p1', temperature: 37 }, secretaire);
    expect(notifications.notifierConstantesAnormales).not.toHaveBeenCalled();
  });

  it('une notification en échec n empêche pas l enregistrement', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 39.5 }));
    notifications.notifierConstantesAnormales.mockRejectedValue(new Error('panne'));
    await expect(
      service.create({ patientId: 'p1', temperature: 39.5 }, secretaire),
    ).resolves.toMatchObject({ id: 'k1' });
  });

  it('IMC avec la dernière taille connue', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ poids: 72 }));
    prisma.constantes.findFirst.mockResolvedValue({
      id: 'k0',
      datePrise: new Date('2026-01-01'),
      taille: 170,
    });
    const res = await service.create({ patientId: 'p1', poids: 72 }, medecin);
    expect(res.imc).toBe(24.9);
  });
});

describe('findByPatient', () => {
  it('404 si le patient n est pas du cabinet', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);
    await expect(service.findByPatient('p-b')).rejects.toThrow(NotFoundException);
  });
  it('liste enrichie, de la plus récente à la plus ancienne', async () => {
    prisma.patient.findUnique.mockResolvedValue({ dateNaissance: patient.dateNaissance });
    prisma.constantes.findMany.mockResolvedValue([ligne({ spo2: 92 })]);
    const res = await service.findByPatient('p1');
    expect(prisma.constantes.findMany.mock.calls[0][0].orderBy).toEqual({ datePrise: 'desc' });
    expect(res[0].alertes[0].cle).toBe('spo2');
  });
});

describe('duJour', () => {
  it('prise du jour sans consultation, ou null', async () => {
    prisma.patient.findUnique.mockResolvedValue({ dateNaissance: patient.dateNaissance });
    prisma.constantes.findFirst.mockResolvedValue(null);
    await expect(service.duJour('p1')).resolves.toEqual({ prise: null });
    expect(prisma.constantes.findFirst.mock.calls[0][0].where).toMatchObject({
      patientId: 'p1',
      consultationId: null,
    });
  });
});

describe('update', () => {
  it('l auteur le lendemain : 403', async () => {
    prisma.constantes.findUnique.mockResolvedValue(
      ligne({ poids: 70, createdAt: new Date(Date.now() - 2 * 86_400_000) }),
    );
    await expect(service.update('k1', { poids: 71 }, secretaire)).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('refuse de vider la dernière valeur', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    await expect(
      service.update('k1', { poids: null as unknown as number }, medecin),
    ).rejects.toThrow('Aucune constante saisie');
  });
  it('un médecin modifie, audit avec le détail', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    prisma.constantes.update.mockResolvedValue(ligne({ poids: 71 }));
    await service.update('k1', { poids: 71 }, medecin);
    expect(prisma.constantes.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'k1' },
      data: { poids: 71 },
    });
    expect(audit.log).toHaveBeenCalledWith('dr-1', 'UPDATE_CONSTANTES', 'Constantes', 'k1', {
      poids: 71,
    });
  });
  it('prise introuvable : 404', async () => {
    prisma.constantes.findUnique.mockResolvedValue(null);
    await expect(service.update('k9', { poids: 71 }, medecin)).rejects.toThrow(NotFoundException);
  });
});

describe('remove', () => {
  it('une autre secrétaire : 403', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    await expect(service.remove('k1', { id: 'sec-2', role: 'SECRETAIRE' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.constantes.delete).not.toHaveBeenCalled();
  });
  it('un médecin supprime', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    await expect(service.remove('k1', medecin)).resolves.toEqual({ supprime: true });
    expect(audit.log).toHaveBeenCalledWith('dr-1', 'DELETE_CONSTANTES', 'Constantes', 'k1');
  });
});
