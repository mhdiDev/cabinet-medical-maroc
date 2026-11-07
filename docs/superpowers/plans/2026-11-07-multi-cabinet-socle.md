# Multi-cabinet, étape 1 (socle) — Plan d'implémentation

**Statut :** réalisé le 2026-11-07 sur la branche feat/multi-cabinet-socle, non mergé.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Rattacher toutes les données à un cabinet, isoler strictement les cabinets entre eux et rendre les documents patients privés, sans changer l'usage du cabinet existant.

**Architecture:** Un contexte `AsyncLocalStorage` porte le `cabinetId` de l'utilisateur authentifié. Une extension Prisma l'applique à toutes les opérations des modèles cloisonnés et refuse l'accès sans cabinet. `ReferencesService` vérifie les identifiants reçus dans les écritures. Les fichiers passent par le backend.

**Tech Stack:** NestJS 10, Prisma 5.22, PostgreSQL 16, MinIO (aws-sdk), Next.js 14, Zustand, Jest, Supertest.

**Spec :** `docs/superpowers/specs/2026-11-07-multi-cabinet-socle-design.md`

---

## Règles d'exécution

- Branche : `feat/multi-cabinet-socle`. Ne jamais pousser ni merger sans l'accord de l'utilisateur.
- Node 20 pour chaque commande : `export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"`.
- Les e2e vident la base : toujours `DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test"`, jamais `cabinet_medical`.
- Ne pas lancer `npm run lint` dans `backend` (il reformate tout) : `npx eslint <fichiers>`.
- Le backend ne compile pas entre la fin de la Task 2 et la fin de la Task 3 : c'est prévu.

Variables utilisées dans les commandes :

```bash
export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"
export REPO=/Users/Mehdi/Work/code/cabinet-medical-maroc
export TEST_DB="postgresql://postgres:password@localhost:5432/cabinet_test"
export SCRATCH=/private/tmp/claude-501/-Users-Mehdi-Work-code-cabinet-medical-maroc/e9b48988-592c-44c1-a054-0b55c5a00f61/scratchpad
```

L'état du shell ne persiste pas entre deux commandes : relancer ces `export` à chaque fois.

## Fichiers

**Créés (backend)**
- `backend/src/prisma/contexte-cabinet.ts` : contexte de requête
- `backend/src/prisma/contexte-cabinet.middleware.ts` : ouvre le contexte
- `backend/src/prisma/client-filtre.ts` : liste des modèles cloisonnés, `appliquerCabinet`, `creerClientFiltre`
- `backend/src/prisma/client-filtre.spec.ts`
- `backend/src/prisma/prisma-sans-filtre.spec.ts`
- `backend/src/prisma/references.service.ts`
- `backend/src/common/guards/titulaire.guard.ts`
- `backend/src/common/decorators/titulaire-seulement.decorator.ts`
- `backend/src/consultations/dto/update-consultation.dto.ts`
- `backend/src/documents/document-public.ts`
- `backend/prisma/migrations/20261107120000_multi_cabinet_socle/migration.sql`
- `backend/test/isolation.e2e-spec.ts`

**Modifiés :** `schema.prisma`, `seed.ts`, `prisma.service.ts`, `prisma.module.ts`, `app.module.ts`, `jwt-auth.guard.ts`, `jwt.strategy.ts`, `auth.service.ts`, `auth.controller.ts`, `create-user.dto.ts`, les services et contrôleurs métier, `test/helpers.ts`, les `*.e2e-spec.ts` et `*.service.spec.ts`, `docker-compose.yml`, `nginx/cabinet.conf`, `CLAUDE.md`, et côté frontend le store, le layout, `Sidebar`, `NotificationBell`, la page et les composants utilisateurs, le dossier patient.

**Supprimé :** `minio/public-read-policy.json`.

---

### Task 1 : Contexte de cabinet et règles du filtre

**Files:**
- Create: `backend/src/prisma/contexte-cabinet.ts`
- Create: `backend/src/prisma/client-filtre.ts`
- Test: `backend/src/prisma/client-filtre.spec.ts`

- [x] **Step 1 : Écrire les tests**

`backend/src/prisma/client-filtre.spec.ts` :

```ts
import { ForbiddenException } from '@nestjs/common';
import { appliquerCabinet } from './client-filtre';
import { cabinetCourant, definirCabinet, ouvrirContexte } from './contexte-cabinet';

describe('appliquerCabinet', () => {
  const lectures = [
    'findMany',
    'findFirst',
    'findFirstOrThrow',
    'findUnique',
    'findUniqueOrThrow',
    'count',
    'aggregate',
    'groupBy',
    'delete',
    'deleteMany',
  ];

  it.each(lectures)('%s ajoute le cabinet au where', (operation) => {
    expect(appliquerCabinet(operation, { where: { id: 'x' } }, 'c1').where).toEqual({
      id: 'x',
      cabinetId: 'c1',
    });
  });

  it('accepte une opération sans argument', () => {
    expect(appliquerCabinet('findMany', undefined, 'c1').where).toEqual({ cabinetId: 'c1' });
  });

  it('un where client ne peut pas remplacer le cabinet', () => {
    const res = appliquerCabinet('findMany', { where: { cabinetId: 'autre' } }, 'c1');
    expect(res.where.cabinetId).toBe('c1');
  });

  it('create impose le cabinet', () => {
    const res = appliquerCabinet('create', { data: { nom: 'a', cabinetId: 'autre' } }, 'c1');
    expect(res.data).toEqual({ nom: 'a', cabinetId: 'c1' });
  });

  it('createMany impose le cabinet sur chaque ligne', () => {
    const res = appliquerCabinet('createMany', { data: [{ nom: 'a' }, { nom: 'b' }] }, 'c1');
    expect(res.data).toEqual([
      { nom: 'a', cabinetId: 'c1' },
      { nom: 'b', cabinetId: 'c1' },
    ]);
  });

  it.each(['update', 'updateMany'])('%s filtre et retire cabinetId de data', (operation) => {
    const res = appliquerCabinet(
      operation,
      { where: { id: 'x' }, data: { nom: 'a', cabinetId: 'autre' } },
      'c1',
    );
    expect(res.where).toEqual({ id: 'x', cabinetId: 'c1' });
    expect(res.data).toEqual({ nom: 'a' });
  });

  it('upsert filtre, impose à la création et retire à la modification', () => {
    const res = appliquerCabinet(
      'upsert',
      { where: { id: 'x' }, create: { nom: 'a' }, update: { nom: 'b', cabinetId: 'autre' } },
      'c1',
    );
    expect(res.where).toEqual({ id: 'x', cabinetId: 'c1' });
    expect(res.create).toEqual({ nom: 'a', cabinetId: 'c1' });
    expect(res.update).toEqual({ nom: 'b' });
  });

  it('refuse une opération inconnue', () => {
    expect(() => appliquerCabinet('createManyAndReturn', {}, 'c1')).toThrow(
      'Opération Prisma non gérée',
    );
  });
});

describe('contexte de cabinet', () => {
  it('refuse hors contexte', () => {
    expect(() => cabinetCourant()).toThrow(ForbiddenException);
  });

  it('refuse tant que le cabinet est inconnu', () => {
    ouvrirContexte(() => {
      expect(() => cabinetCourant()).toThrow(ForbiddenException);
    });
  });

  it('refuse un cabinet nul (SUPER_ADMIN)', () => {
    ouvrirContexte(() => {
      definirCabinet(null);
      expect(() => cabinetCourant()).toThrow(ForbiddenException);
    });
  });

  it('garde le cabinet à travers le code asynchrone', async () => {
    await ouvrirContexte(async () => {
      definirCabinet('c1');
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(cabinetCourant()).toBe('c1');
    });
  });

  it('isole deux contextes simultanés', async () => {
    const lire = (id: string) =>
      ouvrirContexte(async () => {
        definirCabinet(id);
        await new Promise((resolve) => setTimeout(resolve, 2));
        return cabinetCourant();
      });
    await expect(Promise.all([lire('a'), lire('b')])).resolves.toEqual(['a', 'b']);
  });
});
```

