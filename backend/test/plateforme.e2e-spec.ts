import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import { createApp, login, resetDb, seedCabinet } from './helpers';

const MDP = 'Medecin123!';

describe('Plateforme (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let tokenSA: string;
  let tokenTitulaire: string;
  let tokenMedecin: string;
  let tokenSecretaire: string;
  let atlas: { id: string; email: string; mdp: string };

  const appel = (methode: 'get' | 'post' | 'patch', url: string, token?: string, corps?: object) => {
    const r = request(app.getHttpServer())[methode](`/api${url}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return corps ? r.send(corps) : r;
  };

  const creerCompte = async (
    id: string,
    email: string,
    role: Role,
    cabinetId: string | null,
    estTitulaire = false,
  ) =>
    prisma.user.create({
      data: {
        id,
        email,
        motDePasse: await argon2.hash(MDP),
        nom: id,
        prenom: 'Test',
        role,
        cabinetId,
        estTitulaire,
      },
    });

  const corpsCabinet = (email: string) => ({
    nom: 'Cabinet Atlas',
    adresse: '1 rue des Orangers',
    ville: 'Rabat',
    telephone: '0537000000',
    titulaire: { email, prenom: 'Amine', nom: 'Atlas' },
  });

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await seedCabinet(prisma, 'cab-existant');
    await seedCabinet(prisma, 'cab-vide');
    await creerCompte('ex-titulaire', 'ex.titulaire@cabinet.ma', Role.MEDECIN, 'cab-existant', true);
    await creerCompte('ex-medecin', 'ex.medecin@cabinet.ma', Role.MEDECIN, 'cab-existant');
    await creerCompte('ex-secretaire', 'ex.secretaire@cabinet.ma', Role.SECRETAIRE, 'cab-existant');
    await creerCompte('super-admin', 'super@plateforme.ma', Role.SUPER_ADMIN, null);
    tokenSA = (await login(app, 'super@plateforme.ma', MDP)).accessToken;
    tokenTitulaire = (await login(app, 'ex.titulaire@cabinet.ma', MDP)).accessToken;
    tokenMedecin = (await login(app, 'ex.medecin@cabinet.ma', MDP)).accessToken;
    tokenSecretaire = (await login(app, 'ex.secretaire@cabinet.ma', MDP)).accessToken;
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  describe('création', () => {
    it('crée le cabinet et son titulaire, qui se connecte et change son mot de passe', async () => {
      const res = await appel('post', '/plateforme/cabinets', tokenSA, corpsCabinet('Dr.Atlas@Cabinet.ma'));
      expect(res.status).toBe(201);
      expect(res.body.motDePasseInitial).toHaveLength(12);
      expect(res.body.titulaire.email).toBe('dr.atlas@cabinet.ma');
      expect(res.body.cabinet.ville).toBe('Rabat');

      const compte = await prisma.user.findUnique({ where: { email: 'dr.atlas@cabinet.ma' } });
      expect(compte).toMatchObject({
        role: Role.MEDECIN,
        estTitulaire: true,
        doitChangerMdp: true,
        cabinetId: res.body.cabinet.id,
      });

      const connexion = await login(app, 'dr.atlas@cabinet.ma', res.body.motDePasseInitial);
      expect(connexion.user.doitChangerMdp).toBe(true);
      const changement = await appel('post', '/auth/change-password', connexion.accessToken, {
        ancienMdp: res.body.motDePasseInitial,
        nouveauMdp: 'Atlas2026!',
      });
      expect(changement.status).toBe(201);
      const patients = await appel('get', '/patients', changement.body.accessToken);
      expect(patients.status).toBe(200);
      expect(patients.body.data).toEqual([]);

      atlas = { id: res.body.cabinet.id, email: 'dr.atlas@cabinet.ma', mdp: 'Atlas2026!' };
    });

    it('refuse un email déjà utilisé sans créer de cabinet', async () => {
      const avant = await prisma.cabinet.count();
      const res = await appel('post', '/plateforme/cabinets', tokenSA, corpsCabinet('ex.medecin@cabinet.ma'));
      expect(res.status).toBe(409);
      expect(await prisma.cabinet.count()).toBe(avant);
    });

    it.each([
      [{ telephone: '123' }],
      [{ nom: '' }],
      [{ pirate: 1 }],
      [{ titulaire: undefined }],
      [{ titulaire: { email: 'pas-un-email', prenom: 'A', nom: 'B' } }],
    ])('refuse des données invalides %j', async (modif) => {
      const res = await appel('post', '/plateforme/cabinets', tokenSA, {
        ...corpsCabinet('nouveau@cabinet.ma'),
        ...modif,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('liste', () => {
    it('affiche titulaire et nombre de comptes, sans aucune donnée patient', async () => {
      const res = await appel('get', '/plateforme/cabinets', tokenSA);
      expect(res.status).toBe(200);
      const existant = res.body.find((c: { id: string }) => c.id === 'cab-existant');
      expect(existant.titulaire).toEqual({
        id: 'ex-titulaire',
        prenom: 'Test',
        nom: 'ex-titulaire',
        email: 'ex.titulaire@cabinet.ma',
      });
      expect(existant.nbUtilisateurs).toBe(3);
      expect(Object.keys(existant).sort()).toEqual(
        ['actif', 'adresse', 'createdAt', 'id', 'nbUtilisateurs', 'nom', 'telephone', 'titulaire', 'ville'].sort(),
      );
      expect(res.body.find((c: { id: string }) => c.id === 'cab-vide').titulaire).toBeNull();
    });
  });

  describe('modification', () => {
    it('modifie les infos du cabinet', async () => {
      const res = await appel('patch', '/plateforme/cabinets/cab-existant', tokenSA, { ville: 'Fès' });
      expect(res.status).toBe(200);
      expect(res.body.ville).toBe('Fès');
    });

    it('répond 404 pour un cabinet inconnu', async () => {
      expect((await appel('patch', '/plateforme/cabinets/inconnu', tokenSA, { ville: 'X' })).status).toBe(404);
    });

    it("l'ordonnance porte la ville du cabinet", async () => {
      await prisma.patient.create({
        data: {
          id: 'ex-patient',
          cabinetId: 'cab-existant',
          nom: 'P',
          prenom: 'Q',
          dateNaissance: new Date('1980-01-01'),
          sexe: 'MASCULIN',
          telephone: '0671234567',
        },
      });
      await prisma.ordonnance.create({
        data: { id: 'ex-ord', cabinetId: 'cab-existant', patientId: 'ex-patient', medecinNom: 'Dr', contenu: [] },
      });
      const res = await appel('get', '/ordonnances/ex-ord', tokenTitulaire);
      expect(res.status).toBe(200);
      expect(res.body.cabinet).toEqual({ ville: 'Fès' });
      expect((await appel('get', '/ordonnances/ex-ord/pdf', tokenTitulaire)).status).toBe(200);
    });
  });

  describe('droits', () => {
    const routes: Array<['get' | 'post' | 'patch', string, object?]> = [
      ['get', '/plateforme/cabinets', undefined],
      ['post', '/plateforme/cabinets', corpsCabinet('x@cabinet.ma')],
      ['patch', '/plateforme/cabinets/cab-existant', { ville: 'X' }],
      ['patch', '/plateforme/cabinets/cab-existant/statut', { actif: false }],
      ['post', '/plateforme/cabinets/cab-existant/titulaire/reset-password', undefined],
    ];

    it.each(routes)('%s %s : 403 pour titulaire, médecin et secrétaire', async (methode, url, corps) => {
      for (const token of [tokenTitulaire, tokenMedecin, tokenSecretaire]) {
        expect((await appel(methode, url, token, corps)).status).toBe(403);
      }
      expect((await appel(methode, url, undefined, corps)).status).toBe(401);
    });

    it('le SUPER_ADMIN reste exclu des données des cabinets', async () => {
      expect((await appel('get', '/patients', tokenSA)).status).toBe(403);
      expect((await appel('get', '/rapports/dashboard', tokenSA)).status).toBe(403);
    });
  });

  describe('réinitialisation du titulaire', () => {
    it('donne un nouveau mot de passe et ferme les sessions du titulaire', async () => {
      const avant = await login(app, 'ex.titulaire@cabinet.ma', MDP);
      const res = await appel('post', '/plateforme/cabinets/cab-existant/titulaire/reset-password', tokenSA);
      expect(res.status).toBe(201);
      expect(res.body.motDePasseTemporaire).toHaveLength(12);

      expect((await appel('post', '/auth/login', undefined, { email: 'ex.titulaire@cabinet.ma', motDePasse: MDP })).status).toBe(401);
      const apres = await login(app, 'ex.titulaire@cabinet.ma', res.body.motDePasseTemporaire);
      expect(apres.user.doitChangerMdp).toBe(true);
      expect((await appel('post', '/auth/refresh', undefined, { refreshToken: avant.refreshToken })).status).toBe(401);
    });

    it("répond 404 pour un cabinet sans titulaire", async () => {
      const res = await appel('post', '/plateforme/cabinets/cab-vide/titulaire/reset-password', tokenSA);
      expect(res.status).toBe(404);
    });
  });

  describe('suspension', () => {
    it('bloque connexion, session et renouvellement, sans toucher les autres cabinets', async () => {
      const session = await login(app, 'ex.secretaire@cabinet.ma', MDP);

      const suspension = await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: false });
      expect(suspension.status).toBe(200);
      expect(suspension.body.actif).toBe(false);

      const connexion = await appel('post', '/auth/login', undefined, { email: 'ex.secretaire@cabinet.ma', motDePasse: MDP });
      expect(connexion.status).toBe(403);
      expect(connexion.body.code).toBe('CABINET_SUSPENDU');
      expect(connexion.body.message).toBe("Ce cabinet est suspendu. Contactez l'administrateur de la plateforme.");
      expect((await appel('get', '/patients', session.accessToken)).status).toBe(401);
      expect((await appel('post', '/auth/refresh', undefined, { refreshToken: session.refreshToken })).status).toBe(401);
      expect((await login(app, atlas.email, atlas.mdp)).accessToken).toBeDefined();

      const reactivation = await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: true });
      expect(reactivation.status).toBe(200);
      expect((await login(app, 'ex.secretaire@cabinet.ma', MDP)).accessToken).toBeDefined();
    });

    it('un état inchangé répond 200 sans effet', async () => {
      const res = await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: true });
      expect(res.status).toBe(200);
      expect(res.body.actif).toBe(true);
    });

    it('refuse un corps invalide', async () => {
      expect((await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: 'non' })).status).toBe(400);
    });
  });

  describe('comptes et audit', () => {
    it('un compte désactivé ne peut pas renouveler sa session', async () => {
      const session = await login(app, 'ex.medecin@cabinet.ma', MDP);
      await prisma.user.update({ where: { id: 'ex-medecin' }, data: { actif: false } });
      try {
        expect((await appel('post', '/auth/refresh', undefined, { refreshToken: session.refreshToken })).status).toBe(401);
      } finally {
        await prisma.user.update({ where: { id: 'ex-medecin' }, data: { actif: true } });
      }
    });

    it('chaque action de la plateforme est auditée, sans cabinet ni mot de passe', async () => {
      const logs = await prisma.auditLog.findMany({ where: { userId: 'super-admin' } });
      const actions = new Set(logs.map((l) => l.action));
      for (const action of ['CREATE_CABINET', 'UPDATE_CABINET', 'SUSPEND_CABINET', 'REACTIVATE_CABINET', 'RESET_PASSWORD']) {
        expect(actions.has(action)).toBe(true);
      }
      expect(logs.every((l) => l.cabinetId === null)).toBe(true);
      expect(JSON.stringify(logs)).not.toMatch(/motDePasse/i);
    });

    it('le SUPER_ADMIN peut changer son mot de passe', async () => {
      const res = await appel('post', '/auth/change-password', tokenSA, {
        ancienMdp: MDP,
        nouveauMdp: 'Plateforme2026!',
      });
      expect(res.status).toBe(201);
    });
  });
});
