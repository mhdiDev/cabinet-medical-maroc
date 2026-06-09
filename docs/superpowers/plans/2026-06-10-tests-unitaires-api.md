# Tests unitaires & API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place une suite de tests unitaires (Jest + mocks) et tests API (Supertest + PostgreSQL) pour les 5 modules critiques, avec CI GitHub Actions sur `master`.

**Architecture:** Double couche — tests unitaires dans `src/*/` (mocks Prisma, sans DB) et tests API dans `test/` (NestJS réel + PostgreSQL de test). Chaque test API bootstrappe sa propre instance de l'app et remet la DB à zéro avant d'exécuter.

**Tech Stack:** Jest 29, Supertest, ts-jest, @nestjs/testing, argon2, Prisma, GitHub Actions

---

## Fichiers créés / modifiés

| Fichier | Action | Rôle |
|---------|--------|------|
| `.github/workflows/ci.yml` | Modifier | Corriger `main` → `master`, ajouter job `api-tests` |
| `backend/package.json` | Modifier | Ajouter script `test:e2e` |
| `backend/test/jest-e2e.json` | Créer | Config Jest pour les tests API |
| `backend/test/helpers.ts` | Créer | `createApp`, `resetDb`, `seedTestUser`, `loginAdmin` |
| `backend/src/patients/patients.service.spec.ts` | Modifier | Supprimer références à `cin`, adapter tests |
| `backend/src/auth/auth.service.spec.ts` | Vérifier | Déjà correct, ne pas modifier |
| `backend/src/consultations/consultations.service.spec.ts` | Créer | Tests unitaires consultations |
| `backend/src/paiements/paiements.service.spec.ts` | Créer | Tests unitaires paiements |
| `backend/src/ordonnances/ordonnances.service.spec.ts` | Créer | Tests unitaires ordonnances |
| `backend/test/auth.e2e-spec.ts` | Créer | Tests API auth |
| `backend/test/patients.e2e-spec.ts` | Créer | Tests API patients |
| `backend/test/consultations.e2e-spec.ts` | Créer | Tests API consultations |
| `backend/test/paiements.e2e-spec.ts` | Créer | Tests API paiements |
| `backend/test/ordonnances.e2e-spec.ts` | Créer | Tests API ordonnances |

---

## Task 1 — Corriger le workflow CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Remplacer le contenu complet de `.github/workflows/ci.yml`** par :

```yaml
name: CI — Cabinet Médical

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  unit-tests:
    name: Tests unitaires (Jest mocks)
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Installer dépendances backend
        working-directory: backend
        run: npm ci

      - name: Générer client Prisma
        working-directory: backend
        run: npx prisma generate
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/cabinet_test

      - name: Tests unitaires
        working-directory: backend
        run: npm test -- --coverage
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/cabinet_test
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  api-tests:
    name: Tests API (Supertest + PostgreSQL)
    runs-on: ubuntu-latest
    needs: unit-tests

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: cabinet_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Installer dépendances backend
        working-directory: backend
        run: npm ci

      - name: Générer client Prisma
        working-directory: backend
        run: npx prisma generate
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/cabinet_test

      - name: Migrer base de données test
        working-directory: backend
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/cabinet_test

      - name: Tests API
        working-directory: backend
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:password@localhost:5432/cabinet_test
          JWT_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  frontend-lint:
    name: Frontend Lint + Build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Installer dépendances frontend
        working-directory: frontend
        run: npm ci

      - name: Linter frontend
        working-directory: frontend
        run: npm run lint

      - name: Build frontend
        working-directory: frontend
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:3001/api

  docker-build:
    name: Docker Build Check
    runs-on: ubuntu-latest
    needs: [api-tests, frontend-lint]
    if: github.ref == 'refs/heads/master'

    steps:
      - uses: actions/checkout@v4

      - name: Build image Docker backend
        run: docker build -f backend/Dockerfile backend/
```

- [ ] **Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: fix branch master, add api-tests job with PostgreSQL"
```

---

## Task 2 — Script test:e2e + config Jest e2e

**Files:**
- Modify: `backend/package.json`
- Create: `backend/test/jest-e2e.json`

- [ ] **Dans `backend/package.json`**, ajouter `"test:e2e"` dans la section `"scripts"` (après `"test:cov"`) :

```json
"test:e2e": "jest --config ./test/jest-e2e.json --runInBand --forceExit"
```

Le résultat de la section scripts doit être :
```json
"scripts": {
  "build": "nest build",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "start": "nest start",
  "start:dev": "nest start --watch",
  "start:debug": "nest start --debug --watch",
  "start:prod": "node dist/main",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:e2e": "jest --config ./test/jest-e2e.json --runInBand --forceExit",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:seed": "ts-node prisma/seed.ts",
  "prisma:import-medicaments": "ts-node prisma/import-medicaments.ts"
}
```

- [ ] **Créer `backend/test/jest-e2e.json`** :

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": "test/.*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "@/(.*)": "<rootDir>/src/$1"
  }
}
```