- [x] **Step 2 : Vérifier l'échec**

Run: `cd $REPO/backend && npx jest src/prisma/client-filtre.spec.ts`
Expected: FAIL, modules `./client-filtre` et `./contexte-cabinet` introuvables.

- [x] **Step 3 : Écrire le contexte**

`backend/src/prisma/contexte-cabinet.ts` :

```ts
import { ForbiddenException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

const stockage = new AsyncLocalStorage<{ cabinetId: string | null }>();

// Ouvert par le middleware, avant l'authentification
export function ouvrirContexte<T>(suite: () => T): T {
  return stockage.run({ cabinetId: null }, suite);
}

// Appelé par JwtAuthGuard : le cabinet vient toujours de la base, jamais du client
export function definirCabinet(cabinetId: string | null): void {
  const contexte = stockage.getStore();
  if (contexte) contexte.cabinetId = cabinetId;
}

// Refus par défaut : sans cabinet connu, aucune donnée cloisonnée n'est accessible
export function cabinetCourant(): string {
  const cabinetId = stockage.getStore()?.cabinetId;
  if (!cabinetId) throw new ForbiddenException('Aucun cabinet associé à cette requête');
  return cabinetId;
}
```

- [x] **Step 4 : Écrire le filtre**

`backend/src/prisma/client-filtre.ts` :

```ts
import { PrismaClient } from '@prisma/client';
import { cabinetCourant } from './contexte-cabinet';

export const MODELES_CLOISONNES = new Set<string>([
  'User',
  'Patient',
  'RendezVous',
  'Consultation',
  'Ordonnance',
  'Paiement',
  'StockArticle',
  'StockMouvement',
  'Document',
  'Notification',
  'Parametre',
  'AuditLog',
]);

type Args = Record<string, any>;

const avecWhere = (args: Args, cabinetId: string): Args => ({
  ...args,
  where: { ...args.where, cabinetId },
});

// Une modification ne déplace jamais une ligne vers un autre cabinet
const sansCabinet = (data: Args): Args => {
  const { cabinetId: _retire, ...reste } = data ?? {};
  return reste;
};

export function appliquerCabinet(
  operation: string,
  args: Args | undefined,
  cabinetId: string,
): Args {
  const a = args ?? {};

  switch (operation) {
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'delete':
    case 'deleteMany':
      return avecWhere(a, cabinetId);
    case 'update':
    case 'updateMany':
      return { ...avecWhere(a, cabinetId), data: sansCabinet(a.data) };
    case 'create':
      return { ...a, data: { ...a.data, cabinetId } };
    case 'createMany': {
      const lignes = Array.isArray(a.data) ? a.data : [a.data];
      return { ...a, data: lignes.map((ligne: Args) => ({ ...ligne, cabinetId })) };
    }
    case 'upsert':
      return {
        ...avecWhere(a, cabinetId),
        create: { ...a.create, cabinetId },
        update: sansCabinet(a.update),
      };
    default:
      // Une opération inconnue ne doit pas passer sans filtre
      throw new Error(`Opération Prisma non gérée sur un modèle cloisonné : ${operation}`);
  }
}

export function creerClientFiltre(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!MODELES_CLOISONNES.has(model)) return query(args);
          return query(appliquerCabinet(operation, args, cabinetCourant()) as typeof args);
        },
      },
    },
  });
}
```

- [x] **Step 5 : Vérifier le succès**

Run: `cd $REPO/backend && npx jest src/prisma/client-filtre.spec.ts`
Expected: PASS.

- [x] **Step 6 : Commit**

```bash
cd $REPO && git add backend/src/prisma/contexte-cabinet.ts backend/src/prisma/client-filtre.ts backend/src/prisma/client-filtre.spec.ts
git commit -m "feat: add cabinet context and Prisma tenant filter rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Schéma, migration et seed

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261107120000_multi_cabinet_socle/migration.sql`
- Modify: `backend/prisma/seed.ts`

- [x] **Step 1 : Modifier le schéma**

Dans `backend/prisma/schema.prisma` :

Remplacer l'enum `Role` :

```prisma
enum Role {
  SUPER_ADMIN
  MEDECIN
  SECRETAIRE
}
```

Ajouter avant `model User` :

```prisma
model Cabinet {
  id        String   @id @default(uuid())
  nom       String
  adresse   String
  ville     String
  telephone String
  actif     Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users           User[]
  patients        Patient[]
  rendezVous      RendezVous[]
  consultations   Consultation[]
  ordonnances     Ordonnance[]
  paiements       Paiement[]
  stockArticles   StockArticle[]
  stockMouvements StockMouvement[]
  documents       Document[]
  notifications   Notification[]
  parametres      Parametre[]
  auditLogs       AuditLog[]

  @@map("cabinets")
}
```

Dans `User`, ajouter après `doitChangerMdp` :

```prisma
  estTitulaire Boolean @default(false)
  cabinetId    String?
```

et avant `@@map("users")` :

```prisma
  cabinet Cabinet? @relation(fields: [cabinetId], references: [id])

  @@index([cabinetId])
```

Dans `Patient`, `RendezVous`, `Consultation`, `Ordonnance`, `Paiement`, `StockMouvement`, `Document` et `Notification`, ajouter le champ après `id`, la relation avec les autres relations, et l'index avant `@@map` :

```prisma
  cabinetId String
  cabinet   Cabinet @relation(fields: [cabinetId], references: [id])

  @@index([cabinetId])
```

Dans `StockArticle` : retirer `@unique` de `reference`, ajouter `cabinetId` et la relation, et avant `@@map` :

```prisma
  @@unique([cabinetId, reference])
```

`Parametre` devient :

```prisma
model Parametre {
  id        String  @id @default(uuid())
  cabinetId String
  cle       String
  valeur    String

  cabinet Cabinet @relation(fields: [cabinetId], references: [id])

  @@unique([cabinetId, cle])
  @@map("parametres")
}
```

Dans `AuditLog`, ajouter `cabinetId String?`, `cabinet Cabinet? @relation(fields: [cabinetId], references: [id])` et `@@index([cabinetId])`.

- [x] **Step 2 : Écrire la migration**

`backend/prisma/migrations/20261107120000_multi_cabinet_socle/migration.sql` :

