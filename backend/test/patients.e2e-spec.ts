import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestUser } from './helpers';

const validPatient = {
  nom: 'Tazi',
  prenom: 'Ahmed',
  dateNaissance: '1985-03-15T00:00:00.000Z',
  sexe: 'MASCULIN',
  telephone: '0671234567',
};

describe('Patients (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let patientId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    await seedTestUser(prisma);
    token = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/patients', () => {
    it('201 avec body valide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .send(validPatient);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.nom).toBe('Tazi');
      patientId = res.body.id;
    });

    it('400 si champs obligatoires manquants', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({ nom: 'Tazi' });

      expect(res.status).toBe(400);
    });

    it('400 si téléphone invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validPatient, telephone: '0123456789' });

      expect(res.status).toBe(400);
    });

    it('401 sans token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/patients')
        .send(validPatient);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/patients', () => {
    it('200 avec liste paginée', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/patients')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.meta).toMatchObject({ total: expect.any(Number) });
    });

    it('200 avec filtre de recherche', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/patients?q=Tazi')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((p: any) => p.nom === 'Tazi')).toBe(true);
    });
  });

  describe('GET /api/patients/:id', () => {
    it('200 avec patient existant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.nom).toBe('Tazi');
    });

    it('404 si patient inexistant', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/patients/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/patients/:id', () => {
    it('200 mise à jour partielle', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ville: 'Casablanca' });

      expect(res.status).toBe(200);
      expect(res.body.ville).toBe('Casablanca');
    });
  });

  describe('DELETE /api/patients/:id', () => {
    it('204 suppression logique (actif=false)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });
  });
});
