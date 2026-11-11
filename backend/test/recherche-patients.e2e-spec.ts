// backend/test/recherche-patients.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import { CABINET_TEST_ID, createApp, loginAdmin, resetDb, seedCabinet, seedTestUser } from './helpers';

describe('Recherche de patients (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let token: string;

  const chercher = (params: Record<string, string>) =>
    request(app.getHttpServer())
      .get('/api/patients')
      .query(params)
      .set('Authorization', `Bearer ${token}`);

  const ids = (res: request.Response) => res.body.data.map((p: { id: string }) => p.id).sort();

  async function patient(id: string, nom: string, prenom: string, telephone: string, cabinetId = CABINET_TEST_ID) {
    await prisma.patient.create({
      data: { id, cabinetId, nom, prenom, telephone, sexe: 'MASCULIN', dateNaissance: new Date('1980-01-01') },
    });
  }

  async function consultation(id: string, patientId: string, iso: string, cabinetId = CABINET_TEST_ID, medecinId = 'test-admin-id') {
    await prisma.consultation.create({
      data: { id, cabinetId, patientId, medecinId, dateConsultation: new Date(iso) },
    });
  }

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await seedTestUser(prisma);
    token = await loginAdmin(app);

    await patient('p-tazi', 'Tazi', 'Ahmed', '0612345678');
    await patient('p-alami', 'Alami', 'Sara', '0698765432');
    await patient('p-ahmed', 'Bennani', 'Ahmed', '0711223344');

    // 10/11/2026 à Casablanca (UTC+1) : de 2026-11-09T23:00Z à 2026-11-10T23:00Z
    await consultation('c-0030', 'p-tazi', '2026-11-09T23:30:00Z'); // 00:30 le 10/11
    await consultation('c-2330', 'p-alami', '2026-11-10T22:30:00Z'); // 23:30 le 10/11
    await consultation('c-tard', 'p-ahmed', '2026-11-10T23:30:00Z'); // 00:30 le 11/11
    // Ramadan (UTC+0) : 23:30 UTC le 01/03 est encore le 01/03 à Casablanca
    await consultation('c-ramadan', 'p-ahmed', '2026-03-01T23:30:00Z');

    // Un autre cabinet, avec une consultation le même jour
    const autre = await seedCabinet(prisma, 'cabinet-autre');
    await prisma.user.create({
      data: { id: 'autre-medecin', email: 'autre@cabinet.ma', motDePasse: 'x', nom: 'Autre', prenom: 'Dr', role: 'MEDECIN', cabinetId: autre },
    });
    await patient('p-autre', 'Tazi', 'Ahmed', '0612345678', autre);
    await consultation('c-autre', 'p-autre', '2026-11-10T10:00:00Z', autre, 'autre-medecin');
    // Consultations d'un autre cabinet rattachées à un patient de ce cabinet
    await consultation('c-intrus-10', 'p-tazi', '2026-11-10T12:00:00Z', autre, 'autre-medecin');
    await consultation('c-intrus-12', 'p-tazi', '2026-11-12T12:00:00Z', autre, 'autre-medecin');
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  it('nom complet dans les deux ordres', async () => {
    expect(ids(await chercher({ q: 'Ahmed Tazi' }))).toEqual(['p-tazi']);
    expect(ids(await chercher({ q: 'tazi ahmed' }))).toEqual(['p-tazi']);
  });

  it('un prénom partagé trouve les deux patients', async () => {
    expect(ids(await chercher({ q: 'ahmed' }))).toEqual(['p-ahmed', 'p-tazi']);
  });

  it('téléphone saisi avec des espaces', async () => {
    expect(ids(await chercher({ q: '06 12 34' }))).toEqual(['p-tazi']);
  });

  it('date seule : patients vus ce jour-là, heure de Casablanca (00:30 et 23:30)', async () => {
    const res = await chercher({ date: '2026-11-10' });
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(['p-alami', 'p-tazi']);
    const tazi = res.body.data.find((p: { id: string }) => p.id === 'p-tazi');
    expect(tazi.consultationsDuJour).toEqual([
      { id: 'c-0030', dateConsultation: '2026-11-09T23:30:00.000Z', medecin: { nom: 'Admin', prenom: 'Test' } },
    ]);
  });

  it('une consultation à 00:30 le lendemain est rangée le lendemain', async () => {
    expect(ids(await chercher({ date: '2026-11-11' }))).toEqual(['p-ahmed']);
  });

  it('jour de Ramadan (UTC+0)', async () => {
    expect(ids(await chercher({ date: '2026-03-01' }))).toEqual(['p-ahmed']);
    expect(ids(await chercher({ date: '2026-03-02' }))).toEqual([]);
  });

  it('nom + date se combinent', async () => {
    expect(ids(await chercher({ q: 'tazi', date: '2026-11-10' }))).toEqual(['p-tazi']);
    expect(ids(await chercher({ q: 'bennani', date: '2026-11-10' }))).toEqual([]);
  });

  it("rien de l'autre cabinet", async () => {
    const res = await chercher({ date: '2026-11-10' });
    expect(ids(res)).not.toContain('p-autre');
    expect(res.body.meta.total).toBe(2);
    expect(ids(await chercher({ q: 'tazi' }))).toEqual(['p-tazi']);
  });

  it("les consultations d'un autre cabinet rattachées à un patient du cabinet sont ignorées", async () => {
    const res = await chercher({ date: '2026-11-10' });
    const tazi = res.body.data.find((p: { id: string }) => p.id === 'p-tazi');
    expect(tazi.consultationsDuJour.map((c: { id: string }) => c.id)).toEqual(['c-0030']);
    expect(ids(await chercher({ date: '2026-11-12' }))).toEqual([]);
  });

  it('sans date, pas de consultationsDuJour', async () => {
    const res = await chercher({ q: 'tazi' });
    expect(res.body.data[0]).not.toHaveProperty('consultationsDuJour');
  });

  it.each(['2026-02-31', '10/11/2026', '2026-1-5', 'abc'])('date invalide %s → 400', async (date) => {
    expect((await chercher({ date })).status).toBe(400);
  });

  it('texte trop long → 400', async () => {
    expect((await chercher({ q: 'a'.repeat(101) })).status).toBe(400);
  });
});