```sql
-- Premier cabinet : reçoit toutes les données existantes
CREATE TABLE "cabinets" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabinets_pkey" PRIMARY KEY ("id")
);

INSERT INTO "cabinets" ("id", "nom", "adresse", "ville", "telephone", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Cabinet de démonstration', 'À renseigner', 'Casablanca', 'À renseigner', CURRENT_TIMESTAMP);

-- Colonnes, remplies avec le premier cabinet
ALTER TABLE "users" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "users" ADD COLUMN "estTitulaire" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "audit_logs" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "patients" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "rendez_vous" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "consultations" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "ordonnances" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "paiements" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "stock_articles" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "stock_mouvements" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "documents" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "cabinetId" TEXT;
ALTER TABLE "parametres" ADD COLUMN "cabinetId" TEXT;

UPDATE "users" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "audit_logs" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "patients" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "rendez_vous" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "consultations" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "ordonnances" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "paiements" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "stock_articles" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "stock_mouvements" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "documents" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "notifications" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';
UPDATE "parametres" SET "cabinetId" = '00000000-0000-0000-0000-000000000001';

ALTER TABLE "patients" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "rendez_vous" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "consultations" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "ordonnances" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "paiements" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "stock_articles" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "stock_mouvements" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "documents" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "notifications" ALTER COLUMN "cabinetId" SET NOT NULL;
ALTER TABLE "parametres" ALTER COLUMN "cabinetId" SET NOT NULL;

-- ADMIN devient médecin titulaire
UPDATE "users" SET "estTitulaire" = true WHERE "role" = 'ADMIN';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'MEDECIN', 'SECRETAIRE');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role"
  USING (CASE WHEN "role"::text = 'ADMIN' THEN 'MEDECIN' ELSE "role"::text END)::"Role";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'SECRETAIRE';
DROP TYPE "Role_old";

-- Seul un SUPER_ADMIN n'a pas de cabinet
ALTER TABLE "users" ADD CONSTRAINT "users_cabinet_selon_role"
  CHECK (("role" = 'SUPER_ADMIN') = ("cabinetId" IS NULL));

-- Unicité par cabinet
DROP INDEX "stock_articles_reference_key";
DROP INDEX "parametres_cle_key";
CREATE UNIQUE INDEX "stock_articles_cabinetId_reference_key" ON "stock_articles"("cabinetId", "reference");
CREATE UNIQUE INDEX "parametres_cabinetId_cle_key" ON "parametres"("cabinetId", "cle");

-- Index
CREATE INDEX "users_cabinetId_idx" ON "users"("cabinetId");
CREATE INDEX "audit_logs_cabinetId_idx" ON "audit_logs"("cabinetId");
CREATE INDEX "patients_cabinetId_idx" ON "patients"("cabinetId");
CREATE INDEX "rendez_vous_cabinetId_idx" ON "rendez_vous"("cabinetId");
CREATE INDEX "consultations_cabinetId_idx" ON "consultations"("cabinetId");
CREATE INDEX "ordonnances_cabinetId_idx" ON "ordonnances"("cabinetId");
CREATE INDEX "paiements_cabinetId_idx" ON "paiements"("cabinetId");
CREATE INDEX "stock_mouvements_cabinetId_idx" ON "stock_mouvements"("cabinetId");
CREATE INDEX "documents_cabinetId_idx" ON "documents"("cabinetId");
CREATE INDEX "notifications_cabinetId_idx" ON "notifications"("cabinetId");

-- Clés étrangères
ALTER TABLE "users" ADD CONSTRAINT "users_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "patients" ADD CONSTRAINT "patients_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "consultations" ADD CONSTRAINT "consultations_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_articles" ADD CONSTRAINT "stock_articles_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parametres" ADD CONSTRAINT "parametres_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [x] **Step 3 : Adapter le seed**

Dans `backend/prisma/seed.ts` :

Après `const prisma = new PrismaClient();`, ajouter :

```ts
// Même identifiant que dans la migration multi_cabinet_socle
const CABINET_DEMO_ID = '00000000-0000-0000-0000-000000000001';
```

Au début de `main()`, après le premier `console.log` :

```ts
  await prisma.cabinet.upsert({
    where: { id: CABINET_DEMO_ID },
    update: {},
    create: {
      id: CABINET_DEMO_ID,
      nom: 'Cabinet de démonstration',
      adresse: 'À renseigner',
      ville: 'Casablanca',
      telephone: 'À renseigner',
    },
  });
```

Dans l'upsert de `admin@cabinet.ma`, remplacer `role: Role.ADMIN,` par :

```ts
      role: Role.MEDECIN,
      estTitulaire: true,
      cabinetId: CABINET_DEMO_ID,
```

Ajouter `cabinetId: CABINET_DEMO_ID,` dans le `create` des upserts `dr.benali@cabinet.ma`, `secretaire@cabinet.ma`, des trois patients et des trois `stockArticle`.

Remplacer le `where` de chaque upsert `stockArticle` (exemple pour `COMP-01`, à faire pour chaque référence) :

```ts
      where: { cabinetId_reference: { cabinetId: CABINET_DEMO_ID, reference: 'COMP-01' } },
```

Remplacer tout le bloc `// Paramètres cabinet` par :

```ts
  // Paramètres cabinet
  const parametres: Record<string, string> = {
    cabinet_nom: 'Cabinet Dr. Benali',
    cabinet_adresse: '23 Rue Ibn Battouta, Casablanca 20000',
    cabinet_telephone: '0522-123456',
    medecin_specialite: 'Médecine Générale',
    medecin_rppm: 'RPPM-12345',
    duree_rdv_defaut: '30',
    heure_debut: '08:00',
    heure_fin: '18:00',
  };
  await Promise.all(
    Object.entries(parametres).map(([cle, valeur]) =>
      prisma.parametre.upsert({
        where: { cabinetId_cle: { cabinetId: CABINET_DEMO_ID, cle } },
        update: {},
        create: { cabinetId: CABINET_DEMO_ID, cle, valeur },
      }),
    ),
  );
```

Remplacer `console.log('  Admin:      admin@cabinet.ma / Admin123!');` par :

```ts
  console.log('  Titulaire:  admin@cabinet.ma / Admin123!');
```

- [x] **Step 4 : Appliquer et vérifier**

```bash
cd $REPO/backend
npx prisma validate
npx prisma generate
DATABASE_URL="$TEST_DB" npx prisma migrate deploy
DATABASE_URL="$TEST_DB" npx prisma migrate diff --from-url "$TEST_DB" --to-schema-datamodel prisma/schema.prisma --exit-code
DATABASE_URL="$TEST_DB" npx ts-node prisma/seed.ts
DATABASE_URL="$TEST_DB" npx ts-node prisma/seed.ts
```

Expected : migration appliquée ; `diff` affiche « No difference detected » (code 0) ; les deux exécutions du seed se terminent sans erreur. Si `diff` signale un écart, corriger la migration ou le schéma avant de continuer. Si `migrate deploy` échoue parce que la migration a déjà été tentée, recréer `cabinet_test` puis recommencer.

- [x] **Step 5 : Commit**

```bash
cd $REPO && git add backend/prisma
git commit -m "feat: add cabinets and attach existing data to a first cabinet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Brancher l'isolation et le rôle titulaire

À la fin de cette tâche, le backend compile de nouveau et tous les tests passent.

**Files:**
- Create: `backend/src/prisma/contexte-cabinet.middleware.ts`, `backend/src/prisma/prisma-sans-filtre.spec.ts`
- Create: `backend/src/common/guards/titulaire.guard.ts`, `backend/src/common/decorators/titulaire-seulement.decorator.ts`
- Create: `backend/test/isolation.e2e-spec.ts`
- Modify: `backend/src/prisma/prisma.service.ts`, `backend/src/prisma/prisma.module.ts`, `backend/src/app.module.ts`
- Modify: `backend/src/common/guards/jwt-auth.guard.ts`, `backend/src/auth/strategies/jwt.strategy.ts`
- Modify: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/auth/dto/create-user.dto.ts`
- Modify: services patients, rendez-vous, consultations, ordonnances, paiements, stock, documents, notifications
- Modify: contrôleurs patients, consultations, ordonnances
- Modify: `backend/test/helpers.ts`, les 5 `*.e2e-spec.ts`, les specs `auth`, `patients`, `consultations`, `ordonnances`, `paiements`

- [x] **Step 1 : Adapter les helpers de test**

Dans `backend/test/helpers.ts` :

Remplacer les imports de tête par :

```ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import { Role } from '@prisma/client';

export const CABINET_TEST_ID = 'cabinet-test-a';
```

Remplacer le début de `createApp` :

```ts
export async function createApp(
  configurer: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication> {
  const module = await configurer(
    Test.createTestingModule({
      imports: [AppModule],
    }),
  ).compile();
```

Remplacer `resetDb` :

```ts
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
```

Remplacer `seedTestUser` :

```ts
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
```

Dans `seedTestMedecin`, `seedTestPatient` et `seedTestSecretaire` : changer le type du paramètre en `PrismaSansFiltre`, appeler `await seedCabinet(prisma);` en première ligne, et ajouter `cabinetId: CABINET_TEST_ID,` dans `data`.

Dans les 5 fichiers `backend/test/*.e2e-spec.ts`, remplacer `PrismaService` par `PrismaSansFiltre` :

```bash
cd $REPO/backend && sed -i '' 's/PrismaService/PrismaSansFiltre/g' test/auth.e2e-spec.ts test/consultations.e2e-spec.ts test/ordonnances.e2e-spec.ts test/paiements.e2e-spec.ts test/patients.e2e-spec.ts
```

- [x] **Step 2 : Écrire le test d'isolation**

