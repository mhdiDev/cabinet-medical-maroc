import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaSansFiltre, PrismaService } from '../src/prisma/prisma.service';
import { MinioService } from '../src/documents/minio.service';
import { createApp, login, resetDb, seedCabinet } from './helpers';

const MDP = 'Medecin123!';

// Crée un cabinet complet : les identifiants commencent par le préfixe (a- ou b-)
async function creerCabinet(prisma: PrismaSansFiltre, p: string) {
  const cabinetId = await seedCabinet(prisma, `${p}-cabinet`);
  const motDePasse = await argon2.hash(MDP);

  await prisma.user.create({
    data: {
      id: `${p}-titulaire`,
      email: `${p}.titulaire@cabinet.ma`,
      motDePasse,
      nom: 'Titulaire',
      prenom: p,
      role: Role.MEDECIN,
      estTitulaire: true,
      cabinetId,
    },
  });
  await prisma.user.create({
    data: {
      id: `${p}-medecin`,
      email: `${p}.medecin@cabinet.ma`,
      motDePasse,
      nom: 'Medecin',
      prenom: p,
      role: Role.MEDECIN,
      cabinetId,
    },
  });
  await prisma.user.create({
    data: {
      id: `${p}-secretaire`,
      email: `${p}.secretaire@cabinet.ma`,
      motDePasse,
      nom: 'Secretaire',
      prenom: p,
      role: Role.SECRETAIRE,
      cabinetId,
    },
  });
  await prisma.patient.create({
    data: {
      id: `${p}-patient`,
      cabinetId,
      nom: `Patient-${p}`,
      prenom: 'Test',
      dateNaissance: new Date('1980-01-01'),
      sexe: 'MASCULIN',
      telephone: '0671234567',
    },
  });
  await prisma.rendezVous.create({
    data: {
      id: `${p}-rdv`,
      cabinetId,
      patientId: `${p}-patient`,
      medecinId: `${p}-titulaire`,
      dateHeure: new Date(),
    },
  });
  await prisma.consultation.create({
    data: {
      id: `${p}-consult`,
      cabinetId,
      patientId: `${p}-patient`,
      medecinId: `${p}-titulaire`,
      motif: `Motif-${p}`,
    },
  });
  await prisma.ordonnance.create({
    data: {
      id: `${p}-ord`,
      cabinetId,
      patientId: `${p}-patient`,
      medecinNom: `Dr-${p}`,
      contenu: [],
    },
  });
  await prisma.paiement.create({
    data: { id: `${p}-paiement`, cabinetId, patientId: `${p}-patient`, montant: 100 },
  });
  await prisma.stockArticle.create({
    data: {
      id: `${p}-article`,
      cabinetId,
      nom: `Article-${p}`,
      reference: 'REF-COMMUNE',
      quantite: 0,
      seuilAlerte: 5,
    },
  });
  await prisma.document.create({
    data: {
      id: `${p}-doc`,
      cabinetId,
      patientId: `${p}-patient`,
      nom: `doc-${p}.pdf`,
      type: 'application/pdf',
      url: `http://minio/${p}.pdf`,
    },
  });
  await prisma.notification.create({
    data: { id: `${p}-notif`, cabinetId, userId: `${p}-secretaire`, message: `Notif-${p}` },
  });
}

