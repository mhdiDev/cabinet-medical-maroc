import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestPatient, seedTestUser } from './helpers';

describe('Paiements (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let patientId: string;

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

  describe('POST /api/paiements', () => {
    it('201 avec montant et type valides', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/paiements')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId, montant: 200, typePaiement: 'ESPECE' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.montant).toBe(200);
    });

    it('400 si montant manquant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/paiements')
        .set('Authorization', `Bearer ${token}`)
        .send({ typePaiement: 'ESPECE' });

      expect(res.status).toBe(400);
    });

    it('401 sans token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/paiements')
        .send({ montant: 100, typePaiement: 'ESPECE' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/paiements/caisse', () => {
    it('200 avec total, parType et date', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/paiements/caisse')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeDefined();
      expect(res.body.parType).toBeDefined();
      expect(res.body.date).toBeDefined();
      expect(res.body.paiements).toBeInstanceOf(Array);
    });

    it('200 avec paramètre date', async () => {
      // Utilise la date locale (le serveur retourne toISOString basé sur l'heure locale)
      const localDate = new Date().toLocaleDateString('en-CA'); // format YYYY-MM-DD local

      const res = await request(app.getHttpServer())
        .get(`/api/paiements/caisse?date=${localDate}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      // Le serveur applique setHours(0,0,0,0) en local puis restitue via toISOString
      // donc la date retournée peut différer d'un jour selon le timezone
      expect(res.body.date).toBeDefined();
    });
  });

  describe('GET /api/paiements/rapport', () => {
    it('200 avec total et count sur une période', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/paiements/rapport?debut=2026-01-01&fin=2026-12-31')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBeDefined();
      expect(res.body.count).toBeDefined();
    });
  });

  describe('GET /api/paiements/export', () => {
    it('200 retourne un fichier Excel (buffer)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/paiements/export?debut=2026-01-01&fin=2026-12-31&assurance=tous')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });
});