`backend/test/isolation.e2e-spec.ts` :

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
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
        dateNaissance: '1990-01-01',
        sexe: 'FEMININ',
        telephone: '0671234567',
      });
      expect(res.status).toBe(201);
      const log = await prisma.auditLog.findFirst({ where: { entiteId: res.body.id } });
      expect(log?.cabinetId).toBe('a-cabinet');
      await prisma.auditLog.deleteMany({ where: { entiteId: res.body.id } });
      await prisma.patient.delete({ where: { id: res.body.id } });
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
```

- [x] **Step 3 : Écrire les clients Prisma**

Remplacer `backend/src/prisma/prisma.service.ts` :

```ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Accès sans filtre de cabinet. Réservé à la connexion, à JwtStrategy, au contrôle
// d'unicité de l'email et aux tests : voir prisma-sans-filtre.spec.ts
@Injectable()
export class PrismaSansFiltre extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaSansFiltre.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connexion base de données établie');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// Client de tous les services : filtré par cabinet (voir client-filtre.ts).
// L'extension ne change pas l'API, d'où ce type identique à PrismaClient.
export abstract class PrismaService extends PrismaClient {}
```

Remplacer `backend/src/prisma/prisma.module.ts` :

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaSansFiltre, PrismaService } from './prisma.service';
import { creerClientFiltre } from './client-filtre';

@Global()
@Module({
  providers: [
    PrismaSansFiltre,
    {
      provide: PrismaService,
      useFactory: (base: PrismaSansFiltre) => creerClientFiltre(base),
      inject: [PrismaSansFiltre],
    },
  ],
  exports: [PrismaSansFiltre, PrismaService],
})
export class PrismaModule {}
```

- [x] **Step 4 : Ouvrir le contexte à chaque requête**

`backend/src/prisma/contexte-cabinet.middleware.ts` :

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ouvrirContexte } from './contexte-cabinet';

@Injectable()
export class ContexteCabinetMiddleware implements NestMiddleware {
  use(_req: unknown, _res: unknown, next: () => void) {
    ouvrirContexte(next);
  }
}
```

Dans `backend/src/app.module.ts` : importer `MiddlewareConsumer, Module, NestModule` depuis `@nestjs/common` et `ContexteCabinetMiddleware`, puis remplacer la dernière ligne :

```ts
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ContexteCabinetMiddleware).forRoutes('*');
  }
}
```

Dans `backend/src/common/guards/jwt-auth.guard.ts` : ajouter l'import `import { definirCabinet } from '../../prisma/contexte-cabinet';` et remplacer :

```ts
    const { user } = context.switchToHttp().getRequest();
    if (!user?.doitChangerMdp) return true;
```

par :

```ts
    const { user } = context.switchToHttp().getRequest();
    definirCabinet(user?.cabinetId ?? null);
    if (!user?.doitChangerMdp) return true;
```

Dans `backend/src/auth/strategies/jwt.strategy.ts` : remplacer l'import par `import { PrismaSansFiltre } from '../../prisma/prisma.service';`, le constructeur par `constructor(private prisma: PrismaSansFiltre) {`, et le `select` par :

```ts
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        actif: true,
        doitChangerMdp: true,
        cabinetId: true,
        estTitulaire: true,
      },
```

- [x] **Step 5 : Écrire le contrôle du titulaire**

`backend/src/common/guards/titulaire.guard.ts` :

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class TitulaireGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.estTitulaire) {
      throw new ForbiddenException('Accès réservé au médecin titulaire');
    }
    return true;
  }
}
```

`backend/src/common/decorators/titulaire-seulement.decorator.ts` :

```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TitulaireGuard } from '../guards/titulaire.guard';

// Route réservée au médecin titulaire du cabinet
export const TitulaireSeulement = () => UseGuards(JwtAuthGuard, TitulaireGuard);
```

- [x] **Step 6 : Adapter l'authentification**

Dans `backend/src/auth/auth.controller.ts` : retirer les imports `RolesGuard`, `Roles` et `Role`, ajouter `import { TitulaireSeulement } from '../common/decorators/titulaire-seulement.decorator';`. Sur `createUser`, `listUsers` et `resetPassword`, remplacer les deux lignes

```ts
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
```

par

```ts
  @TitulaireSeulement()
```

et dans les `summary` de ces trois routes, remplacer `(admin)` par `(titulaire)`.

Dans `backend/src/auth/dto/create-user.dto.ts` : remplacer `IsEnum` par `IsIn` dans l'import, puis :

```ts
  @ApiProperty({ enum: [Role.MEDECIN, Role.SECRETAIRE] })
  @IsIn([Role.MEDECIN, Role.SECRETAIRE], { message: 'Rôle invalide' })
  role: Role;
```

Dans `backend/src/auth/auth.service.ts` :

Remplacer l'import Prisma et ajouter le contexte :

```ts
import { PrismaSansFiltre, PrismaService } from '../prisma/prisma.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';
```

Constructeur :

```ts
  constructor(
    private prisma: PrismaService,
    private prismaSansFiltre: PrismaSansFiltre,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}
```

Dans `validateUser` :

```ts
    // Le cabinet n'est pas encore connu à la connexion
    const user = await this.prismaSansFiltre.user.findUnique({ where: { email } });
```

Dans `createUser` :

```ts
    // L'email est unique sur toute la plateforme, pas seulement dans le cabinet
    const existing = await this.prismaSansFiltre.user.findUnique({ where: { email: dto.email } });
```

et `data` devient :

```ts
        data: {
          ...dto,
          cabinetId: cabinetCourant(),
          motDePasse: await argon2.hash(motDePasseInitial),
          doitChangerMdp: true,
        },
```

Ajouter `estTitulaire: true,` dans le `select` de `createUser` et de `listUsers`.

- [x] **Step 7 : Passer le cabinet aux créations et retirer ADMIN**

Ajouter dans chaque service ci-dessous `import { cabinetCourant } from '../prisma/contexte-cabinet';`, puis :

| Fichier | Avant | Après |
|---------|-------|-------|
| `patients/patients.service.ts` | `create({ data: dto })` | `create({ data: { ...dto, cabinetId: cabinetCourant() } })` |
| `rendez-vous/rendez-vous.service.ts` | `data: { ...dto, dateHeure: debut },` | `data: { ...dto, dateHeure: debut, cabinetId: cabinetCourant() },` |
| `consultations/consultations.service.ts` | `data: dto,` (dans `create`) | `data: { ...dto, cabinetId: cabinetCourant() },` |
| `ordonnances/ordonnances.service.ts` | `...rest,` | `...rest,` suivi de `cabinetId: cabinetCourant(),` |
| `paiements/paiements.service.ts` | `data: { ...dto, createdById: userId },` | `data: { ...dto, createdById: userId, cabinetId: cabinetCourant() },` |
| `stock/stock.service.ts` | `create({ data: dto })` | `create({ data: { ...dto, cabinetId: cabinetCourant() } })` |
| `stock/stock.service.ts` | `data: { ...dto, createdById: userId },` | `data: { ...dto, createdById: userId, cabinetId: cabinetCourant() },` |
| `documents/documents.service.ts` | `data: {` suivi de `patientId,` | ajouter `cabinetId: cabinetCourant(),` en tête de `data` |
| `notifications/notifications.service.ts` | `userId: s.id,` | `userId: s.id,` suivi de `cabinetId: cabinetCourant(),` |

Remplacer `Role.ADMIN, Role.MEDECIN` par `Role.MEDECIN` :

```bash
cd $REPO/backend && sed -i '' 's/@Roles(Role.ADMIN, Role.MEDECIN)/@Roles(Role.MEDECIN)/' src/patients/patients.controller.ts src/consultations/consultations.controller.ts src/ordonnances/ordonnances.controller.ts
grep -rn "Role.ADMIN" src test
```

Expected : aucune ligne.

- [x] **Step 8 : Adapter les tests unitaires**

Dans `src/patients/patients.service.spec.ts`, `src/consultations/consultations.service.spec.ts`, `src/ordonnances/ordonnances.service.spec.ts`, `src/paiements/paiements.service.spec.ts` et `src/auth/auth.service.spec.ts`, ajouter après les imports :

```ts
jest.mock('../prisma/contexte-cabinet', () => ({ cabinetCourant: () => 'cabinet-test' }));
```

