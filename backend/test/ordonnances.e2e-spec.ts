import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestPatient, seedTestUser } from './helpers';

describe('Ordonnances (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let patientId: string;
  let ordonnanceId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    await seedTestUser(prisma);
    patientId = await seedTestPatient(prisma);
    token = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/ordonnances', () => {
    it('201 avec patientId et médicaments valides', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ordonnances')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          medecinNom: 'Dr Benali',
          medecinSpec: 'Médecin généraliste',
          medicaments: [
            { nomLibre: 'Paracétamol 500mg', posologie: '1 comprimé toutes les 8h', duree: '5 jours', quantite: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.medecinNom).toBe('Dr Benali');
      ordonnanceId = res.body.id;
    });

    it('401 sans token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ordonnances')
        .send({ patientId, medecinNom: 'Dr Test', medicaments: [] });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/ordonnances/patient/:id', () => {
    it('200 retourne les ordonnances du patient', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ordonnances/patient/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/ordonnances/:id', () => {
    it('200 avec ordonnance existante', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ordonnances/${ordonnanceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.medecinNom).toBe('Dr Benali');
    });

    it('404 si ordonnance inexistante', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ordonnances/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/ordonnances/:id/pdf', () => {
    it('200 retourne un buffer PDF', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ordonnances/${ordonnanceId}/pdf`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });
});
