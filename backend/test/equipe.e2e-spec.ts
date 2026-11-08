import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import {
  CABINET_TEST_ID,
  createApp,
  login,
  loginAdmin,
  resetDb,
  seedCabinet,
  seedTestMedecin,
  seedTestPatient,
  seedTestSecretaire,
  seedTestUser,
} from './helpers';

const AUTRE_CABINET = 'cabinet-test-b';

describe('Équipe du cabinet (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let token: string;
  let medecinId: string;
  let secretaireId: string;
  let autreId: string;

  const server = () => app.getHttpServer();
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await seedTestUser(prisma);
    medecinId = await seedTestMedecin(prisma);
    secretaireId = await seedTestSecretaire(prisma);
    const patientId = await seedTestPatient(prisma);
    await seedCabinet(prisma, AUTRE_CABINET);
    const autre = await prisma.user.create({
      data: {
        id: 'autre-cabinet-user',
        email: 'autre@cabinet-b.ma',
        motDePasse: await argon2.hash('Autre123!'),
        nom: 'Autre',
        prenom: 'Cabinet',
        role: Role.SECRETAIRE,
        cabinetId: AUTRE_CABINET,
      },
    });
    autreId = autre.id;

    const jour = 24 * 3600 * 1000;
    const rdv = (dateHeure: Date, statut: 'CONFIRME' | 'ANNULE') =>
      prisma.rendezVous.create({
        data: { cabinetId: CABINET_TEST_ID, patientId, medecinId, dateHeure, statut },
      });
    await rdv(new Date(Date.now() + 2 * jour), 'CONFIRME');
    await rdv(new Date(Date.now() + 3 * jour), 'CONFIRME');
    await rdv(new Date(Date.now() + 4 * jour), 'ANNULE');
    await rdv(new Date(Date.now() - 2 * jour), 'CONFIRME');

    token = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/auth/users', () => {
    it('renvoie le téléphone et le nombre de rendez-vous à venir non annulés', async () => {
      const res = await request(server()).get('/api/auth/users').set(auth());
      expect(res.status).toBe(200);
      const medecin = res.body.find((u: any) => u.id === medecinId);
      const secretaire = res.body.find((u: any) => u.id === secretaireId);
      expect(medecin.rdvAVenir).toBe(2);
      expect(secretaire.rdvAVenir).toBe(0);
      expect(medecin).toHaveProperty('telephone');
      expect(medecin).not.toHaveProperty('_count');
      expect(medecin).not.toHaveProperty('motDePasse');
      expect(res.body.find((u: any) => u.id === autreId)).toBeUndefined();
    });
  });

  describe('POST /api/auth/users/:id/reset-password sur un compte désactivé', () => {
    it('409 sans rien modifier', async () => {
      await prisma.user.update({ where: { id: secretaireId }, data: { actif: false } });
      const avant = await prisma.user.findUnique({ where: { id: secretaireId } });

      const res = await request(server())
        .post(`/api/auth/users/${secretaireId}/reset-password`)
        .set(auth());

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Le compte est désactivé : réactivez-le avant de réinitialiser son mot de passe.',
      );
      const apres = await prisma.user.findUnique({ where: { id: secretaireId } });
      expect(apres!.motDePasse).toBe(avant!.motDePasse);
      expect(apres!.doitChangerMdp).toBe(avant!.doitChangerMdp);
      await prisma.user.update({ where: { id: secretaireId }, data: { actif: true } });
    });
  });

  describe('PATCH /api/auth/users/:id', () => {
    const patch = (id: string, body: object, t = token) =>
      request(server()).patch(`/api/auth/users/${id}`).set({ Authorization: `Bearer ${t}` }).send(body);

    it('modifie nom, prénom et téléphone (trim), et écrit un audit sans mot de passe', async () => {
      const res = await patch(secretaireId, { nom: '  Bennani ', prenom: 'Salma', telephone: '0611223344' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: secretaireId, nom: 'Bennani', prenom: 'Salma', telephone: '0611223344' });
      expect(res.body).toHaveProperty('rdvAVenir');
      expect(res.body).not.toHaveProperty('motDePasse');
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'UPDATE_USER', entiteId: secretaireId },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.userId).toBe('test-admin-id');
      expect(JSON.stringify(audit!.details)).not.toMatch(/motDePasse/);
    });

    it('efface le téléphone avec null ou une chaîne vide', async () => {
      expect((await patch(secretaireId, { telephone: null })).body.telephone).toBeNull();
      await patch(secretaireId, { telephone: '0611223344' });
      expect((await patch(secretaireId, { telephone: '' })).body.telephone).toBeNull();
    });

    it('nettoie les espaces autour du téléphone', async () => {
      const res = await patch(secretaireId, { telephone: ' 0611223344 ' });
      expect(res.status).toBe(200);
      expect(res.body.telephone).toBe('0611223344');
    });

    it.each([
      [{}],
      [[]],
      [{ nom: null }],
      [{ nom: 123 }],
      [{ nom: true }],
      [{ nom: {} }],
      [{ prenom: 123 }],
      [{ prenom: ['Salma'] }],
      [{ email: 123 }],
      [{ email: ['salma@cabinet.ma'] }],
      [{ telephone: 611223344 }],
      [{ telephone: ['0611223344'] }],
      [{ prenom: '   ' }],
      [{ email: null }],
      [{ email: 'pas-un-email' }],
      [{ telephone: '0123' }],
      [{ role: 'MEDECIN' }],
      [{ actif: false }],
      [{ estTitulaire: true }],
      [{ cabinetId: AUTRE_CABINET }],
    ])('400 pour %j', async (body) => {
      expect((await patch(secretaireId, body)).status).toBe(400);
    });

    it('409 si l\'email est déjà pris, y compris dans un autre cabinet', async () => {
      expect((await patch(secretaireId, { email: 'dr.test@cabinet.ma' })).status).toBe(409);
      expect((await patch(secretaireId, { email: 'AUTRE@cabinet-b.ma' })).status).toBe(409);
    });

    it('changement d\'email : normalisé, sessions coupées, même mot de passe', async () => {
      const session = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      const res = await patch(secretaireId, { email: '  Salma@Cabinet.MA ' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('salma@cabinet.ma');

      const refresh = await request(server()).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });
      expect(refresh.status).toBe(401);
      const nouvelle = await login(app, 'salma@cabinet.ma', 'Secretaire123!');
      expect(nouvelle.accessToken).toBeDefined();

      // L'ancien jeton d'accès porte l'ancien email : refusé sans attendre son expiration
      const ancien = await request(server()).get('/api/auth/me').set({ Authorization: `Bearer ${session.accessToken}` });
      expect(ancien.status).toBe(401);
      const actuel = await request(server()).get('/api/auth/me').set({ Authorization: `Bearer ${nouvelle.accessToken}` });
      expect(actuel.status).toBe(200);
      expect(actuel.body.email).toBe('salma@cabinet.ma');

      await patch(secretaireId, { email: 'secretaire@cabinet.ma' });
    });

    it('le même email ne coupe pas les sessions', async () => {
      const session = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      expect((await patch(secretaireId, { email: 'secretaire@cabinet.ma', nom: 'Alaoui' })).status).toBe(200);
      const refresh = await request(server()).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });
      expect(refresh.status).toBe(201);
    });

    it('le titulaire modifie son nom mais pas son email', async () => {
      expect((await patch('test-admin-id', { nom: 'Admin' })).status).toBe(200);
      const res = await patch('test-admin-id', { email: 'nouveau@cabinet.ma' });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Vous ne pouvez pas modifier votre propre email');
      expect((await patch('test-admin-id', { email: 'admin@cabinet.ma' })).status).toBe(200);
    });

    it('404 pour un compte d\'un autre cabinet ou inexistant', async () => {
      expect((await patch(autreId, { nom: 'Pirate' })).status).toBe(404);
      expect((await patch('inexistant', { nom: 'X' })).status).toBe(404);
      const autre = await prisma.user.findUnique({ where: { id: autreId } });
      expect(autre!.nom).toBe('Autre');
    });

    it('403 pour un médecin non titulaire et une secrétaire', async () => {
      const medecin = await login(app, 'dr.test@cabinet.ma', 'Medecin123!');
      const secretaire = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      expect((await patch(secretaireId, { nom: 'X' }, medecin.accessToken)).status).toBe(403);
      expect((await patch(medecinId, { nom: 'X' }, secretaire.accessToken)).status).toBe(403);
    });

    it('401 sans token', async () => {
      expect((await request(server()).patch(`/api/auth/users/${secretaireId}`).send({ nom: 'X' })).status).toBe(401);
    });
  });

  describe('PATCH /api/auth/users/:id/statut', () => {
    const statut = (id: string, body: object, t = token) =>
      request(server()).patch(`/api/auth/users/${id}/statut`).set({ Authorization: `Bearer ${t}` }).send(body);

    it('désactive : connexion refusée, session coupée, refresh refusé, audit', async () => {
      const session = await login(app, 'dr.test@cabinet.ma', 'Medecin123!');

      const res = await statut(medecinId, { actif: false });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: medecinId, actif: false });
      expect(res.body).not.toHaveProperty('motDePasse');

      const loginRes = await request(server()).post('/api/auth/login').send({ email: 'dr.test@cabinet.ma', motDePasse: 'Medecin123!' });
      expect(loginRes.status).toBe(401);
      const me = await request(server()).get('/api/auth/me').set({ Authorization: `Bearer ${session.accessToken}` });
      expect(me.status).toBe(401);
      const refresh = await request(server()).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });
      expect(refresh.status).toBe(401);
      expect(await prisma.refreshToken.count({ where: { userId: medecinId } })).toBe(0);

      expect(await prisma.auditLog.count({ where: { action: 'DEACTIVATE_USER', entiteId: medecinId } })).toBe(1);
      // Les rendez-vous restent
      expect(await prisma.rendezVous.count({ where: { medecinId } })).toBe(4);
    });

    it('même état : 200 sans nouvel audit', async () => {
      expect((await statut(medecinId, { actif: false })).status).toBe(200);
      expect(await prisma.auditLog.count({ where: { action: 'DEACTIVATE_USER', entiteId: medecinId } })).toBe(1);
    });

    it('réactive : connexion avec le même mot de passe, audit', async () => {
      const res = await statut(medecinId, { actif: true });
      expect(res.status).toBe(200);
      expect(res.body.actif).toBe(true);
      expect(res.body).not.toHaveProperty('motDePasse');
      expect((await login(app, 'dr.test@cabinet.ma', 'Medecin123!')).accessToken).toBeDefined();
      expect(await prisma.auditLog.count({ where: { action: 'REACTIVATE_USER', entiteId: medecinId } })).toBe(1);
    });

    it('désactivations simultanées : toutes 200, un seul audit', async () => {
      const reponses = await Promise.all(Array.from({ length: 10 }, () => statut(secretaireId, { actif: false })));
      expect(reponses.map((r) => r.status)).toEqual(Array(10).fill(200));
      reponses.forEach((r) => expect(r.body).toMatchObject({ id: secretaireId, actif: false }));
      expect(await prisma.auditLog.count({ where: { action: 'DEACTIVATE_USER', entiteId: secretaireId } })).toBe(1);

      expect((await statut(secretaireId, { actif: true })).status).toBe(200);
    });

    it('400 sur son propre compte', async () => {
      const res = await statut('test-admin-id', { actif: false });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Vous ne pouvez pas désactiver votre propre compte');
    });

    it.each([[{}], [{ actif: 'non' }], [{ actif: 'false' }], [{ actif: 0 }], [{ actif: null }]])('400 pour %j', async (body) => {
      expect((await statut(secretaireId, body)).status).toBe(400);
    });

    it('404 pour un compte d\'un autre cabinet ou inexistant', async () => {
      expect((await statut(autreId, { actif: false })).status).toBe(404);
      expect((await statut('inexistant', { actif: false })).status).toBe(404);
      expect((await prisma.user.findUnique({ where: { id: autreId } }))!.actif).toBe(true);
    });

    it('403 pour un médecin non titulaire et une secrétaire', async () => {
      const medecin = await login(app, 'dr.test@cabinet.ma', 'Medecin123!');
      const secretaire = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      expect((await statut(secretaireId, { actif: false }, medecin.accessToken)).status).toBe(403);
      expect((await statut(medecinId, { actif: false }, secretaire.accessToken)).status).toBe(403);
    });
  });

  describe('autre titulaire du cabinet', () => {
    const MESSAGE = 'Ce compte ne peut pas être modifié ici';

    it('403 sur la modification et le statut, sans rien changer', async () => {
      await prisma.user.create({
        data: {
          id: 'second-titulaire-id',
          email: 'titulaire2@cabinet.ma',
          motDePasse: await argon2.hash('Titulaire123!'),
          nom: 'Second',
          prenom: 'Titulaire',
          role: Role.MEDECIN,
          estTitulaire: true,
          cabinetId: CABINET_TEST_ID,
        },
      });
      try {
        const modif = await request(server())
          .patch('/api/auth/users/second-titulaire-id')
          .set(auth())
          .send({ nom: 'Pirate' });
        expect(modif.status).toBe(403);
        expect(modif.body.message).toBe(MESSAGE);

        const desactive = await request(server())
          .patch('/api/auth/users/second-titulaire-id/statut')
          .set(auth())
          .send({ actif: false });
        expect(desactive.status).toBe(403);
        expect(desactive.body.message).toBe(MESSAGE);

        const apres = await prisma.user.findUnique({ where: { id: 'second-titulaire-id' } });
        expect(apres).toMatchObject({ nom: 'Second', actif: true });
      } finally {
        await prisma.user.delete({ where: { id: 'second-titulaire-id' } });
      }
    });
  });
});