`patients.service.spec.ts` :

```ts
      expect(mockPrisma.patient.create).toHaveBeenCalledWith({
        data: { ...dto, cabinetId: 'cabinet-test' },
      });
```

`paiements.service.spec.ts` :

```ts
        data: { ...dto, createdById: 'user-1', cabinetId: 'cabinet-test' },
```

`auth.service.spec.ts` : remplacer l'import par `import { PrismaSansFiltre, PrismaService } from '../prisma/prisma.service';`, ajouter dans `providers` :

```ts
        { provide: PrismaSansFiltre, useValue: mockPrisma },
```

et dans le test « crée le compte avec un mot de passe généré » :

```ts
      expect(arg.data.cabinetId).toBe('cabinet-test');
```

- [x] **Step 9 : Écrire les garde-fous du client non filtré**

`backend/src/prisma/prisma-sans-filtre.spec.ts` :

```ts
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Prisma } from '@prisma/client';
import { MODELES_CLOISONNES } from './client-filtre';

const RACINE = join(__dirname, '..');

const AUTORISES = [
  'auth/auth.service.ts',
  'auth/auth.service.spec.ts',
  'auth/strategies/jwt.strategy.ts',
  'prisma/prisma.module.ts',
  'prisma/prisma.service.ts',
  'prisma/prisma-sans-filtre.spec.ts',
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

describe('garde-fous du cloisonnement', () => {
  it("PrismaSansFiltre n'est utilisé que dans les fichiers autorisés", () => {
    const utilisateurs = fichiers(RACINE)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => readFileSync(f, 'utf8').includes('PrismaSansFiltre'))
      .map((f) => relative(RACINE, f))
      .sort();
    expect(utilisateurs).toEqual([...AUTORISES].sort());
  });

  it('tout modèle ayant un cabinetId est cloisonné', () => {
    const modeles = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === 'cabinetId'))
      .map((m) => m.name)
      .sort();
    expect(modeles).toEqual([...MODELES_CLOISONNES].sort());
  });
});
```

- [x] **Step 10 : Lancer tous les tests**

```bash
cd $REPO/backend
npx tsc --noEmit -p tsconfig.json
npx jest
DATABASE_URL="$TEST_DB" npm run test:e2e
```

Expected : aucune erreur `tsc`, unitaires et e2e verts. Si un corps de test ne correspond pas à un DTO (par exemple un champ obligatoire de `CreateStockArticleDto`), corriger le test, pas le DTO. Si une erreur `$transaction` apparaît sur `change-password` ou `stock/mouvements`, corriger `creerClientFiltre` : ne pas contourner le filtre.

`AuthService.refreshToken` et `generateTokens` ne changent pas : `RefreshToken` n'est pas cloisonné.

- [x] **Step 11 : Vérifier le lint**

```bash
cd $REPO/backend && npx eslint src/prisma src/auth src/common test/helpers.ts test/isolation.e2e-spec.ts
```

Expected : aucune erreur nouvelle.

- [x] **Step 12 : Commit**

```bash
cd $REPO && git add backend
git commit -m "feat: enforce cabinet isolation and replace ADMIN with owner doctor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Références croisées et validation

**Files:**
- Create: `backend/src/prisma/references.service.ts`, `backend/src/consultations/dto/update-consultation.dto.ts`
- Modify: `backend/src/prisma/prisma.module.ts`
- Modify: services rendez-vous, consultations, ordonnances, paiements, stock
- Modify: `backend/src/consultations/consultations.controller.ts`
- Modify: specs `consultations`, `ordonnances`, `paiements`
- Test: `backend/test/isolation.e2e-spec.ts`

- [x] **Step 1 : Écrire les tests**

Dans `backend/test/isolation.e2e-spec.ts`, ajouter ce bloc avant `describe('SUPER_ADMIN', ...)` :

```ts
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
      const res = await post('/consultations', { patientId: 'a-patient', medecinId: 'a-medecin' });
      expect(res.status).toBe(404);
      await prisma.user.update({ where: { id: 'a-medecin' }, data: { actif: true } });
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
```

- [x] **Step 2 : Vérifier l'échec**

Run: `cd $REPO/backend && DATABASE_URL="$TEST_DB" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/isolation.e2e-spec.ts -t "références vers un autre cabinet"`
Expected : FAIL. Les créations croisées répondent 201 ou 500, le `cabinetId` n'est pas refusé.

- [x] **Step 3 : Écrire le service**

`backend/src/prisma/references.service.ts` :

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface References {
  patientId?: string | null;
  medecinId?: string | null;
  rendezVousId?: string | null;
  consultationId?: string | null;
  articleId?: string | null;
}

// Le filtre de cabinet ne contrôle pas les identifiants écrits dans une ligne :
// chaque référence reçue est vérifiée ici, via le client filtré
@Injectable()
export class ReferencesService {
  constructor(private prisma: PrismaService) {}

  async verifier(refs: References): Promise<void> {
    const { patientId, medecinId, rendezVousId, consultationId, articleId } = refs;

    if (patientId) {
      await this.exiger(this.prisma.patient.count({ where: { id: patientId } }), 'Patient');
    }
    if (medecinId) {
      await this.exiger(
        this.prisma.user.count({ where: { id: medecinId, actif: true } }),
        'Médecin',
      );
    }
    if (rendezVousId) {
      await this.exiger(this.prisma.rendezVous.count({ where: { id: rendezVousId } }), 'Rendez-vous');
    }
    if (consultationId) {
      await this.exiger(
        this.prisma.consultation.count({ where: { id: consultationId } }),
        'Consultation',
      );
    }
    if (articleId) {
      await this.exiger(this.prisma.stockArticle.count({ where: { id: articleId } }), 'Article');
    }
  }

  private async exiger(compte: Promise<number>, nom: string): Promise<void> {
    if ((await compte) === 0) throw new NotFoundException(`${nom} introuvable`);
  }
}
```

Dans `backend/src/prisma/prisma.module.ts` : importer `ReferencesService`, l'ajouter à `providers` et à `exports`.

- [x] **Step 4 : Valider la modification d'une consultation**

`backend/src/consultations/dto/update-consultation.dto.ts` :

```ts
import { PartialType } from '@nestjs/swagger';
import { CreateConsultationDto } from './create-consultation.dto';

export class UpdateConsultationDto extends PartialType(CreateConsultationDto) {}
```

Dans `backend/src/consultations/consultations.controller.ts`, importer `UpdateConsultationDto` et remplacer `@Body() dto: Partial<CreateConsultationDto>` par `@Body() dto: UpdateConsultationDto`.

- [x] **Step 5 : Appeler les vérifications**

Dans chaque service : importer `ReferencesService` depuis `'../prisma/references.service'` et ajouter `private references: ReferencesService` au constructeur.

`rendez-vous.service.ts`, en première ligne de `create` et, après `await this.findOne(id);`, dans `update` :

```ts
    await this.references.verifier(dto);
```

`consultations.service.ts`, en première ligne de `create` et, après `await this.findOne(id);`, dans `update` ; la signature de `update` devient `update(id: string, dto: UpdateConsultationDto, userId: string)` avec l'import du DTO :

```ts
    await this.references.verifier(dto);
```

`ordonnances.service.ts`, première ligne de `create` :

```ts
    await this.references.verifier({ patientId: dto.patientId, consultationId: dto.consultationId });
```

`paiements.service.ts`, première ligne de `create` :

```ts
    await this.references.verifier(dto);
```

`stock.service.ts`, première ligne de `mouvement` :

```ts
    await this.references.verifier({ consultationId: dto.consultationId });
```

Le `findUnique` existant de `mouvement` couvre déjà `articleId`.

- [x] **Step 6 : Adapter les tests unitaires**

Dans `consultations.service.spec.ts`, `ordonnances.service.spec.ts` et `paiements.service.spec.ts`, importer `ReferencesService` depuis `'../prisma/references.service'` et ajouter dans `providers` :

```ts
        { provide: ReferencesService, useValue: { verifier: jest.fn() } },
```

- [x] **Step 7 : Vérifier le succès**

