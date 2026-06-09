import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestUser } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    await seedTestUser(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/login', () => {
    it('200 avec accessToken et refreshToken si identifiants corrects', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@cabinet.ma', motDePasse: 'Admin123!' });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe('admin@cabinet.ma');
    });

    it('401 si mot de passe incorrect', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@cabinet.ma', motDePasse: 'WrongPass!' });

      expect(res.status).toBe(401);
    });

    it('401 si email inexistant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'unknown@cabinet.ma', motDePasse: 'Admin123!' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('200 avec infos user si token valide', async () => {
      const token = await loginAdmin(app);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@cabinet.ma');
      expect(res.body.motDePasse).toBeUndefined();
    });

    it('401 si pas de token', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('401 si token invalide', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer token-invalide');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('200 avec nouveau accessToken si refreshToken valide', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'admin@cabinet.ma', motDePasse: 'Admin123!' });
      const { refreshToken } = loginRes.body;

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
    });

    it('401 si refreshToken invalide', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'token-invalide' });

      expect(res.status).toBe(401);
    });
  });
});
