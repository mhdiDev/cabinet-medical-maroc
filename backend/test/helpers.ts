import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';

export async function createApp(): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

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
  await app.init();
  return app;
}

export async function resetDb(prisma: PrismaService): Promise<void> {
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
    'patients',
    'users',
  ];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
  }
}

export async function seedTestUser(prisma: PrismaService): Promise<void> {
  const hash = await argon2.hash('Admin123!');
  await prisma.user.create({
    data: {
      id: 'test-admin-id',
      email: 'admin@cabinet.ma',
      motDePasse: hash,
      nom: 'Admin',
      prenom: 'Test',
      role: Role.ADMIN,
    },
  });
}

export async function seedTestMedecin(prisma: PrismaService): Promise<string> {
  const hash = await argon2.hash('Medecin123!');
  const user = await prisma.user.create({
    data: {
      id: 'test-medecin-id',
      email: 'dr.test@cabinet.ma',
      motDePasse: hash,
      nom: 'Benali',
      prenom: 'Hassan',
      role: Role.MEDECIN,
    },
  });
  return user.id;
}

export async function seedTestPatient(prisma: PrismaService): Promise<string> {
  const patient = await prisma.patient.create({
    data: {
      id: 'test-patient-id',
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