```bash
cd $REPO/backend
npx jest
DATABASE_URL="$TEST_DB" npm run test:e2e
```

Expected : tout est vert.

- [x] **Step 8 : Commit**

```bash
cd $REPO && git add backend
git commit -m "feat: reject references to other cabinets and validate consultation updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Documents privés côté backend

**Files:**
- Create: `backend/src/documents/document-public.ts`
- Modify: `backend/src/documents/minio.service.ts`, `documents.service.ts`, `documents.controller.ts`
- Modify: `backend/src/patients/patients.service.ts`, `backend/src/consultations/consultations.service.ts`
- Test: `backend/test/isolation.e2e-spec.ts`

- [x] **Step 1 : Écrire les tests**

Dans `backend/test/isolation.e2e-spec.ts`, ajouter avant `describe('SUPER_ADMIN', ...)` :

```ts
  describe('documents', () => {
    it('sans token répond 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/documents/a-doc/fichier');
      expect(res.status).toBe(401);
    });

    it("depuis un autre cabinet répond 404", async () => {
      expect((await get('/documents/b-doc/fichier')).status).toBe(404);
    });

    it('depuis le bon cabinet renvoie le fichier', async () => {
      const res = await get('/documents/a-doc/fichier').buffer(true).parse((r, fin) => {
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
    });

    it('un téléversement range le fichier dans le dossier du cabinet', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('patientId', 'a-patient')
        .attach('file', Buffer.from('pdf'), { filename: 'test.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(201);
      expect(res.body.url).toBeUndefined();
      const doc = await prisma.document.findUnique({ where: { id: res.body.id } });
      expect(doc?.cabinetId).toBe('a-cabinet');
      expect(doc?.url).toContain('cabinets/a-cabinet/patients/a-patient/');
      await prisma.document.delete({ where: { id: res.body.id } });
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
```

- [x] **Step 2 : Vérifier l'échec**

Run: `cd $REPO/backend && DATABASE_URL="$TEST_DB" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/isolation.e2e-spec.ts -t "documents"`
Expected : FAIL, la route `/fichier` répond 404 et `url` est présent.

- [x] **Step 3 : Définir les champs publics**

`backend/src/documents/document-public.ts` :

```ts
// Champs renvoyés au frontend : l'adresse de stockage reste côté serveur
export const DOCUMENT_PUBLIC = {
  id: true,
  patientId: true,
  consultationId: true,
  nom: true,
  type: true,
  taille: true,
  createdAt: true,
} as const;
```

- [x] **Step 4 : Lire un fichier dans MinIO**

Dans `backend/src/documents/minio.service.ts`, ajouter `NotFoundException` à l'import `@nestjs/common` et, avant `deleteFile` :

```ts
  async lireFichier(key: string): Promise<Buffer> {
    try {
      const objet = await this.s3.getObject({ Bucket: this.bucket, Key: key }).promise();
      return objet.Body as Buffer;
    } catch (err: any) {
      if (err.code === 'NoSuchKey') throw new NotFoundException('Fichier introuvable');
      this.logger.error(`Lecture échouée: ${err.message}`);
      throw new ServiceUnavailableException('Le stockage de fichiers est temporairement indisponible');
    }
  }
```

- [x] **Step 5 : Adapter le service**

Remplacer les méthodes de `backend/src/documents/documents.service.ts` et compléter les imports (`ReferencesService`, `DOCUMENT_PUBLIC`, `cabinetCourant` déjà présent) :

```ts
  constructor(
    private prisma: PrismaService,
    private minio: MinioService,
    private references: ReferencesService,
  ) {}

  async upload(file: Express.Multer.File, patientId: string, consultationId?: string) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Seuls les fichiers image (JPG, PNG, GIF, WEBP) et PDF sont acceptés');
    }

    await this.references.verifier({ patientId, consultationId });

    const cabinetId = cabinetCourant();
    const key = await this.minio.uploadFile(file, `cabinets/${cabinetId}/patients/${patientId}`);
    const url = this.minio.getPublicUrl(key);

    return this.prisma.document.create({
      data: {
        cabinetId,
        patientId,
        consultationId: consultationId || null,
        nom: file.originalname,
        type: file.mimetype,
        taille: file.size,
        url,
      },
      select: DOCUMENT_PUBLIC,
    });
  }

  async findByPatient(patientId: string) {
    return this.prisma.document.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      select: DOCUMENT_PUBLIC,
    });
  }

  async lireFichier(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} introuvable`);

    const contenu = await this.minio.lireFichier(this.minio.extractKey(doc.url));
    return { contenu, nom: doc.nom, type: doc.type };
  }

  async delete(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} introuvable`);

    try {
      const key = this.minio.extractKey(doc.url);
      await this.minio.deleteFile(key);
    } catch {
      // Ne pas bloquer la suppression DB si MinIO échoue
    }

    return this.prisma.document.delete({ where: { id }, select: DOCUMENT_PUBLIC });
  }
