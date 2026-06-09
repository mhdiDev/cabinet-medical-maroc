import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestMedecin, seedTestPatient, seedTestUser } from './helpers';

describe('Consultations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let patientId: string;
  let medecinId: string;
  let consultationId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    await seedTestUser(prisma);
    medecinId = await seedTestMedecin(prisma);
    patientId = await seedTestPatient(prisma);
    token = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/consultations', () => {
    it('201 avec patientId et medecinId valides', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          medecinId,
          motif: 'Grippe saisonnière',
          diagnostic: 'Rhinopharyngite',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.motif).toBe('Grippe saisonnière');
      consultationId = res.body.id;
    });

    it('400 si patientId manquant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({ medecinId, motif: 'Test' });

      expect(res.status).toBe(400);
    });

    it('401 sans token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/consultations')
        .send({ patientId, medecinId });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/consultations/patient/:id', () => {
    it('200 retourne les consultations du patient', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/consultations/patient/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/consultations', () => {
    it('200 avec liste paginée', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/consultations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.consultations).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });

    it('200 filtrée par date (structure valide)', async () => {
      // Utilise la date locale du serveur (timezone Africa/Casablanca UTC+1)
      const localDate = new Date().toLocaleDateString('en-CA'); // format YYYY-MM-DD

      const res = await request(app.getHttpServer())
        .get(`/api/consultations?date=${localDate}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.consultations).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });
  });

  describe('GET /api/consultations/:id', () => {
    it('200 avec consultation existante', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/consultations/${consultationId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.motif).toBe('Grippe saisonnière');
    });

    it('404 si consultation inexistante', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/consultations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
