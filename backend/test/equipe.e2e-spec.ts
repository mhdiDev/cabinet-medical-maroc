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
});