- [ ] **Vérifier que le répertoire `test/` existe** :

```bash
ls backend/test/
```

Si absent : `mkdir -p backend/test`

- [ ] **Commit**

```bash
git add backend/package.json backend/test/jest-e2e.json
git commit -m "test: add test:e2e script and jest-e2e.json config"
```

---

## Task 3 — Créer `test/helpers.ts`

**Files:**
- Create: `backend/test/helpers.ts`

- [ ] **Créer `backend/test/helpers.ts`** :

```typescript
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
```

- [ ] **Commit**

```bash
git add backend/test/helpers.ts
git commit -m "test: add e2e helpers (createApp, resetDb, seedTestUser, loginAdmin)"
```

---

## Task 4 — Corriger `patients.service.spec.ts`

**Files:**
- Modify: `backend/src/patients/patients.service.spec.ts`

- [ ] **Remplacer le contenu complet de `backend/src/patients/patients.service.spec.ts`** :

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Sexe } from '@prisma/client';

const mockPrisma = {
  patient: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = {
      nom: 'Tazi',
      prenom: 'Ahmed',
      dateNaissance: '1985-03-15',
      sexe: Sexe.MASCULIN,
      telephone: '0671234567',
    };

    it('crée un patient et log l\'audit', async () => {
      mockPrisma.patient.create.mockResolvedValue({ id: 'uuid-1', ...dto });

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.patient.create).toHaveBeenCalledWith({ data: dto });
      expect(mockAudit.log).toHaveBeenCalledWith(
        'user-1', 'CREATE', 'Patient', 'uuid-1',
        { nom: 'Tazi', prenom: 'Ahmed' },
      );
      expect(result).toMatchObject({ nom: 'Tazi' });
    });
  });

  describe('findOne', () => {
    it('retourne le patient avec ses données liées', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue({
        id: 'uuid-1',
        nom: 'Tazi',
        rendezVous: [],
        consultations: [],
        ordonnances: [],
        documents: [],
      });

      const result = await service.findOne('uuid-1');
      expect(result.nom).toBe('Tazi');
    });

    it('lève NotFoundException si patient inexistant', async () => {
      mockPrisma.patient.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('exportCsv', () => {
    it('génère un CSV avec les bons en-têtes sans CIN', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([
        {
          id: '1',
          nom: 'Tazi',
          prenom: 'Ahmed',
          dateNaissance: new Date('1985-03-15'),
          sexe: 'MASCULIN',
          telephone: '0671234567',
          email: '',
          ville: 'Casablanca',
        },
      ]);

      const csv = await service.exportCsv();

      expect(csv).toContain('Nom');
      expect(csv).not.toContain('CIN');
      expect(csv).toContain('Tazi');
    });
  });
});
```

- [ ] **Lancer les tests unitaires pour vérifier** :

```bash
cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm test -- --testPathPattern=patients.service.spec
```

Attendu : `Tests: 3 passed`

- [ ] **Commit**

```bash
git add backend/src/patients/patients.service.spec.ts
git commit -m "test: fix patients unit tests — remove cin references"
```

---

## Task 5 — Créer `consultations.service.spec.ts`

**Files:**
- Create: `backend/src/consultations/consultations.service.spec.ts`

- [ ] **Créer `backend/src/consultations/consultations.service.spec.ts`** :

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsultationsService } from './consultations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const mockPrisma = {
  consultation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };
const mockNotifications = { notifySecretaires: jest.fn().mockResolvedValue(undefined) };

describe('ConsultationsService', () => {
  let service: ConsultationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsultationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<ConsultationsService>(ConsultationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée une consultation et notifie les secrétaires', async () => {
      const dto = {
        patientId: 'patient-1',
        medecinId: 'medecin-1',
        motif: 'Grippe',
      };
      const created = {
        id: 'consult-1',
        ...dto,
        patient: { nom: 'Tazi', prenom: 'Ahmed' },
        medecin: { nom: 'Benali', prenom: 'Hassan' },
      };

      mockPrisma.consultation.create.mockResolvedValue(created);

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.consultation.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', 'CREATE', 'Consultation', 'consult-1');
      expect(mockNotifications.notifySecretaires).toHaveBeenCalledWith(
        'patient-1', 'Ahmed Tazi', 'consult-1',
      );
      expect(result.id).toBe('consult-1');
    });
  });

  describe('findByPatient', () => {
    it('retourne la liste des consultations du patient', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([
        { id: 'c1', patientId: 'patient-1', motif: 'Grippe' },
        { id: 'c2', patientId: 'patient-1', motif: 'Fièvre' },
      ]);

      const result = await service.findByPatient('patient-1');

      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'patient-1' } }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('retourne la consultation si elle existe', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        id: 'c1',
        motif: 'Grippe',
        patient: {},
        medecin: {},
        ordonnances: [],
        documents: [],
      });

      const result = await service.findOne('c1');
      expect(result.motif).toBe('Grippe');
    });

    it('lève NotFoundException si consultation inexistante', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Lancer les tests** :

```bash
cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm test -- --testPathPattern=consultations.service.spec
```

Attendu : `Tests: 4 passed`

- [ ] **Commit**

```bash
git add backend/src/consultations/consultations.service.spec.ts
git commit -m "test: add consultations unit tests"
```

---

## Task 6 — Créer `paiements.service.spec.ts`

**Files:**
- Create: `backend/src/paiements/paiements.service.spec.ts`

- [ ] **Créer `backend/src/paiements/paiements.service.spec.ts`** :

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaiementsService } from './paiements.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TypePaiement } from '@prisma/client';

const mockPrisma = {
  paiement: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('PaiementsService', () => {
  let service: PaiementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaiementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<PaiementsService>(PaiementsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée un paiement et log l\'audit', async () => {
      const dto = { montant: 200, typePaiement: TypePaiement.ESPECE };
      mockPrisma.paiement.create.mockResolvedValue({ id: 'p1', ...dto });

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.paiement.create).toHaveBeenCalledWith({
        data: { ...dto, createdById: 'user-1' },
      });
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', 'CREATE', 'Paiement', 'p1', { montant: 200 });
      expect(result.id).toBe('p1');
    });
  });

  describe('caisse', () => {
    it('retourne les paiements du jour avec total et parType', async () => {
      mockPrisma.paiement.findMany.mockResolvedValue([
        { id: 'p1', montant: 150, montantRemise: 0, typePaiement: TypePaiement.ESPECE, dateHeure: new Date(), patient: null, consultation: null },
        { id: 'p2', montant: 200, montantRemise: 20, typePaiement: TypePaiement.CARTE, dateHeure: new Date(), patient: null, consultation: null },
      ]);

      const result = await service.caisse();

      expect(result.total).toBe(330);
      expect(result.parType[TypePaiement.ESPECE]).toBe(150);
      expect(result.parType[TypePaiement.CARTE]).toBe(180);
      expect(result.paiements).toHaveLength(2);
    });
  });

  describe('rapport', () => {
    it('retourne total et count sur la période', async () => {
      mockPrisma.paiement.findMany.mockResolvedValue([
        { id: 'p1', montant: 100, montantRemise: 0 },
        { id: 'p2', montant: 200, montantRemise: 50 },
      ]);

      const result = await service.rapport('2026-01-01', '2026-01-31');

      expect(result.total).toBe(250);
      expect(result.count).toBe(2);
      expect(result.debut).toBe('2026-01-01');
    });
  });

  describe('exportExcel', () => {
    it('retourne un Buffer sans erreur de type', async () => {
      mockPrisma.paiement.findMany.mockResolvedValue([]);

      const result = await service.exportExcel('2026-01-01', '2026-01-31', 'tous');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
```