describe('Isolation entre cabinets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let tokenA: string;
  let tokenSecA: string;
  let tokenMedecinA: string;

  const get = (url: string, token = tokenA) =>
    request(app.getHttpServer()).get(`/api${url}`).set('Authorization', `Bearer ${token}`);
  const post = (url: string, body: object, token = tokenA) =>
    request(app.getHttpServer()).post(`/api${url}`).set('Authorization', `Bearer ${token}`).send(body);
  const patch = (url: string, body: object, token = tokenA) =>
    request(app.getHttpServer()).patch(`/api${url}`).set('Authorization', `Bearer ${token}`).send(body);
  const del = (url: string, token = tokenA) =>
    request(app.getHttpServer()).delete(`/api${url}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createApp((builder) =>
      builder.overrideProvider(MinioService).useValue({
        uploadFile: async (_file: unknown, dossier: string) => `${dossier}/fichier.pdf`,
        getPublicUrl: (cle: string) => `http://minio/${cle}`,
        extractKey: (url: string) => url,
        deleteFile: async () => undefined,
        lireFichier: async () => Buffer.from('contenu-du-document'),
      }),
    );
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await creerCabinet(prisma, 'a');
    await creerCabinet(prisma, 'b');
    tokenA = (await login(app, 'a.titulaire@cabinet.ma', MDP)).accessToken;
    tokenSecA = (await login(app, 'a.secretaire@cabinet.ma', MDP)).accessToken;
    tokenMedecinA = (await login(app, 'a.medecin@cabinet.ma', MDP)).accessToken;
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  describe('lecture du détail', () => {
    it.each([
      '/patients/b-patient',
      '/rendez-vous/b-rdv',
      '/consultations/b-consult',
      '/ordonnances/b-ord',
      '/ordonnances/b-ord/pdf',
      '/stock/articles/b-article',
    ])('GET %s répond 404', async (url) => {
      expect((await get(url)).status).toBe(404);
    });

    it('le détail de son propre cabinet reste accessible', async () => {
      expect((await get('/patients/a-patient')).status).toBe(200);
      expect((await get('/consultations/a-consult')).status).toBe(200);
    });
  });

  describe('listes rattachées à un patient', () => {
    it.each([
      '/consultations/patient/b-patient',
      '/ordonnances/patient/b-patient',
      '/documents/patient/b-patient',
    ])('GET %s est vide', async (url) => {
      const res = await get(url);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('modification et suppression', () => {
    it.each([
      ['/patients/b-patient', { ville: 'Fes' }],
      ['/rendez-vous/b-rdv', { motif: 'pirate' }],
      ['/rendez-vous/b-rdv/statut', { statut: 'ANNULE' }],
      ['/consultations/b-consult', { motif: 'pirate' }],
    ])('PATCH %s répond 404', async (url, body) => {
      expect((await patch(url, body)).status).toBe(404);
    });

    it.each(['/patients/b-patient', '/rendez-vous/b-rdv', '/documents/b-doc'])(
      'DELETE %s répond 404',
      async (url) => {
        expect((await del(url)).status).toBe(404);
      },
    );

    it('les données de B sont intactes', async () => {
      expect((await prisma.patient.findUnique({ where: { id: 'b-patient' } }))?.actif).toBe(true);
      expect((await prisma.consultation.findUnique({ where: { id: 'b-consult' } }))?.motif).toBe(
        'Motif-b',
      );
      expect(await prisma.document.findUnique({ where: { id: 'b-doc' } })).not.toBeNull();
    });
  });

  describe('listes, exports et tableaux de bord', () => {
    it.each([
      '/patients',
      '/patients/export/csv',
      '/consultations',
      '/ordonnances',
      '/paiements/caisse',
      '/paiements/rapport?debut=2000-01-01&fin=2099-12-31',
      '/stock/articles',
      '/stock/articles/alertes',
    ])('GET %s ne contient rien de B', async (url) => {
      const res = await get(url);
      expect(res.status).toBe(200);
      const contenu = res.text;
      expect(contenu).not.toContain('b-patient');
      expect(contenu).not.toContain('Patient-b');
      expect(contenu).not.toContain('b-consult');
      expect(contenu).not.toContain('b-ord');
      expect(contenu).not.toContain('b-paiement');
      expect(contenu).not.toContain('Article-b');
    });

    it("l'export Excel des paiements ne contient rien de B", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/paiements/export?debut=2000-01-01&fin=2099-12-31')
        .set('Authorization', `Bearer ${tokenA}`)
        .buffer(true)
        .parse((r, cb) => {
          const morceaux: Buffer[] = [];
          r.on('data', (c: Buffer) => morceaux.push(c));
          r.on('end', () => cb(null, Buffer.concat(morceaux)));
        });
      expect(res.status).toBe(200);
      const wb = XLSX.read(res.body, { type: 'buffer' });
      const texte = wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
      expect(texte).not.toContain('Patient-b');
    });

    it("l'agenda d'un médecin de B est vide", async () => {
      const res = await get(
        '/rendez-vous/agenda?medecinId=b-titulaire&debut=2000-01-01T00:00:00.000Z&fin=2099-12-31T00:00:00.000Z',
      );
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('les rendez-vous du jour ne contiennent rien de B', async () => {
      const res = await get('/rendez-vous/today?medecinId=b-titulaire');
      expect(res.status).toBe(200);
      expect(res.text).not.toContain('b-rdv');
    });

    it('marquer lue une notification de B ne la modifie pas', async () => {
      await patch('/notifications/b-notif/lue', {}, tokenSecA);
      expect((await prisma.notification.findUnique({ where: { id: 'b-notif' } }))?.lu).toBe(false);
    });

    it('un refresh token donne un accès qui reste dans le cabinet', async () => {
      const { refreshToken } = await login(app, 'a.titulaire@cabinet.ma', MDP);
      const res = await request(app.getHttpServer()).post('/api/auth/refresh').send({ refreshToken });
      expect(res.status).toBeLessThan(300);
      const liste = await get('/patients', res.body.accessToken);
      expect(liste.status).toBe(200);
      expect(liste.text).toContain('Patient-a');
      expect(liste.text).not.toContain('Patient-b');
    });

    it('les statistiques ne comptent que le cabinet', async () => {
      expect((await get('/patients/stats')).body.total).toBe(1);
      const dashboard = await get('/rapports/dashboard');
      expect(dashboard.body.totalPatients).toBe(1);
      expect(dashboard.body.stockAlertes).toBe(1);
    });

    it('les notifications ne viennent que du cabinet', async () => {
      const res = await get('/notifications', tokenSecA);
      expect(res.body.map((n: { id: string }) => n.id)).toEqual(['a-notif']);
    });
  });

  describe('comptes', () => {
    it('GET /auth/users ne liste que le cabinet', async () => {
      const res = await get('/auth/users');
      expect(res.status).toBe(200);
      expect(res.body.map((u: { id: string }) => u.id).sort()).toEqual([
        'a-medecin',
        'a-secretaire',
        'a-titulaire',
      ]);
    });

    it("réinitialiser un compte d'un autre cabinet répond 404", async () => {
      expect((await post('/auth/users/b-secretaire/reset-password', {})).status).toBe(404);
    });

    it('un nouveau compte rejoint le cabinet du titulaire', async () => {
      const res = await post('/auth/users', {
        email: 'nouveau@cabinet.ma',
        nom: 'Nouveau',
        prenom: 'Compte',
        role: 'SECRETAIRE',
      });
      expect(res.status).toBe(201);
      const cree = await prisma.user.findUnique({ where: { email: 'nouveau@cabinet.ma' } });
      expect(cree?.cabinetId).toBe('a-cabinet');
      expect(cree?.estTitulaire).toBe(false);
    });

    it('un email pris dans un autre cabinet répond 409', async () => {
      const res = await post('/auth/users', {
        email: 'b.medecin@cabinet.ma',
        nom: 'X',
        prenom: 'Y',
        role: 'MEDECIN',
      });
      expect(res.status).toBe(409);
    });

    it('SUPER_ADMIN et ADMIN sont refusés à la création', async () => {
      for (const role of ['SUPER_ADMIN', 'ADMIN']) {
        const res = await post('/auth/users', {
          email: 'interdit@cabinet.ma',
          nom: 'X',
          prenom: 'Y',
          role,
        });
        expect(res.status).toBe(400);
      }
    });

    it('un médecin non titulaire reçoit 403 sur la gestion des comptes', async () => {
      expect((await get('/auth/users', tokenMedecinA)).status).toBe(403);
      expect(
        (
          await post(
            '/auth/users',
            { email: 'x@cabinet.ma', nom: 'X', prenom: 'Y', role: 'MEDECIN' },
            tokenMedecinA,
          )
        ).status,
      ).toBe(403);
      expect(
        (await post('/auth/users/a-secretaire/reset-password', {}, tokenMedecinA)).status,
      ).toBe(403);
    });

    it('login et /auth/me renvoient le cabinet et le statut titulaire', async () => {
      const connexion = await login(app, 'a.titulaire@cabinet.ma', MDP);
      expect(connexion.user.cabinetId).toBe('a-cabinet');
      expect(connexion.user.estTitulaire).toBe(true);
      const moi = await get('/auth/me');
      expect(moi.body.cabinetId).toBe('a-cabinet');
      expect(moi.body.estTitulaire).toBe(true);
    });
  });

  describe('écriture', () => {
    it('une création reçoit le cabinet de la session, et le stock accepte une référence déjà prise par B', async () => {
      const res = await post('/stock/articles', { nom: 'Gants', reference: 'REF-NOUVELLE' });
      expect(res.status).toBe(201);
      expect(res.body.cabinetId).toBe('a-cabinet');

      const tokenB = (await login(app, 'b.titulaire@cabinet.ma', MDP)).accessToken;
      const memeReference = await post(
        '/stock/articles',
        { nom: 'Gants', reference: 'REF-NOUVELLE' },
        tokenB,
      );
      expect(memeReference.status).toBe(201);
      expect(memeReference.body.cabinetId).toBe('b-cabinet');
    });

    it('un cabinetId envoyé par le client répond 400', async () => {
      const res = await post('/stock/articles', { nom: 'Gants', cabinetId: 'b-cabinet' });
      expect(res.status).toBe(400);
    });

    it('un mouvement de stock reste dans une transaction filtrée', async () => {
      const res = await post('/stock/mouvements', {
        articleId: 'a-article',
        type: 'ENTREE',
        quantite: 3,
      });
      expect(res.status).toBe(201);
      expect((await prisma.stockArticle.findUnique({ where: { id: 'a-article' } }))?.quantite).toBe(3);
      await post('/stock/mouvements', { articleId: 'a-article', type: 'SORTIE', quantite: 3 });
    });

    it("l'audit porte le cabinet de la session", async () => {
      const res = await post('/patients', {
        nom: 'Audit',
        prenom: 'Test',
        dateNaissance: '1990-01-01T00:00:00.000Z',
        sexe: 'FEMININ',
        telephone: '0671234567',
      });
      expect(res.status).toBe(201);
      const log = await prisma.auditLog.findFirst({ where: { entiteId: res.body.id } });
      expect(log?.cabinetId).toBe('a-cabinet');
      await prisma.auditLog.deleteMany({ where: { entiteId: res.body.id } });
      await prisma.patient.delete({ where: { id: res.body.id } });
    });

    it('le contexte survit au téléversement multipart', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('patientId', 'a-patient')
        .attach('file', Buffer.from('%PDF-1.4'), {
          filename: 'analyse.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(201);
      expect(res.body.url).toBeUndefined();
      const doc = await prisma.document.findUnique({ where: { id: res.body.id } });
      expect(doc?.cabinetId).toBe('a-cabinet');
      expect(doc?.url).toContain('cabinets/a-cabinet/patients/a-patient/');
      await prisma.document.delete({ where: { id: res.body.id } });
    });

    it('une consultation ne prévient que les secrétaires du cabinet', async () => {
      const res = await post('/consultations', {
        patientId: 'a-patient',
        medecinId: 'a-titulaire',
        motif: 'Controle',
      });
      expect(res.status).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const notifs = await prisma.notification.findMany({
        where: { consultationId: res.body.id },
      });
      expect(notifs.length).toBeGreaterThan(0);
      expect(notifs.every((n) => n.cabinetId === 'a-cabinet')).toBe(true);
      await prisma.notification.deleteMany({ where: { consultationId: res.body.id } });
      await prisma.consultation.delete({ where: { id: res.body.id } });
    });
  });

  describe('SQL brut', () => {
    it('le client filtré refuse le SQL brut', async () => {
      const filtre = app.get(PrismaService);
      await expect(filtre.$queryRawUnsafe('SELECT 1')).rejects.toThrow('SQL brut interdit');
      await expect(filtre.$executeRawUnsafe('SELECT 1')).rejects.toThrow('SQL brut interdit');
      await expect(filtre.$queryRaw`SELECT 1`).rejects.toThrow('SQL brut interdit');
      await expect(filtre.$executeRaw`SELECT 1`).rejects.toThrow('SQL brut interdit');
    });

    it('PrismaSansFiltre garde le SQL brut pour les helpers', async () => {
      await expect(prisma.$queryRawUnsafe('SELECT 1 AS n')).resolves.toEqual([{ n: 1 }]);
    });
  });

  describe('références vers un autre cabinet', () => {
    const dateHeure = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const ordonnance = {
      medecinNom: 'Dr',
      medicaments: [{ nomLibre: 'X', posologie: '1/j' }],
    };

    it.each([
      ['/rendez-vous', { patientId: 'b-patient', medecinId: 'a-titulaire', dateHeure }],
      ['/rendez-vous', { patientId: 'a-patient', medecinId: 'b-titulaire', dateHeure }],
      ['/consultations', { patientId: 'b-patient', medecinId: 'a-titulaire' }],
      ['/consultations', { patientId: 'a-patient', medecinId: 'b-titulaire' }],
      ['/consultations', { patientId: 'a-patient', medecinId: 'a-titulaire', rendezVousId: 'b-rdv' }],
      ['/ordonnances', { ...ordonnance, patientId: 'b-patient' }],
      ['/ordonnances', { ...ordonnance, patientId: 'a-patient', consultationId: 'b-consult' }],
      ['/paiements', { patientId: 'b-patient', montant: 10, typePaiement: 'ESPECE' }],
      ['/paiements', { consultationId: 'b-consult', montant: 10, typePaiement: 'ESPECE' }],
      ['/paiements', { rendezVousId: 'b-rdv', montant: 10, typePaiement: 'ESPECE' }],
      ['/stock/mouvements', { articleId: 'b-article', type: 'ENTREE', quantite: 1 }],
      [
        '/stock/mouvements',
        { articleId: 'a-article', type: 'ENTREE', quantite: 1, consultationId: 'b-consult' },
      ],
    ])('POST %s %j répond 404', async (url, body) => {
      expect((await post(url, body)).status).toBe(404);
    });

    it.each([
      ['/rendez-vous/a-rdv', { patientId: 'b-patient' }],
      ['/rendez-vous/a-rdv', { medecinId: 'b-titulaire' }],
      ['/consultations/a-consult', { patientId: 'b-patient' }],
      ['/consultations/a-consult', { rendezVousId: 'b-rdv' }],
    ])('PATCH %s %j répond 404', async (url, body) => {
      expect((await patch(url, body)).status).toBe(404);
    });

    it('un utilisateur inactif du cabinet ne peut pas être désigné', async () => {
      await prisma.user.update({ where: { id: 'a-medecin' }, data: { actif: false } });
      try {
        const res = await post('/consultations', { patientId: 'a-patient', medecinId: 'a-medecin' });
        expect(res.status).toBe(404);
      } finally {
        await prisma.user.update({ where: { id: 'a-medecin' }, data: { actif: true } });
      }
    });

    it('une secrétaire peut encore créer un rendez-vous à son nom (agenda actuel)', async () => {
      const res = await post(
        '/rendez-vous',
        { patientId: 'a-patient', medecinId: 'a-secretaire', dateHeure },
        tokenSecA,
      );
      expect(res.status).toBe(201);
      await prisma.rendezVous.delete({ where: { id: res.body.id } });
    });

    it('PATCH /consultations/:id refuse un cabinetId', async () => {
      const res = await patch('/consultations/a-consult', { cabinetId: 'b-cabinet' });
      expect(res.status).toBe(400);
    });

    it('PATCH /consultations/:id refuse un champ inconnu', async () => {
      const res = await patch('/consultations/a-consult', { pirate: true });
      expect(res.status).toBe(400);
    });

    it('PATCH /consultations/:id accepte une modification valide', async () => {
      const res = await patch('/consultations/a-consult', { motif: 'Motif-a' });
      expect(res.status).toBe(200);
    });
  });

  describe('documents', () => {
    it('sans token répond 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/documents/a-doc/fichier');
      expect(res.status).toBe(401);
    });

    it('depuis un autre cabinet répond 404', async () => {
      expect((await get('/documents/b-doc/fichier')).status).toBe(404);
    });

    it('depuis le bon cabinet renvoie le fichier', async () => {
      const res = await get('/documents/a-doc/fichier')
        .buffer(true)
        .parse((r, fin) => {
          const morceaux: Buffer[] = [];
          r.on('data', (m: Buffer) => morceaux.push(m));
          r.on('end', () => fin(null, Buffer.concat(morceaux)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('inline');
      expect(res.body.toString()).toBe('contenu-du-document');
    });

    it("n'expose plus l'adresse de stockage", async () => {
      const liste = await get('/documents/patient/a-patient');
      expect(liste.body[0].id).toBe('a-doc');
      expect(liste.body[0].url).toBeUndefined();
      const patient = await get('/patients/a-patient');
      expect(patient.body.documents[0].url).toBeUndefined();
      const consult = await get('/consultations/a-consult');
      for (const d of consult.body.documents ?? []) expect(d.url).toBeUndefined();
    });

    it("un téléversement pour le patient d'un autre cabinet répond 404", async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('patientId', 'b-patient')
        .attach('file', Buffer.from('pdf'), { filename: 'test.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(404);
    });
  });

  describe('SUPER_ADMIN', () => {
    it('reçoit 403 sur les données des cabinets', async () => {
      await prisma.user.create({
        data: {
          id: 'super-admin',
          email: 'super@plateforme.ma',
          motDePasse: await argon2.hash(MDP),
          nom: 'Super',
          prenom: 'Admin',
          role: Role.SUPER_ADMIN,
        },
      });
      const token = (await login(app, 'super@plateforme.ma', MDP)).accessToken;
      expect((await get('/patients', token)).status).toBe(403);
      expect((await get('/patients/a-patient', token)).status).toBe(403);
      expect((await get('/rapports/dashboard', token)).status).toBe(403);
      await prisma.user.delete({ where: { id: 'super-admin' } });
    });
  });
});
