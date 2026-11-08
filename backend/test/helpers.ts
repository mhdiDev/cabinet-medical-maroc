import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';

export const CABINET_TEST_ID = 'cabinet-test-a';

export async function createApp(
  configurer: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication> {
  const module = await configurer(
    Test.createTestingModule({
      imports: [AppModule],
    }),
  ).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  // Un seul port pour tout le fichier : sans serveur à l'écoute, supertest ouvre et
  // ferme un port par requête, et l'agent keep-alive de Node 20 peut réutiliser une
  // socket déjà coupée (« read ECONNRESET » au hasard)
  await app.listen(0, '127.0.0.1');
  return app;
}

export async function resetDb(prisma: PrismaSansFiltre): Promise<void> {
  const tables = [
    'ordonnance_medicaments',
    'ordonnances',
    'paiements',
    'documents',
    'consultations',
    'rendez_vous',
    'notifications',
    'audit_logs',
    'refresh_tokens',
    'stock_mouvements',
    'stock_articles',
    'parametres',
    'patients',
    'users',
    'cabinets',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

export async function seedCabinet(
  prisma: PrismaSansFiltre,
  id: string = CABINET_TEST_ID,
): Promise<string> {
  await prisma.cabinet.upsert({
    where: { id },
    update: {},
    create: { id, nom: `Cabinet ${id}`, adresse: 'Adresse', ville: 'Rabat', telephone: '0522000000' },
  });
  return id;
}

export async function seedTestUser(prisma: PrismaSansFiltre): Promise<void> {
  await seedCabinet(prisma);
  const hash = await argon2.hash('Admin123!');
  await prisma.user.create({
    data: {
      id: 'test-admin-id',
      email: 'admin@cabinet.ma',
      motDePasse: hash,
      nom: 'Admin',
      prenom: 'Test',
      role: Role.MEDECIN,
      estTitulaire: true,
      cabinetId: CABINET_TEST_ID,
    },
  });
}

export async function seedTestMedecin(prisma: PrismaSansFiltre): Promise<string> {
  await seedCabinet(prisma);
  const hash = await argon2.hash('Medecin123!');
  const user = await prisma.user.create({
    data: {
      id: 'test-medecin-id',
      email: 'dr.test@cabinet.ma',
      motDePasse: hash,
      nom: 'Benali',
      prenom: 'Hassan',
      role: Role.MEDECIN,
      cabinetId: CABINET_TEST_ID,
    },
  });
  return user.id;
}

export async function seedTestPatient(prisma: PrismaSansFiltre): Promise<string> {
  await seedCabinet(prisma);
  const patient = await prisma.patient.create({
    data: {
      id: 'test-patient-id',
      cabinetId: CABINET_TEST_ID,
      nom: 'Tazi',
      prenom: 'Ahmed',
      dateNaissance: new Date('1985-03-15'),
      sexe: 'MASCULIN',
      telephone: '0671234567',
    },
  });
  return patient.id;
}

export async function loginAdmin(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: 'admin@cabinet.ma', motDePasse: 'Admin123!' });
  return res.body.accessToken;
}

export async function seedTestSecretaire(prisma: PrismaSansFiltre): Promise<string> {
  await seedCabinet(prisma);
  const hash = await argon2.hash('Secretaire123!');
  const user = await prisma.user.create({
    data: {
      id: 'test-secretaire-id',
      email: 'secretaire@cabinet.ma',
      motDePasse: hash,
      nom: 'Alaoui',
      prenom: 'Fatima',
      role: Role.SECRETAIRE,
      cabinetId: CABINET_TEST_ID,
    },
  });
  return user.id;
}

export async function login(app: INestApplication, email: string, motDePasse: string) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, motDePasse });
  return res.body as { accessToken: string; refreshToken: string; user: any };
}
