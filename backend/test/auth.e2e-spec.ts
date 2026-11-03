import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, login, loginAdmin, resetDb, seedTestSecretaire, seedTestUser } from './helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let secretaireId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    await seedTestUser(prisma);
    secretaireId = await seedTestSecretaire(prisma);
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

  describe('GET /api/auth/users', () => {
    it('200 pour l\'admin, sans motDePasse', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0].motDePasse).toBeUndefined();
      expect(res.body[0].doitChangerMdp).toBeDefined();
    });

    it('403 pour une secrétaire', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      const res = await request(app.getHttpServer())
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/auth/users/:id/reset-password — validations', () => {
    it('403 pour une secrétaire', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/test-admin-id/reset-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nouveauMdp: 'Temp1234!' });

      expect(res.status).toBe(403);
    });

    it('400 si mot de passe trop court', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post(`/api/auth/users/${secretaireId}/reset-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nouveauMdp: 'court' });

      expect(res.status).toBe(400);
    });

    it('400 si l\'admin cible son propre compte', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/test-admin-id/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ nouveauMdp: 'Temp1234!' });

      expect(res.status).toBe(400);
    });

    it('404 si utilisateur inexistant', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/inexistant/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ nouveauMdp: 'Temp1234!' });

      expect(res.status).toBe(404);
    });
  });

  describe('Scénario : réinitialisation admin puis changement forcé', () => {
    it('bloque l\'API jusqu\'au changement, puis rétablit l\'accès', async () => {
      const server = app.getHttpServer();
      const adminToken = await loginAdmin(app);

      // 1. L'admin réinitialise le mot de passe de la secrétaire
      const reset = await request(server)
        .post(`/api/auth/users/${secretaireId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nouveauMdp: 'Temp1234!' });
      expect(reset.status).toBe(201);

      // 2. Connexion avec le mot de passe temporaire
      const session = await login(app, 'secretaire@cabinet.ma', 'Temp1234!');
      expect(session.user.doitChangerMdp).toBe(true);
      const auth = { Authorization: `Bearer ${session.accessToken}` };

      // 3. API bloquée, sauf les routes autorisées
      const bloque = await request(server).get('/api/patients').set(auth);
      expect(bloque.status).toBe(403);
      expect(bloque.body.code).toBe('MUST_CHANGE_PASSWORD');

      const me = await request(server).get('/api/auth/me').set(auth);
      expect(me.status).toBe(200);

      // 3b. Le nouveau mot de passe ne peut pas être le temporaire
      const identique = await request(server)
        .post('/api/auth/change-password').set(auth)
        .send({ ancienMdp: 'Temp1234!', nouveauMdp: 'Temp1234!' });
      expect(identique.status).toBe(400);

      // 4. Changement du mot de passe → nouveaux tokens
      const change = await request(server)
        .post('/api/auth/change-password').set(auth)
        .send({ ancienMdp: 'Temp1234!', nouveauMdp: 'Secretaire456!' });
      expect(change.status).toBe(201);
      expect(change.body.accessToken).toBeDefined();
      expect(change.body.refreshToken).toBeDefined();

      // 5. Accès rétabli avec le nouveau token
      const ok = await request(server)
        .get('/api/patients')
        .set('Authorization', `Bearer ${change.body.accessToken}`);
      expect(ok.status).toBe(200);

      // 6. L'ancien refresh token est révoqué
      const refresh = await request(server)
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(refresh.status).toBe(401);
    });

    it('400 si ancien mot de passe incorrect', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire456!');
      const res = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ancienMdp: 'Faux1234!', nouveauMdp: 'Autre1234!' });

      expect(res.status).toBe(400);
    });
  });
});