```

- [x] **Step 6 : Ajouter la route**

Dans `backend/src/documents/documents.controller.ts` : ajouter `Res` et `StreamableFile` à l'import `@nestjs/common`, ajouter `import { Response } from 'express';`, puis avant `@Delete(':id')` :

```ts
  @Get(':id/fichier')
  @ApiOperation({ summary: "Télécharger le fichier d'un document" })
  async fichier(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { contenu, nom, type } = await this.service.lireFichier(id);
    res.set({
      'Content-Type': type,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nom)}`,
    });
    return new StreamableFile(contenu);
  }
```

- [x] **Step 7 : Masquer l'adresse dans les autres réponses**

Dans `backend/src/patients/patients.service.ts`, importer `DOCUMENT_PUBLIC` et dans `findOne` :

```ts
        documents: { orderBy: { createdAt: 'desc' }, select: DOCUMENT_PUBLIC },
```

Dans `backend/src/consultations/consultations.service.ts`, importer `DOCUMENT_PUBLIC` et dans `findOne` :

```ts
        documents: { select: DOCUMENT_PUBLIC },
```

- [x] **Step 8 : Vérifier le succès**

```bash
cd $REPO/backend
npx tsc --noEmit -p tsconfig.json
npx jest
DATABASE_URL="$TEST_DB" npm run test:e2e
npx eslint src/documents src/patients src/consultations test/isolation.e2e-spec.ts
```

Expected : tout est vert.

- [x] **Step 9 : Commit**

```bash
cd $REPO && git add backend
git commit -m "feat: serve patient documents through the API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Retirer l'accès public au stockage

**Files:**
- Modify: `docker-compose.yml`, `nginx/cabinet.conf`
- Delete: `minio/public-read-policy.json`

- [x] **Step 1 : Modifier l'initialisation MinIO**

Dans `docker-compose.yml`, service d'initialisation MinIO : retirer le bloc

```yaml
    volumes:
      - ./minio/public-read-policy.json:/policy.json:ro
```

et remplacer le dernier `entrypoint` par :

```yaml
    entrypoint: >
      /bin/sh -c "(aws --endpoint-url http://minio:9000 s3api head-bucket --bucket cabinet-medical ||
                   aws --endpoint-url http://minio:9000 s3 mb s3://cabinet-medical) &&
                  (aws --endpoint-url http://minio:9000 s3api delete-bucket-policy --bucket cabinet-medical || true)"
```

Le `|| true` est obligatoire : le backend attend la fin de ce conteneur.

- [x] **Step 2 : Retirer le bloc Nginx**

Dans `nginx/cabinet.conf`, supprimer le commentaire `# Documents patients stockés dans MinIO ...` et tout le bloc `location /files/ { ... }`.

- [x] **Step 3 : Supprimer la politique et vérifier**

```bash
cd $REPO
git rm minio/public-read-policy.json
docker compose config --quiet 2>&1 | grep -v "manquant" | head
grep -rn "public-read-policy\|/files/" docker-compose.yml nginx minio
```

Expected : `grep` ne trouve rien. `docker compose config` peut signaler les variables manquantes du `.env` de production : seule une erreur de syntaxe YAML compte.

- [x] **Step 4 : Commit**

```bash
cd $REPO && git add docker-compose.yml nginx/cabinet.conf
git commit -m "fix: remove public read access to patient documents

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Frontend, rôles et session

**Files:**
- Modify: `frontend/src/store/auth.ts`
- Modify: `frontend/src/app/(dashboard)/layout.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`, `NotificationBell.tsx`
- Modify: `frontend/src/components/utilisateurs/types.ts`, `CreateUserModal.tsx`
- Modify: `frontend/src/app/(dashboard)/utilisateurs/page.tsx`

- [x] **Step 1 : Store**

Dans `frontend/src/store/auth.ts`, l'interface `User` devient :

```ts
export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'SUPER_ADMIN' | 'MEDECIN' | 'SECRETAIRE';
  cabinetId?: string | null;
  estTitulaire?: boolean;
  doitChangerMdp?: boolean;
}
```

Ajouter `setUser: (user: User) => void;` dans `AuthState` et, après `setAuth` :

```ts
      setUser: (user) => set({ user }),
```

- [x] **Step 2 : Rafraîchir le compte à l'ouverture**

Dans `frontend/src/app/(dashboard)/layout.tsx`, ajouter l'import `import { apiClient } from '@/lib/api';`, ajouter `setUser` à la lecture du store (`const { token, user, _hasHydrated, setUser } = useAuthStore();`), et après le premier `useEffect` :

```ts
  useEffect(() => {
    // Une session ouverte avant une mise à jour peut garder un rôle périmé en local
    if (!_hasHydrated || !token) return;
    apiClient
      .get('/auth/me')
      .then(({ data }) =>
        setUser({
          id: data.id,
          email: data.email,
          nom: data.nom,
          prenom: data.prenom,
          role: data.role,
          cabinetId: data.cabinetId,
          estTitulaire: data.estTitulaire,
          doitChangerMdp: data.doitChangerMdp,
        }),
      )
      .catch(() => {
        // L'intercepteur axios gère déjà la session expirée
      });
  }, [_hasHydrated, token, setUser]);
```

- [x] **Step 3 : Menu**

Dans `frontend/src/components/layout/Sidebar.tsx`, remplacer `nav` et le filtre :

```ts
interface EntreeNav {
  href: string;
  icon: string;
  label: string;
  roles: string[];
  // Entrée aussi visible par le médecin titulaire
  titulaire?: boolean;
}

const nav: EntreeNav[] = [
  { href: '/dashboard', icon: '🏠', label: 'Tableau de bord', roles: ['MEDECIN', 'SECRETAIRE'] },
  { href: '/agenda', icon: '📅', label: 'Agenda', roles: ['MEDECIN', 'SECRETAIRE'] },
  { href: '/patients', icon: '👥', label: 'Patients', roles: ['MEDECIN', 'SECRETAIRE'] },
  { href: '/consultations', icon: '🩺', label: 'Consultations', roles: ['MEDECIN'] },
  { href: '/paiements', icon: '💰', label: 'Caisse', roles: ['SECRETAIRE'], titulaire: true },
  { href: '/stock', icon: '📦', label: 'Stock', roles: ['SECRETAIRE'], titulaire: true },
  { href: '/utilisateurs', icon: '👤', label: 'Utilisateurs', roles: [], titulaire: true },
  { href: '/mon-compte', icon: '🔑', label: 'Mon compte', roles: ['MEDECIN', 'SECRETAIRE'] },
];
```

```ts
  const items = user?.doitChangerMdp
    ? nav.filter(n => n.href === '/mon-compte')
    : nav.filter(n =>
        !user?.role || n.roles.includes(user.role) || (n.titulaire && user.estTitulaire),
      );
```

- [x] **Step 4 : Notifications**

Dans `frontend/src/components/layout/NotificationBell.tsx`, après `const { user } = useAuthStore();` :

```ts
  const concerne = user?.role === 'SECRETAIRE' || !!user?.estTitulaire;
```

Remplacer la ligne `enabled` par `enabled: concerne && !user?.doitChangerMdp,` et la ligne de retour par `if (!concerne) return null;`.

- [x] **Step 5 : Page Utilisateurs**

`frontend/src/components/utilisateurs/types.ts` :

```ts
export type Role = 'MEDECIN' | 'SECRETAIRE';

export const ROLES: Role[] = ['MEDECIN', 'SECRETAIRE'];

export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  estTitulaire: boolean;
  actif: boolean;
  doitChangerMdp: boolean;
}
```

Dans `CreateUserModal.tsx` : `role: z.enum(['MEDECIN', 'SECRETAIRE'], {`.

Dans `frontend/src/app/(dashboard)/utilisateurs/page.tsx` : remplacer toutes les occurrences de `estAdmin` par `estTitulaire`, et sa définition par `const estTitulaire = !!user?.estTitulaire;`. Remplacer les deux affichages du rôle :

```tsx
                      <p className="text-xs text-gray-400 sm:hidden">{u.email} · {u.role}{u.estTitulaire ? ' · Titulaire' : ''}</p>
```

```tsx
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{u.role}{u.estTitulaire ? ' · Titulaire' : ''}</td>
```

- [x] **Step 6 : Vérifier**

```bash
cd $REPO/frontend
grep -rn "ADMIN" src | grep -v SUPER_ADMIN
npx tsc --noEmit
npm run lint
```

Expected : `grep` ne trouve rien ; `tsc` affiche uniquement les 4 erreurs déjà connues (`stock/page.tsx`, `NouveauRdvModal.tsx`) ; lint sans erreur.

- [x] **Step 7 : Commit**

```bash
cd $REPO && git add frontend
git commit -m "feat: replace admin role with owner doctor in the frontend

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Frontend, ouverture des documents

**Files:**
- Modify: `frontend/src/app/(dashboard)/patients/[id]/page.tsx`

- [x] **Step 1 : Ajouter la fonction**

Dans `frontend/src/app/(dashboard)/patients/[id]/page.tsx`, après les imports :

```ts
async function ouvrirDocument(id: string) {
  // Ouvert avant l'appel réseau, sinon le navigateur bloque l'onglet
  const onglet = window.open('', '_blank');
  try {
    const { data } = await apiClient.get<Blob>(`/documents/${id}/fichier`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    if (onglet) onglet.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    onglet?.close();
    toast.error("Impossible d'ouvrir le document");
  }
}
```

- [x] **Step 2 : Remplacer le lien**

Remplacer le bloc `<a href={d.url} ...>Ouvrir</a>` par :

```tsx
                <button
                  type="button"
                  onClick={() => ouvrirDocument(d.id)}
                  className="text-blue-600 text-xs hover:underline px-2 py-1 rounded hover:bg-blue-50"
                >
                  Ouvrir
                </button>
```

- [x] **Step 3 : Vérifier**

```bash
cd $REPO/frontend
grep -rn "d\.url\|\.url\b" src/app src/components
npx tsc --noEmit
npm run lint
```

Expected : `grep` ne trouve aucun usage d'une adresse de document ; `tsc` affiche uniquement les 4 erreurs connues.

- [x] **Step 4 : Commit**

```bash
cd $REPO && git add frontend
git commit -m "feat: open patient documents through the authenticated API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Migration sur une copie et parcours navigateur

**Files:** aucun fichier du dépôt, sauf correctif si un contrôle échoue.

- [x] **Step 1 : Copier la base locale et compter**

Docker doit tourner. La base `cabinet_medical` locale est encore sur l'ancien schéma.

```bash
cd $REPO
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -c 'DROP DATABASE IF EXISTS cabinet_copie'
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -c 'CREATE DATABASE cabinet_copie'
docker compose -f docker-compose.dev.yml exec -T postgres sh -c 'pg_dump -U postgres cabinet_medical | psql -q -U postgres cabinet_copie'
cat > $SCRATCH/compte.sql <<'SQL'
SELECT 'users', count(*) FROM users UNION ALL SELECT 'patients', count(*) FROM patients
UNION ALL SELECT 'rendez_vous', count(*) FROM rendez_vous UNION ALL SELECT 'consultations', count(*) FROM consultations
UNION ALL SELECT 'ordonnances', count(*) FROM ordonnances UNION ALL SELECT 'paiements', count(*) FROM paiements
UNION ALL SELECT 'stock_articles', count(*) FROM stock_articles UNION ALL SELECT 'stock_mouvements', count(*) FROM stock_mouvements
UNION ALL SELECT 'documents', count(*) FROM documents UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'parametres', count(*) FROM parametres UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs ORDER BY 1;
SQL
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d cabinet_copie < $SCRATCH/compte.sql > $SCRATCH/avant.txt
```

- [x] **Step 2 : Migrer la copie et comparer**

```bash
cd $REPO/backend
DATABASE_URL="$COPIE" npx prisma migrate deploy
cd $REPO
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d cabinet_copie < $SCRATCH/compte.sql > $SCRATCH/apres.txt
diff $SCRATCH/avant.txt $SCRATCH/apres.txt && echo "COMPTES IDENTIQUES"
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d cabinet_copie -c "SELECT email, role, \"estTitulaire\", \"cabinetId\" FROM users ORDER BY email"
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d cabinet_copie -c "SELECT (SELECT count(*) FROM patients WHERE \"cabinetId\" IS NULL) + (SELECT count(*) FROM users WHERE \"cabinetId\" IS NULL) AS sans_cabinet"
```

Expected : `COMPTES IDENTIQUES` ; `admin@cabinet.ma` est `MEDECIN`, `estTitulaire = t` ; `sans_cabinet = 0`.

- [x] **Step 3 : Relancer le seed deux fois sur la copie**

```bash
cd $REPO/backend
DATABASE_URL="$COPIE" npx ts-node prisma/seed.ts
cd $REPO
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d cabinet_copie < $SCRATCH/compte.sql > $SCRATCH/seed1.txt
cd $REPO/backend
DATABASE_URL="$COPIE" npx ts-node prisma/seed.ts
cd $REPO
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d cabinet_copie < $SCRATCH/compte.sql > $SCRATCH/seed2.txt
diff $SCRATCH/seed1.txt $SCRATCH/seed2.txt && echo "SEED IDEMPOTENT"
```

Expected : `SEED IDEMPOTENT`. Le premier passage peut ajouter des données de démonstration absentes de la base locale ; le second ne doit rien ajouter.

- [x] **Step 4 : Migrer la base locale et relancer**

```bash
cd $REPO/backend
DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_medical" npx prisma migrate deploy
```

Arrêter puis relancer le backend et le frontend locaux pour charger le nouveau client Prisma (`rm -rf backend/dist/src` si des routes répondent 404).

- [x] **Step 5 : Parcours Playwright sur http://localhost:3000**

Pour simuler une session ouverte avant le déploiement : se connecter avec `admin@cabinet.ma`, remplacer `"role":"MEDECIN"` par `"role":"ADMIN"` dans `localStorage['cabinet-auth']`, puis recharger. Vérifier :

1. Session ancienne : après rechargement, le menu complet réapparaît sans déconnexion.
2. `admin@cabinet.ma` : menu avec Caisse, Stock, Utilisateurs ; mention « Titulaire » dans la liste.
3. La modale de création ne propose que MEDECIN et SECRETAIRE ; création d'un compte de test réussie.
4. Connexion de `dr.benali@cabinet.ma` : pas de Caisse, Stock ni Utilisateurs ; `/utilisateurs` redirige vers `/dashboard`.
5. Connexion de `secretaire@cabinet.ma` : Agenda, Patients, Caisse, Stock ; la cloche fonctionne ; création d'un rendez-vous réussie.
6. Dossier d'un patient : téléverser un PDF, « Ouvrir » l'affiche dans un nouvel onglet, le supprimer.
7. Aucune erreur dans la console du navigateur.

Supprimer ensuite le compte de test de la base locale.

- [x] **Step 6 : Build et e2e complets**

```bash
cd $REPO/backend && npx jest && DATABASE_URL="$TEST_DB" npm run test:e2e
cd $REPO/frontend && npm run build
docker compose -f $REPO/docker-compose.dev.yml exec -T postgres psql -U postgres -c 'DROP DATABASE cabinet_copie'
```

Expected : tout est vert. Noter les nombres de tests pour la PR.

---

### Task 10 : Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-11-07-multi-cabinet-socle.md`

- [x] **Step 1 : Mettre à jour `CLAUDE.md`**

Stack : remplacer `RBAC (ADMIN / MEDECIN / SECRETAIRE)` par `RBAC (SUPER_ADMIN / MEDECIN / SECRETAIRE, médecin titulaire)`.

Tableau de production : remplacer la ligne `Documents patients` par :

```markdown
| Documents patients | Privés : `GET /api/documents/:id/fichier` (MinIO n'est plus lisible publiquement) |
```

Schéma d'architecture : retirer la ligne `└─ /files/  ▶ minio ...` et remplacer le `├─ /api` par `└─ /api`.

Comptes de démo : remplacer la ligne Admin par :

```markdown
| Médecin titulaire | admin@cabinet.ma | Admin123! |
```

Section déploiement, remplacer le paragraphe « Automatique » par :

```markdown
Automatique : `.github/workflows/deploy.yml` se lance après une CI verte sur master et fait la même chose
en SSH (secrets GitHub `OVH_HOST`, `OVH_USER`, `OVH_SSH_KEY`). **Tout merge sur master part donc en production.**
Juste après un déploiement, l'API répond 502 pendant que le backend applique les migrations et le seed.
```

Modèles Prisma : remplacer `(14 modèles)` par `(15 modèles)` et ajouter `Cabinet` en tête de liste.

Ajouter avant « ## Auth : changement de mot de passe forcé » :

```markdown
## Multi-cabinet : isolation

- Chaque requête ouvre un contexte (`prisma/contexte-cabinet.ts`) ; `JwtAuthGuard` y écrit le `cabinetId` de l'utilisateur, relu en base.
- `PrismaService` est un client filtré (`prisma/client-filtre.ts`) : il ajoute le cabinet à toutes les opérations des modèles cloisonnés et répond 403 sans cabinet, y compris pour un `SUPER_ADMIN`.
- `PrismaSansFiltre` contourne le filtre : réservé à la connexion, à `JwtStrategy` et au contrôle d'unicité de l'email. Un test bloque tout autre usage.
- Nouveau modèle avec `cabinetId` : l'ajouter à `MODELES_CLOISONNES` (un test le vérifie). Un `create` passe `cabinetId: cabinetCourant()`.
- Écriture citant l'identifiant d'une autre donnée : appeler `ReferencesService.verifier()`, car le filtre ne contrôle pas ces identifiants.
- Une ressource d'un autre cabinet répond 404, jamais 403.
- `MEDECIN` + `estTitulaire` gère le cabinet : `@TitulaireSeulement()` protège ses routes.
```

Dans « Auth : changement de mot de passe forcé », remplacer `l'admin` par `le titulaire` et « admin » par « titulaire ».

Conventions, ajouter :

```markdown
- **DTO de modification** : une vraie classe (`PartialType`). Un type `Partial<Dto>` n'existe pas à l'exécution : le corps de la requête ne serait pas validé.
```

Workflow, remplacer l'étape 4 par :

```markdown
4. Deploy → merge sur master (déploiement automatique après une CI verte)
```

- [x] **Step 2 : Marquer le plan**

Cocher les étapes réalisées dans ce fichier et indiquer le statut en tête.

- [x] **Step 3 : Commit**

```bash
cd $REPO && git add CLAUDE.md docs/superpowers/plans/2026-11-07-multi-cabinet-socle.md
git commit -m "docs: document cabinet isolation and automatic deployment

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Après le plan

Ne pas pousser sans l'accord de l'utilisateur. Au moment de la PR, lui rappeler :

1. La PR passe en revue avant le merge.
2. Il lance une sauvegarde de production sur le serveur (`scripts/backup.sh`) avant le merge.
3. Le merge déclenche le déploiement. Vérifier ensuite : `/api/auth/users` 401, connexion du titulaire, liste des patients, ouverture d'un document, et un ancien lien `/files/…` qui ne répond plus avec le fichier.
