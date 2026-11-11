import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import {
  createApp,
  login,
  loginAdmin,
  resetDb,
  seedCabinet,
  seedTestPatient,
  seedTestSecretaire,
  seedTestUser,
} from './helpers';

describe('Constantes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let medecin: string;
  let secretaire: string;
  let patientId: string;
  let priseB: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await seedTestUser(prisma); // médecin titulaire admin@cabinet.ma (test-admin-id)
    await seedTestSecretaire(prisma);
    patientId = await seedTestPatient(prisma);
    medecin = await loginAdmin(app);
    secretaire = (await login(app, 'secretaire@cabinet.ma', 'Secretaire123!')).accessToken;

    // Un autre cabinet, avec une prise
    const cabinetB = await seedCabinet(prisma, 'cabinet-b');
    await prisma.user.create({
      data: {
        id: 'b-medecin',
        email: 'b.medecin@cabinet.ma',
        motDePasse: await argon2.hash('Medecin123!'),
        nom: 'B',
        prenom: 'Medecin',
        role: Role.MEDECIN,
        cabinetId: cabinetB,
      },
    });
    await prisma.patient.create({
      data: {
        id: 'b-patient',
        cabinetId: cabinetB,
        nom: 'Patient',
        prenom: 'B',
        dateNaissance: new Date('1980-01-01'),
        sexe: 'FEMININ',
        telephone: '0671234568',
      },
    });
    priseB = (
      await prisma.constantes.create({
        data: { cabinetId: cabinetB, patientId: 'b-patient', priseParId: 'b-medecin', poids: 60 },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 sans jeton', async () => {
    expect((await api().get(`/api/constantes/patient/${patientId}`)).status).toBe(401);
  });

  it('la secrétaire enregistre une fièvre : prise à son nom, alerte, médecin prévenu', async () => {
    const res = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ patientId, temperature: 39.5, poids: 72, taille: 170 });

    expect(res.status).toBe(201);
    expect(res.body.priseParId).toBe('test-secretaire-id');
    expect(res.body.imc).toBe(24.9);
    expect(res.body.alertes).toEqual([expect.objectContaining({ cle: 'temperature', etat: 'élevée' })]);

    const notifs = await prisma.notification.findMany({ where: { type: 'CONSTANTES_ANORMALES' } });
    expect(notifs.map((n) => n.userId)).toEqual(['test-admin-id']);
    expect(notifs[0].message).toBe('Constantes anormales — Ahmed Tazi : température 39,5 °C élevée');
  });

  it('400 : valeur hors bornes, en français', async () => {
    const res = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ patientId, temperature: 375 });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Température : entre 30 et 45 °C');
  });

  it('400 : tension incomplète, prise vide', async () => {
    const auth = { Authorization: `Bearer ${secretaire}` };
    expect((await api().post('/api/constantes').set(auth).send({ patientId, tensionSystolique: 120 })).status).toBe(400);
    expect((await api().post('/api/constantes').set(auth).send({ patientId })).status).toBe(400);
  });

  it('du-jour puis rattachement à la consultation', async () => {
    const duJour = await api()
      .get(`/api/constantes/patient/${patientId}/du-jour`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(duJour.status).toBe(200);
    const constantesId = duJour.body.prise.id;

    const consultation = await api()
      .post('/api/consultations')
      .set('Authorization', `Bearer ${medecin}`)
      .send({ patientId, medecinId: 'test-admin-id', motif: 'Fièvre', constantesId });
    expect(consultation.status).toBe(201);
    const ligne = await prisma.constantes.findUnique({ where: { id: constantesId } });
    expect(ligne?.consultationId).toBe(consultation.body.id);

    const encore = await api()
      .post('/api/consultations')
      .set('Authorization', `Bearer ${medecin}`)
      .send({ patientId, medecinId: 'test-admin-id', constantesId });
    expect(encore.status).toBe(400);

    const apres = await api()
      .get(`/api/constantes/patient/${patientId}/du-jour`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(apres.body).toEqual({ prise: null });

    const detail = await api()
      .get(`/api/consultations/${consultation.body.id}`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(detail.body.constantes.temperature).toBe(39.5);
  });

  it('droits : la secrétaire modifie sa prise, pas celle du médecin ; le médecin supprime', async () => {
    const sienne = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ patientId, pouls: 72 });
    const duMedecin = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${medecin}`)
      .send({ patientId, pouls: 80 });

    const ok = await api()
      .patch(`/api/constantes/${sienne.body.id}`)
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ pouls: 75 });
    expect(ok.status).toBe(200);
    expect(ok.body.pouls).toBe(75);

    const refus = await api()
      .patch(`/api/constantes/${duMedecin.body.id}`)
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ pouls: 60 });
    expect(refus.status).toBe(403);

    const suppression = await api()
      .delete(`/api/constantes/${sienne.body.id}`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(suppression.status).toBe(200);
  });

  it('liste du patient, de la plus récente à la plus ancienne', async () => {
    const res = await api()
      .get(`/api/constantes/patient/${patientId}`)
      .set('Authorization', `Bearer ${secretaire}`);
    expect(res.status).toBe(200);
    const dates = res.body.map((p: { datePrise: string }) => p.datePrise);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(res.body[0].prisePar).toEqual(expect.objectContaining({ prenom: expect.any(String), role: expect.any(String) }));
  });

  it('isolation : un autre cabinet répond 404', async () => {
    const auth = { Authorization: `Bearer ${medecin}` };
    expect((await api().get('/api/constantes/patient/b-patient').set(auth)).status).toBe(404);
    expect((await api().post('/api/constantes').set(auth).send({ patientId: 'b-patient', poids: 70 })).status).toBe(404);
    expect((await api().patch(`/api/constantes/${priseB}`).set(auth).send({ poids: 61 })).status).toBe(404);
    expect((await api().delete(`/api/constantes/${priseB}`).set(auth)).status).toBe(404);
  });
});