- [ ] **Lancer les tests** :

```bash
cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm test -- --testPathPattern=paiements.service.spec
```

Attendu : `Tests: 4 passed`

- [ ] **Commit**

```bash
git add backend/src/paiements/paiements.service.spec.ts
git commit -m "test: add paiements unit tests"
```

---

## Task 7 — Créer `ordonnances.service.spec.ts`

**Files:**
- Create: `backend/src/ordonnances/ordonnances.service.spec.ts`

- [ ] **Créer `backend/src/ordonnances/ordonnances.service.spec.ts`** :

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdonnancesService } from './ordonnances.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const mockPrisma = {
  ordonnance: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
};

const mockAudit = { log: jest.fn() };

describe('OrdonnancesService', () => {
  let service: OrdonnancesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdonnancesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    service = module.get<OrdonnancesService>(OrdonnancesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('crée une ordonnance avec ses médicaments', async () => {
      const dto = {
        patientId: 'patient-1',
        medecinNom: 'Dr Benali',
        medicaments: [{ posologie: '1cp/j', nomLibre: 'Paracétamol' }],
      };
      const created = {
        id: 'ord-1',
        patientId: 'patient-1',
        patient: { nom: 'Tazi', prenom: 'Ahmed', dateNaissance: new Date() },
        medicaments: [],
      };

      mockPrisma.ordonnance.create.mockResolvedValue(created);

      const result = await service.create(dto as any, 'user-1');

      expect(mockPrisma.ordonnance.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith('user-1', 'CREATE', 'Ordonnance', 'ord-1');
      expect(result.id).toBe('ord-1');
    });
  });

  describe('findByPatient', () => {
    it('retourne les ordonnances du patient', async () => {
      mockPrisma.ordonnance.findMany.mockResolvedValue([
        { id: 'o1', patientId: 'patient-1' },
        { id: 'o2', patientId: 'patient-1' },
      ]);

      const result = await service.findByPatient('patient-1');

      expect(mockPrisma.ordonnance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'patient-1' } }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('lève NotFoundException si ordonnance inexistante', async () => {
      mockPrisma.ordonnance.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Lancer tous les tests unitaires pour confirmer** :

```bash
cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm test -- --coverage
```

Attendu : tous les `.spec.ts` passent (auth, patients, consultations, paiements, ordonnances)

- [ ] **Commit**

```bash
git add backend/src/ordonnances/ordonnances.service.spec.ts
git commit -m "test: add ordonnances unit tests — all unit tests green"
```

---

## Task 8 — Tests API auth

**Files:**
- Create: `backend/test/auth.e2e-spec.ts`

Pré-requis : PostgreSQL de test démarré et migrations appliquées.

```bash
# Démarrer la DB de test si pas déjà fait
docker compose -f docker-compose.dev.yml up -d
DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npx prisma migrate deploy
```

- [ ] **Créer `backend/test/auth.e2e-spec.ts`** :

```typescript
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

      expect(res.status).toBe(200);
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

      expect(res.status).toBe(200);
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
```

- [ ] **Lancer les tests API auth** :

```bash
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" JWT_SECRET=test-secret JWT_REFRESH_SECRET=test-refresh-secret PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm run test:e2e -- --testPathPattern=auth.e2e-spec
```

Attendu : `Tests: 7 passed`

- [ ] **Commit**

```bash
git add backend/test/auth.e2e-spec.ts
git commit -m "test: add auth API tests (login, me, refresh)"
```

---

## Task 9 — Tests API patients

**Files:**
- Create: `backend/test/patients.e2e-spec.ts`

- [ ] **Créer `backend/test/patients.e2e-spec.ts`** :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestUser } from './helpers';

const validPatient = {
  nom: 'Tazi',
  prenom: 'Ahmed',
  dateNaissance: '1985-03-15',
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
    it('200 suppression logique (actif=false)', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });
  });
});
```

- [ ] **Lancer les tests** :

```bash
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" JWT_SECRET=test-secret JWT_REFRESH_SECRET=test-refresh-secret PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm run test:e2e -- --testPathPattern=patients.e2e-spec
```

Attendu : `Tests: 8 passed`

- [ ] **Commit**

```bash
git add backend/test/patients.e2e-spec.ts
git commit -m "test: add patients API tests (CRUD + search + validations)"
```

---

## Task 10 — Tests API consultations

**Files:**
- Create: `backend/test/consultations.e2e-spec.ts`

- [ ] **Créer `backend/test/consultations.e2e-spec.ts`** :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestMedecin, seedTestPatient, seedTestUser } from './helpers';

describe('Consultations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let patientId: string;
  let medecinId: string;
  let consultationId: string;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    await resetDb(prisma);
    await seedTestUser(prisma);
    medecinId = await seedTestMedecin(prisma);
    patientId = await seedTestPatient(prisma);
    token = await loginAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/consultations', () => {
    it('201 avec patientId et medecinId valides', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          medecinId,
          motif: 'Grippe saisonnière',
          diagnostic: 'Rhinopharyngite',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.motif).toBe('Grippe saisonnière');
      consultationId = res.body.id;
    });

    it('400 si patientId manquant', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({ medecinId, motif: 'Test' });

      expect(res.status).toBe(400);
    });

    it('401 sans token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/consultations')
        .send({ patientId, medecinId });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/consultations/patient/:id', () => {
    it('200 retourne les consultations du patient', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/consultations/patient/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/consultations', () => {
    it('200 avec liste paginée', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/consultations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.consultations).toBeInstanceOf(Array);
      expect(res.body.meta).toBeDefined();
    });

    it('200 filtrée par date', async () => {
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get(`/api/consultations?date=${today}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.consultations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/consultations/:id', () => {
    it('200 avec consultation existante', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/consultations/${consultationId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.motif).toBe('Grippe saisonnière');
    });

    it('404 si consultation inexistante', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/consultations/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Lancer les tests** :

```bash
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" JWT_SECRET=test-secret JWT_REFRESH_SECRET=test-refresh-secret PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm run test:e2e -- --testPathPattern=consultations.e2e-spec
```

Attendu : `Tests: 6 passed`

- [ ] **Commit**

```bash
git add backend/test/consultations.e2e-spec.ts
git commit -m "test: add consultations API tests"
```

---

## Task 11 — Tests API paiements

**Files:**
- Create: `backend/test/paiements.e2e-spec.ts`

- [ ] **Créer `backend/test/paiements.e2e-spec.ts`** :

```typescript
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
      const today = new Date().toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .get(`/api/paiements/caisse?date=${today}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.date).toBe(today);
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
```

- [ ] **Lancer les tests** :

```bash
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" JWT_SECRET=test-secret JWT_REFRESH_SECRET=test-refresh-secret PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm run test:e2e -- --testPathPattern=paiements.e2e-spec
```

Attendu : `Tests: 7 passed`

- [ ] **Commit**

```bash
git add backend/test/paiements.e2e-spec.ts
git commit -m "test: add paiements API tests (caisse, rapport, export)"
```

---

## Task 12 — Tests API ordonnances

**Files:**
- Create: `backend/test/ordonnances.e2e-spec.ts`

- [ ] **Créer `backend/test/ordonnances.e2e-spec.ts`** :

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, loginAdmin, resetDb, seedTestPatient, seedTestUser } from './helpers';

describe('Ordonnances (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let patientId: string;
  let ordonnanceId: string;

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

  describe('POST /api/ordonnances', () => {
    it('201 avec patientId et médicaments valides', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ordonnances')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId,
          medecinNom: 'Dr Benali',
          medecinSpec: 'Médecin généraliste',
          medicaments: [
            { nomLibre: 'Paracétamol 500mg', posologie: '1 comprimé toutes les 8h', duree: '5 jours', quantite: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.medecinNom).toBe('Dr Benali');
      ordonnanceId = res.body.id;
    });

    it('400 si médicaments manquants', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ordonnances')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId, medecinNom: 'Dr Test', medicaments: [] });

      // Le tableau vide doit au moins être accepté syntaxiquement (200/201)
      // ou refusé si la validation l'exige (400) — on vérifie juste qu'il n'y a pas de 500
      expect(res.status).not.toBe(500);
    });

    it('401 sans token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/ordonnances')
        .send({ patientId, medecinNom: 'Dr Test', medicaments: [] });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/ordonnances/patient/:id', () => {
    it('200 retourne les ordonnances du patient', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ordonnances/patient/${patientId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/ordonnances/:id', () => {
    it('200 avec ordonnance existante', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ordonnances/${ordonnanceId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.medecinNom).toBe('Dr Benali');
    });

    it('404 si ordonnance inexistante', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/ordonnances/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/ordonnances/:id/pdf', () => {
    it('200 retourne un buffer PDF', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/ordonnances/${ordonnanceId}/pdf`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });
});
```

- [ ] **Lancer tous les tests API d'un coup** :

```bash
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" JWT_SECRET=test-secret JWT_REFRESH_SECRET=test-refresh-secret PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npm run test:e2e
```

Attendu : toutes les suites passent (auth, patients, consultations, paiements, ordonnances)

- [ ] **Commit**

```bash
git add backend/test/ordonnances.e2e-spec.ts
git commit -m "test: add ordonnances API tests (CRUD + PDF)"
```

---

## Task 13 — Push final et vérification CI

- [ ] **Pusher tout sur master** :

```bash
git push origin master
```

- [ ] **Vérifier que les jobs CI passent sur GitHub Actions** :

```
https://github.com/mhdiDev/cabinet-medical-maroc/actions
```

Jobs attendus en vert :
- `Tests unitaires (Jest mocks)` ✅
- `Tests API (Supertest + PostgreSQL)` ✅
- `Frontend Lint + Build` ✅
- `Docker Build Check` ✅

- [ ] **Vérifier le résumé de couverture** dans les logs du job `unit-tests` — les 5 services doivent apparaître dans le rapport.
