# Recherche de patient sur la page d'accueil — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une barre de recherche sur `/dashboard` (nom, prénom, téléphone, date de consultation) avec ouverture de la fiche et raccourci « + Consultation », et la correction du patient non pré-rempli dans `/consultations/nouvelle?patientId=`.

**Architecture:** Le backend enrichit `GET /patients` (recherche par mots, téléphone sans séparateurs, filtre `date` calculé en heure de Casablanca par une fonction pure). Le frontend ajoute une fonction pure `analyserRecherche` qui lit la saisie, un composant `RecherchePatient` placé sur l'accueil, la lecture de `?q=&date=` sur la page Patients, et corrige la page de nouvelle consultation (React Query v5 n'appelle plus `onSuccess` de `useQuery`).

**Tech Stack:** NestJS + Prisma 5 (backend), Next.js 14 + React Query 5 + Testing Library (frontend), Jest.

Spec : `docs/superpowers/specs/2026-11-11-recherche-patient-accueil-design.md`. Branche : `feat/recherche-patient-accueil`.

---

## Règles du dépôt (à respecter dans toutes les tâches)

- Node 20 : préfixer les commandes par `PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"`.
- Tests e2e **uniquement** sur la base `cabinet_test` :
  `DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test"`. Jamais `cabinet_medical`.
  L'infra doit tourner : `docker compose -f docker-compose.dev.yml up -d`.
- Backend : ne jamais lancer `npm run lint` (il reformate tout) ; vérifier avec `npx eslint <fichiers>`.
- Frontend : `npx tsc --noEmit` a 4 erreurs déjà présentes (`stock/page.tsx`, `NouveauRdvModal.tsx`) ; n'en ajouter aucune.
- Commits : préfixe `feat:` / `fix:` / `test:` / `docs:`, et terminer le message par
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ne pas toucher aux données de seed (`backend/prisma/seed.*`).
- Ne pas pousser, ne pas fusionner.

## Fichiers

| Fichier | Rôle |
|---------|------|
| Create `backend/src/common/dates/journee.ts` | `FUSEAU_CABINET`, `journeeEnUtc(date, fuseau)` |
| Create `backend/src/common/dates/journee.spec.ts` | tests unitaires |
| Create `backend/src/patients/recherche-patients.ts` | `conditionsRecherche(q)` : conditions Prisma du texte |
| Create `backend/src/patients/recherche-patients.spec.ts` | tests unitaires |
| Modify `backend/src/patients/dto/search-patient.dto.ts` | champ `date`, nettoyage de `q` |
| Modify `backend/src/patients/patients.service.ts` (`findAll`) | mots, téléphone, date, `consultationsDuJour` |
| Create `backend/test/recherche-patients.e2e-spec.ts` | e2e de la recherche |
| Create `frontend/src/lib/fuseau.ts` | `FUSEAU_CABINET`, `heureCabinet()` |
| Create `frontend/src/components/dashboard/analyser-recherche.ts` (+ `.test.ts`) | lecture de la saisie |
| Create `frontend/src/components/dashboard/RecherchePatient.tsx` (+ `.test.tsx`) | barre de recherche |
| Modify `frontend/src/app/(dashboard)/dashboard/page.tsx` | insertion du composant |
| Modify `frontend/src/app/(dashboard)/patients/page.tsx` | lecture de `?q=&date=` |
| Modify `frontend/src/app/(dashboard)/consultations/nouvelle/page.tsx` (+ `page.test.tsx`) | point 4 |
| Modify `CLAUDE.md` | route `/patients` |

---

### Task 1 : `journeeEnUtc` (bornes d'une journée à Casablanca)

**Files:**
- Create: `backend/src/common/dates/journee.ts`
- Test: `backend/src/common/dates/journee.spec.ts`

- [x] **Step 1 : écrire le test**

```ts
// backend/src/common/dates/journee.spec.ts
import { FUSEAU_CABINET, journeeEnUtc } from './journee';

// Date et heure locales d'un instant dans le fuseau, ex. « 2026-11-10 00:00 »
function local(instant: Date, fuseau = FUSEAU_CABINET): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}`;
}

describe('journeeEnUtc', () => {
  it('jour ordinaire (UTC+1) : la journée commence à 23:00 UTC la veille', () => {
    const { debut, fin } = journeeEnUtc('2026-11-10');
    expect(debut.toISOString()).toBe('2026-11-09T23:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-11-10T23:00:00.000Z');
  });

  it('jour de Ramadan (UTC+0) : la journée commence à minuit UTC', () => {
    const { debut, fin } = journeeEnUtc('2026-03-01');
    expect(debut.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it("chaque jour de 2026, changements d'heure compris, va de minuit à minuit heure locale", () => {
    for (let jour = new Date(Date.UTC(2026, 0, 1)); jour.getUTCFullYear() === 2026; jour.setUTCDate(jour.getUTCDate() + 1)) {
      const date = jour.toISOString().slice(0, 10);
      const { debut, fin } = journeeEnUtc(date);
      expect(local(debut)).toBe(`${date} 00:00`);
      const lendemain = new Date(jour.getTime() + 86_400_000).toISOString().slice(0, 10);
      expect(local(fin)).toBe(`${lendemain} 00:00`);
    }
  });

  it('accepte un autre fuseau', () => {
    expect(journeeEnUtc('2026-07-01', 'Europe/Paris').debut.toISOString()).toBe('2026-06-30T22:00:00.000Z');
  });
});
```

- [x] **Step 2 : vérifier qu'il échoue**

Run: `cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/common/dates`
Expected: FAIL, « Cannot find module './journee' ».

- [x] **Step 3 : implémenter**

```ts
// backend/src/common/dates/journee.ts

// Fuseau des cabinets. Deviendra un réglage par cabinet (correction de l'agenda).
// Pas de décalage codé en dur : le Maroc passe à UTC+0 pendant le Ramadan.
export const FUSEAU_CABINET = 'Africa/Casablanca';

// Décalage (en ms) entre l'heure locale du fuseau et UTC à un instant donné
function decalage(instant: number, fuseau: string): number {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const v = (type: string) => Number(parties.find((p) => p.type === type)!.value);
  const commeUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return commeUtc - Math.floor(instant / 1000) * 1000;
}

// Instant UTC de minuit, heure locale du fuseau, pour une date (a, m, j)
function minuitLocal(a: number, m: number, j: number, fuseau: string): Date {
  const naif = Date.UTC(a, m - 1, j);
  // Deux passes : le décalage peut différer entre minuit UTC et minuit local
  let t = naif - decalage(naif, fuseau);
  t = naif - decalage(t, fuseau);
  return new Date(t);
}

// Journée civile AAAA-MM-JJ dans le fuseau, en instants UTC : [debut, fin[
export function journeeEnUtc(date: string, fuseau: string = FUSEAU_CABINET): { debut: Date; fin: Date } {
  const [a, m, j] = date.split('-').map(Number);
  const lendemain = new Date(Date.UTC(a, m - 1, j + 1));
  return {
    debut: minuitLocal(a, m, j, fuseau),
    fin: minuitLocal(lendemain.getUTCFullYear(), lendemain.getUTCMonth() + 1, lendemain.getUTCDate(), fuseau),
  };
}
```

- [x] **Step 4 : vérifier qu'il passe**

Run: `cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/common/dates`
Expected: 4 tests PASS.

- [x] **Step 5 : commit**

```bash
git add backend/src/common/dates
git commit -m "feat: compute a calendar day in the cabinet time zone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : conditions de recherche du texte

**Files:**
- Create: `backend/src/patients/recherche-patients.ts`
- Test: `backend/src/patients/recherche-patients.spec.ts`

- [x] **Step 1 : écrire le test**

```ts
// backend/src/patients/recherche-patients.spec.ts
import { conditionsRecherche } from './recherche-patients';

const mot = (m: string) => ({
  OR: [
    { nom: { contains: m, mode: 'insensitive' } },
    { prenom: { contains: m, mode: 'insensitive' } },
    { telephone: { contains: m } },
  ],
});

describe('conditionsRecherche', () => {
  it('un mot : nom, prénom ou téléphone', () => {
    expect(conditionsRecherche('tazi')).toEqual([mot('tazi')]);
  });

  it('plusieurs mots : chacun doit correspondre (ET), dans n importe quel ordre', () => {
    expect(conditionsRecherche('  Ahmed   Tazi ')).toEqual([mot('Ahmed'), mot('Tazi')]);
  });

  it('téléphone avec espaces, points ou tirets : un seul fragment sans séparateurs', () => {
    expect(conditionsRecherche('06 12 34')).toEqual([{ telephone: { contains: '061234' } }]);
    expect(conditionsRecherche('06.12-34')).toEqual([{ telephone: { contains: '061234' } }]);
  });

  it('téléphone sans séparateur : règle par mot (nom, prénom ou téléphone)', () => {
    expect(conditionsRecherche('0612')).toEqual([mot('0612')]);
  });

  it('texte vide : aucune condition', () => {
    expect(conditionsRecherche('   ')).toEqual([]);
  });
});
```

- [x] **Step 2 : vérifier qu'il échoue**

Run: `cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/patients/recherche-patients`
Expected: FAIL, module introuvable.

- [x] **Step 3 : implémenter**

```ts
// backend/src/patients/recherche-patients.ts
import { Prisma } from '@prisma/client';

const SEPARATEURS = /[\s.-]/g;

// Conditions (à combiner en ET) pour le texte d'une recherche de patients.
// - un numéro saisi avec séparateurs (« 06 12 34 ») est cherché d'un bloc, sans séparateurs
//   (les téléphones sont stockés sans espace : 0612345678) ;
// - sinon chaque mot doit se trouver dans le nom, le prénom ou le téléphone :
//   « Ahmed Tazi » et « Tazi Ahmed » trouvent le même patient.
export function conditionsRecherche(q: string): Prisma.PatientWhereInput[] {
  const texte = q.trim();
  if (!texte) return [];

  const chiffres = texte.replace(SEPARATEURS, '');
  if (/^\d+$/.test(chiffres) && chiffres !== texte) {
    return [{ telephone: { contains: chiffres } }];
  }

  return texte.split(/\s+/).map(
    (mot): Prisma.PatientWhereInput => ({
      OR: [
        { nom: { contains: mot, mode: Prisma.QueryMode.insensitive } },
        { prenom: { contains: mot, mode: Prisma.QueryMode.insensitive } },
        { telephone: { contains: mot } },
      ],
    }),
  );
}
```

- [x] **Step 4 : vérifier qu'il passe**

Run: `cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/patients/recherche-patients`
Expected: 5 tests PASS.

- [x] **Step 5 : commit**

```bash
git add backend/src/patients/recherche-patients.ts backend/src/patients/recherche-patients.spec.ts
git commit -m "feat: match patients by every word and by phone without separators

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : `GET /patients` accepte `date` et utilise la nouvelle recherche

**Files:**
- Modify: `backend/src/patients/dto/search-patient.dto.ts`
- Modify: `backend/src/patients/patients.service.ts` (méthode `findAll`, lignes ~35-74)
- Test: `backend/test/recherche-patients.e2e-spec.ts`

- [x] **Step 1 : écrire le test e2e**

```ts
// backend/test/recherche-patients.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import { CABINET_TEST_ID, createApp, loginAdmin, resetDb, seedCabinet, seedTestUser } from './helpers';

describe('Recherche de patients (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let token: string;

  const chercher = (params: Record<string, string>) =>
    request(app.getHttpServer())
      .get('/api/patients')
      .query(params)
      .set('Authorization', `Bearer ${token}`);

  const ids = (res: request.Response) => res.body.data.map((p: { id: string }) => p.id).sort();

  async function patient(id: string, nom: string, prenom: string, telephone: string, cabinetId = CABINET_TEST_ID) {
    await prisma.patient.create({
      data: { id, cabinetId, nom, prenom, telephone, sexe: 'MASCULIN', dateNaissance: new Date('1980-01-01') },
    });
  }

  async function consultation(id: string, patientId: string, iso: string, cabinetId = CABINET_TEST_ID, medecinId = 'test-admin-id') {
    await prisma.consultation.create({
      data: { id, cabinetId, patientId, medecinId, dateConsultation: new Date(iso) },
    });
  }

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await seedTestUser(prisma);
    token = await loginAdmin(app);

    await patient('p-tazi', 'Tazi', 'Ahmed', '0612345678');
    await patient('p-alami', 'Alami', 'Sara', '0698765432');
    await patient('p-ahmed', 'Bennani', 'Ahmed', '0711223344');

    // 10/11/2026 à Casablanca (UTC+1) : de 2026-11-09T23:00Z à 2026-11-10T23:00Z
    await consultation('c-0030', 'p-tazi', '2026-11-09T23:30:00Z'); // 00:30 le 10/11
    await consultation('c-2330', 'p-alami', '2026-11-10T22:30:00Z'); // 23:30 le 10/11
    await consultation('c-tard', 'p-ahmed', '2026-11-10T23:30:00Z'); // 00:30 le 11/11
    // Ramadan (UTC+0) : 23:30 UTC le 01/03 est encore le 01/03 à Casablanca
    await consultation('c-ramadan', 'p-ahmed', '2026-03-01T23:30:00Z');

    // Un autre cabinet, avec une consultation le même jour
    const autre = await seedCabinet(prisma, 'cabinet-autre');
    await prisma.user.create({
      data: { id: 'autre-medecin', email: 'autre@cabinet.ma', motDePasse: 'x', nom: 'Autre', prenom: 'Dr', role: 'MEDECIN', cabinetId: autre },
    });
    await patient('p-autre', 'Tazi', 'Ahmed', '0612345678', autre);
    await consultation('c-autre', 'p-autre', '2026-11-10T10:00:00Z', autre, 'autre-medecin');
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  it('nom complet dans les deux ordres', async () => {
    expect(ids(await chercher({ q: 'Ahmed Tazi' }))).toEqual(['p-tazi']);
    expect(ids(await chercher({ q: 'tazi ahmed' }))).toEqual(['p-tazi']);
  });

  it('un prénom partagé trouve les deux patients', async () => {
    expect(ids(await chercher({ q: 'ahmed' }))).toEqual(['p-ahmed', 'p-tazi']);
  });

  it('téléphone saisi avec des espaces', async () => {
    expect(ids(await chercher({ q: '06 12 34' }))).toEqual(['p-tazi']);
  });

  it('date seule : patients vus ce jour-là, heure de Casablanca (00:30 et 23:30)', async () => {
    const res = await chercher({ date: '2026-11-10' });
    expect(res.status).toBe(200);
    expect(ids(res)).toEqual(['p-alami', 'p-tazi']);
    const tazi = res.body.data.find((p: { id: string }) => p.id === 'p-tazi');
    expect(tazi.consultationsDuJour).toEqual([
      { id: 'c-0030', dateConsultation: '2026-11-09T23:30:00.000Z', medecin: { nom: 'Admin', prenom: 'Test' } },
    ]);
  });

  it('une consultation à 00:30 le lendemain est rangée le lendemain', async () => {
    expect(ids(await chercher({ date: '2026-11-11' }))).toEqual(['p-ahmed']);
  });

  it('jour de Ramadan (UTC+0)', async () => {
    expect(ids(await chercher({ date: '2026-03-01' }))).toEqual(['p-ahmed']);
    expect(ids(await chercher({ date: '2026-03-02' }))).toEqual([]);
  });

  it('nom + date se combinent', async () => {
    expect(ids(await chercher({ q: 'tazi', date: '2026-11-10' }))).toEqual(['p-tazi']);
    expect(ids(await chercher({ q: 'bennani', date: '2026-11-10' }))).toEqual([]);
  });

  it("rien de l'autre cabinet", async () => {
    const res = await chercher({ date: '2026-11-10' });
    expect(ids(res)).not.toContain('p-autre');
    expect(res.body.meta.total).toBe(2);
    expect(ids(await chercher({ q: 'tazi' }))).toEqual(['p-tazi']);
  });

  it('sans date, pas de consultationsDuJour', async () => {
    const res = await chercher({ q: 'tazi' });
    expect(res.body.data[0]).not.toHaveProperty('consultationsDuJour');
  });

  it.each(['2026-02-31', '10/11/2026', '2026-1-5', 'abc'])('date invalide %s → 400', async (date) => {
    expect((await chercher({ date })).status).toBe(400);
  });

  it('texte trop long → 400', async () => {
    expect((await chercher({ q: 'a'.repeat(101) })).status).toBe(400);
  });
});
```

- [x] **Step 2 : vérifier qu'il échoue**

Run:
```bash
cd backend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" \
  DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" \
  npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/recherche-patients
```
Expected: FAIL (nom complet sans résultat, `date` refusé en 400 par `forbidNonWhitelisted`).

- [x] **Step 3 : modifier le DTO**

Remplacer `backend/src/patients/dto/search-patient.dto.ts` par :

```ts
import { IsOptional, IsString, IsInt, Min, Max, MaxLength, Matches, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NettoyerTexte } from '../../common/transforms/nettoyer-texte';

export class SearchPatientDto {
  @ApiProperty({ required: false, description: 'Nom, prénom ou téléphone (plusieurs mots possibles)' })
  @IsOptional()
  @NettoyerTexte()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiProperty({
    required: false,
    example: '2026-11-10',
    description: 'Patients vus en consultation ce jour-là (heure de Casablanca)',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date invalide' })
  @IsISO8601({ strict: true }, { message: 'Date invalide' })
  date?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- [x] **Step 4 : modifier `findAll`**

Dans `backend/src/patients/patients.service.ts`, ajouter les imports :

```ts
import { journeeEnUtc } from '../common/dates/journee';
import { conditionsRecherche } from './recherche-patients';
```

et remplacer toute la méthode `findAll` par :

```ts
  async findAll(dto: SearchPatientDto) {
    const { q, date, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const conditions = q ? conditionsRecherche(q) : [];
    const journee = date ? journeeEnUtc(date) : undefined;
    const duJour = journee && { dateConsultation: { gte: journee.debut, lt: journee.fin } };

    const where: Prisma.PatientWhereInput = {
      actif: true,
      ...(conditions.length > 0 && { AND: conditions }),
      ...(duJour && { consultations: { some: duJour } }),
    };

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: 'asc' },
        select: {
          id: true,
          nom: true,
          prenom: true,
          dateNaissance: true,
          sexe: true,
          telephone: true,
          email: true,
          ville: true,
          groupeSanguin: true,
          createdAt: true,
          // Avec une date : les consultations de ce jour (heure et médecin)
          ...(duJour && {
            consultations: {
              where: duJour,
              orderBy: { dateConsultation: 'asc' as const },
              select: { id: true, dateConsultation: true, medecin: { select: { nom: true, prenom: true } } },
            },
          }),
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    const data = duJour
      ? patients.map(({ consultations, ...p }: any) => ({ ...p, consultationsDuJour: consultations }))
      : patients;

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }
```

- [x] **Step 5 : vérifier**

Run (e2e de la tâche, puis tous les e2e des patients et de l'isolation) :
```bash
cd backend && export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" \
  DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test"
npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/recherche-patients test/patients test/isolation
npx jest
npx tsc --noEmit -p tsconfig.json
npx eslint src/patients src/common/dates test/recherche-patients.e2e-spec.ts
```
Expected: tout PASS, aucune erreur de type ni d'eslint.

- [x] **Step 6 : commit**

```bash
git add backend/src/patients backend/test/recherche-patients.e2e-spec.ts
git commit -m "feat: search patients by full name, spaced phone and consultation date

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : `analyserRecherche` (lecture de la saisie, frontend)

**Files:**
- Create: `frontend/src/components/dashboard/analyser-recherche.ts`
- Test: `frontend/src/components/dashboard/analyser-recherche.test.ts`

- [x] **Step 1 : écrire le test**

```ts
// frontend/src/components/dashboard/analyser-recherche.test.ts
import { analyserRecherche } from './analyser-recherche';

describe('analyserRecherche', () => {
  it.each([
    ['tazi', { type: 'requete', q: 'tazi' }],
    ['  Ahmed  Tazi ', { type: 'requete', q: 'Ahmed Tazi' }],
    ['10/11/2026', { type: 'requete', date: '2026-11-10' }],
    ['10-11-2026', { type: 'requete', date: '2026-11-10' }],
    ['10.11.2026', { type: 'requete', date: '2026-11-10' }],
    ['1/3/2026', { type: 'requete', date: '2026-03-01' }],
    ['tazi 10/11/2026', { type: 'requete', q: 'tazi', date: '2026-11-10' }],
    ['10/11/2026 tazi', { type: 'requete', q: 'tazi', date: '2026-11-10' }],
    ['06-12-34', { type: 'requete', q: '06-12-34' }],
    ['06 12 34', { type: 'requete', q: '06 12 34' }],
    ['29/02/2028', { type: 'requete', date: '2028-02-29' }],
  ])('« %s » → requête', (texte, attendu) => {
    expect(analyserRecherche(texte)).toEqual(attendu);
  });

  it.each(['10/11', '10/11/20', '10/', 'tazi 10/11'])('« %s » → aide au format', (texte) => {
    expect(analyserRecherche(texte)).toEqual({ type: 'aide', message: 'Date au format JJ/MM/AAAA' });
  });

  it.each(['31/02/2026', '32/01/2026', '10/13/2026', '29/02/2027', '01/01/0999'])('« %s » → date invalide', (texte) => {
    expect(analyserRecherche(texte)).toEqual({ type: 'erreur', message: 'Date invalide' });
  });

  it.each(['', ' ', 'a', '  b  '])('« %s » → rien à chercher', (texte) => {
    expect(analyserRecherche(texte)).toEqual({ type: 'vide' });
  });
});
```

- [x] **Step 2 : vérifier qu'il échoue**

Run: `cd frontend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/components/dashboard/analyser-recherche`
Expected: FAIL, module introuvable.

- [x] **Step 3 : implémenter**

```ts
// frontend/src/components/dashboard/analyser-recherche.ts

export type Recherche =
  | { type: 'vide' }
  | { type: 'aide'; message: string }
  | { type: 'erreur'; message: string }
  | { type: 'requete'; q?: string; date?: string };

// JJ/MM/AAAA, séparateurs / - ou . ; une année à 4 chiffres distingue une date d'un téléphone (06-12-34)
const DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

const deux = (n: number) => String(n).padStart(2, '0');

// Lit la saisie de la barre de recherche : un mot peut être une date, le reste est le texte
export function analyserRecherche(texte: string): Recherche {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  const reste: string[] = [];
  let date: string | undefined;

  for (const mot of mots) {
    const m = date ? null : DATE.exec(mot);
    if (m) {
      const [j, mois, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const d = new Date(Date.UTC(a, mois - 1, j));
      const reelle = a >= 1900 && d.getUTCFullYear() === a && d.getUTCMonth() === mois - 1 && d.getUTCDate() === j;
      if (!reelle) return { type: 'erreur', message: 'Date invalide' };
      date = `${a}-${deux(mois)}-${deux(j)}`;
    } else if (mot.includes('/')) {
      // Date en cours de frappe (« 10/11 »)
      return { type: 'aide', message: 'Date au format JJ/MM/AAAA' };
    } else {
      reste.push(mot);
    }
  }

  const q = reste.join(' ');
  if (!date && q.length < 2) return { type: 'vide' };
  return { type: 'requete', ...(q && { q }), ...(date && { date }) };
}
```

- [x] **Step 4 : vérifier qu'il passe**

Run: `cd frontend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/components/dashboard/analyser-recherche`
Expected: PASS.

- [x] **Step 5 : commit**

```bash
git add frontend/src/components/dashboard/analyser-recherche.ts frontend/src/components/dashboard/analyser-recherche.test.ts
git commit -m "feat: read a name, phone or date from the home search box

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : composant `RecherchePatient` et insertion sur l'accueil

**Files:**
- Create: `frontend/src/lib/fuseau.ts`
- Create: `frontend/src/components/dashboard/RecherchePatient.tsx`
- Test: `frontend/src/components/dashboard/RecherchePatient.test.tsx`
- Modify: `frontend/src/app/(dashboard)/dashboard/page.tsx`

- [x] **Step 1 : écrire le test**

```tsx
// frontend/src/components/dashboard/RecherchePatient.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecherchePatient } from './RecherchePatient';
import { apiClient } from '@/lib/api';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;

const tazi = { id: 'p-tazi', nom: 'Tazi', prenom: 'Ahmed', dateNaissance: '1980-01-01T00:00:00.000Z', telephone: '0612345678' };
const alami = { id: 'p-alami', nom: 'Alami', prenom: 'Sara', dateNaissance: '1994-06-15T00:00:00.000Z', telephone: '0698765432' };

function reponse(data: object[], total = data.length) {
  get.mockResolvedValue({ data: { data, meta: { total } } });
}

function afficher(peutCreerConsultation = true) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RecherchePatient peutCreerConsultation={peutCreerConsultation} />
    </QueryClientProvider>,
  );
  return screen.getByRole('combobox');
}

beforeEach(() => {
  get.mockReset();
  push.mockReset();
});

describe('RecherchePatient', () => {
  it('cherche par nom et affiche âge et téléphone', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(), 'tazi');
    expect(await screen.findByText('Ahmed Tazi')).toBeInTheDocument();
    expect(screen.getByText(/0612345678/)).toBeInTheDocument();
    expect(get).toHaveBeenLastCalledWith('/patients', { params: { q: 'tazi', limit: 8 } });
  });

  it('cherche par date et affiche heure et médecin', async () => {
    reponse([
      { ...tazi, consultationsDuJour: [{ id: 'c1', dateConsultation: '2026-11-10T08:30:00.000Z', medecin: { nom: 'Benali', prenom: 'Hassan' } }] },
    ]);
    await userEvent.type(afficher(), '10/11/2026');
    expect(await screen.findByText('Patients vus le 10/11/2026')).toBeInTheDocument();
    expect(screen.getByText('09:30 · Dr Benali')).toBeInTheDocument();
    expect(get).toHaveBeenLastCalledWith('/patients', { params: { date: '2026-11-10', limit: 8 } });
  });

  it('clic sur un patient : ouvre la fiche', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(), 'tazi');
    await userEvent.click(await screen.findByText('Ahmed Tazi'));
    expect(push).toHaveBeenCalledWith('/patients/p-tazi');
  });

  it('clavier : flèche bas puis Entrée ouvre la fiche, Échap ferme', async () => {
    reponse([tazi, alami]);
    const champ = afficher();
    await userEvent.type(champ, 'a');
    await userEvent.type(champ, 'h');
    await screen.findByText('Sara Alami');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(push).toHaveBeenCalledWith('/patients/p-alami');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('« + Consultation » pour le médecin, masqué pour la secrétaire', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(true), 'tazi');
    const lien = await screen.findByRole('link', { name: '+ Consultation pour Ahmed Tazi' });
    expect(lien).toHaveAttribute('href', '/consultations/nouvelle?patientId=p-tazi');
  });

  it('secrétaire : pas de « + Consultation »', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(false), 'tazi');
    await screen.findByText('Ahmed Tazi');
    expect(screen.queryByRole('link', { name: /Consultation/ })).toBeNull();
  });

  it('aucun résultat : message et lien de création', async () => {
    reponse([]);
    await userEvent.type(afficher(), 'zzz');
    expect(await screen.findByText('Aucun patient trouvé')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un patient' })).toHaveAttribute('href', '/patients/nouveau');
  });

  it('plus de 8 résultats : lien vers tous les résultats', async () => {
    reponse([tazi], 12);
    await userEvent.type(afficher(), 'tazi 10/11/2026');
    expect(await screen.findByRole('link', { name: 'Voir tous les résultats (12)' })).toHaveAttribute(
      'href',
      '/patients?q=tazi&date=2026-11-10',
    );
  });

  it('date en cours de frappe : aide, sans requête', async () => {
    await userEvent.type(afficher(), '10/11');
    expect(await screen.findByText('Date au format JJ/MM/AAAA')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('date impossible : message', async () => {
    await userEvent.type(afficher(), '31/02/2026');
    expect(await screen.findByText('Date invalide')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('erreur réseau : message', async () => {
    get.mockRejectedValue(new Error('réseau'));
    await userEvent.type(afficher(), 'tazi');
    await waitFor(() => expect(screen.getByText('Recherche impossible, réessayez')).toBeInTheDocument());
  });
});
```

- [x] **Step 2 : vérifier qu'il échoue**

Run: `cd frontend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/components/dashboard/RecherchePatient`
Expected: FAIL, module introuvable.

- [x] **Step 3 : créer `frontend/src/lib/fuseau.ts`**

```ts
// Fuseau des cabinets (le même que côté serveur). Deviendra un réglage par cabinet.
export const FUSEAU_CABINET = 'Africa/Casablanca';

// Heure HH:mm d'un instant, dans le fuseau du cabinet (pas celui du navigateur)
export function heureCabinet(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU_CABINET });
}
```

- [x] **Step 4 : créer le composant**

```tsx
// frontend/src/components/dashboard/RecherchePatient.tsx
'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { heureCabinet } from '@/lib/fuseau';
import { analyserRecherche } from './analyser-recherche';

const LIMITE = 8;

interface ConsultationDuJour {
  id: string;
  dateConsultation: string;
  medecin: { nom: string; prenom: string };
}

interface PatientTrouve {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  telephone: string;
  consultationsDuJour?: ConsultationDuJour[];
}

function age(dateNaissance: string): number {
  const n = new Date(dateNaissance);
  const auj = new Date();
  let a = auj.getFullYear() - n.getUTCFullYear();
  if (auj.getMonth() < n.getUTCMonth() || (auj.getMonth() === n.getUTCMonth() && auj.getDate() < n.getUTCDate())) a--;
  return a;
}

export function RecherchePatient({ peutCreerConsultation }: { peutCreerConsultation: boolean }) {
  const router = useRouter();
  const idListe = useId();
  const zone = useRef<HTMLDivElement>(null);
  const [texte, setTexte] = useState('');
  const [saisie, setSaisie] = useState(''); // texte retenu après 300 ms sans frappe
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setSaisie(texte), 300);
    return () => clearTimeout(t);
  }, [texte]);

  useEffect(() => setActif(-1), [saisie]);

  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  const recherche = analyserRecherche(saisie);
  const criteres = recherche.type === 'requete' ? { q: recherche.q, date: recherche.date } : null;

  const { data, isError, isFetching } = useQuery({
    queryKey: ['recherche-accueil', criteres],
    queryFn: () =>
      apiClient
        .get('/patients', {
          params: {
            ...(criteres?.q && { q: criteres.q }),
            ...(criteres?.date && { date: criteres.date }),
            limit: LIMITE,
          },
        })
        .then((r) => r.data as { data: PatientTrouve[]; meta: { total: number } }),
    enabled: !!criteres,
    staleTime: 5000,
  });

  const patients = criteres && data ? data.data : [];
  const total = criteres && data ? data.meta.total : 0;
  const visible = ouvert && recherche.type !== 'vide';

  const lienTous = criteres
    ? `/patients?${new URLSearchParams({
        ...(criteres.q && { q: criteres.q }),
        ...(criteres.date && { date: criteres.date }),
      }).toString()}`
    : '';

  const ouvrirFiche = (p: PatientTrouve) => {
    setOuvert(false);
    router.push(`/patients/${p.id}`);
  };

  const auClavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOuvert(false);
      return;
    }
    if (patients.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => (i + 1) % patients.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((i) => (i <= 0 ? patients.length - 1 : i - 1));
    } else if (e.key === 'Enter' && actif >= 0) {
      e.preventDefault();
      ouvrirFiche(patients[actif]);
    }
  };

  const message = (texteMessage: string, classe = 'text-gray-500') => (
    <p className={`px-4 py-3 text-sm ${classe}`}>{texteMessage}</p>
  );

  return (
    <div ref={zone} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>🔍</span>
        <input
          type="text"
          role="combobox"
          aria-label="Rechercher un patient"
          aria-expanded={visible}
          aria-controls={idListe}
          aria-activedescendant={actif >= 0 ? `${idListe}-${actif}` : undefined}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={auClavier}
          placeholder="Nom, prénom, téléphone ou date (JJ/MM/AAAA)"
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-xl shadow-sm text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Recherche en cours">
            <span className="block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </div>

      {visible && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {recherche.type === 'aide' && message(recherche.message)}
          {recherche.type === 'erreur' && message(recherche.message, 'text-red-600')}
          {criteres && isError && message('Recherche impossible, réessayez', 'text-red-600')}
          {criteres && !isError && data && patients.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center justify-between gap-3">
              <span>Aucun patient trouvé</span>
              <Link href="/patients/nouveau" className="text-blue-600 hover:underline">Créer un patient</Link>
            </div>
          )}
          {criteres && !isError && patients.length > 0 && (
            <>
              {criteres.date && (
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase">
                  Patients vus le {criteres.date.split('-').reverse().join('/')}
                </p>
              )}
              <ul id={idListe} role="listbox" aria-label="Patients trouvés" className="divide-y divide-gray-50">
                {patients.map((p, i) => (
                  <li
                    key={p.id}
                    id={`${idListe}-${i}`}
                    role="option"
                    aria-selected={i === actif}
                    onClick={() => ouvrirFiche(p)}
                    onMouseEnter={() => setActif(i)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${i === actif ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{p.prenom} {p.nom}</p>
                      <p className="text-xs text-gray-500">
                        {age(p.dateNaissance)} ans · {p.telephone}
                      </p>
                      {p.consultationsDuJour?.map((c) => (
                        <p key={c.id} className="text-xs text-blue-700">
                          {heureCabinet(c.dateConsultation)} · Dr {c.medecin.nom}
                        </p>
                      ))}
                    </div>
                    {peutCreerConsultation && (
                      <Link
                        href={`/consultations/nouvelle?patientId=${p.id}`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`+ Consultation pour ${p.prenom} ${p.nom}`}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        + Consultation
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {total > LIMITE && (
                <Link href={lienTous} className="block px-4 py-2 text-sm text-blue-600 hover:bg-gray-50 border-t border-gray-100">
                  Voir tous les résultats ({total})
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [x] **Step 5 : vérifier que les tests passent**

Run: `cd frontend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest src/components/dashboard`
Expected: PASS. Si le test « date » échoue sur l'heure (`09:30`), vérifier que `heureCabinet` passe bien `timeZone: FUSEAU_CABINET` (le 10/11/2026, 08:30 UTC = 09:30 à Casablanca).

- [x] **Step 6 : insérer sur l'accueil**

Dans `frontend/src/app/(dashboard)/dashboard/page.tsx`, ajouter l'import :

```tsx
import { RecherchePatient } from '@/components/dashboard/RecherchePatient';
```

et remplacer le bloc d'en-tête :

```tsx
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500">Bonjour, Dr {user?.nom}</p>
      </div>
```

par :

```tsx
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500">Bonjour, Dr {user?.nom}</p>
      </div>

      <RecherchePatient peutCreerConsultation={user?.role === 'MEDECIN'} />
```

- [x] **Step 7 : vérifier les types**

Run: `cd frontend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx tsc --noEmit`
Expected: uniquement les 4 erreurs déjà présentes (`stock/page.tsx`, `NouveauRdvModal.tsx`).

- [x] **Step 8 : commit**

```bash
git add frontend/src/lib/fuseau.ts frontend/src/components/dashboard "frontend/src/app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: patient search box on the home page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : la page Patients lit `?q=&date=`

**Files:**
- Modify: `frontend/src/app/(dashboard)/patients/page.tsx`

`useSearchParams` impose une frontière `Suspense` pour le build Next 14 (même schéma que `paiements/page.tsx`).

- [x] **Step 1 : modifier la page**

En tête du fichier, remplacer les imports React/Next par :

```tsx
'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
```

(garder les autres imports : `useQuery`, `Link`, `apiClient`, `SearchInput`, `toast`).

Renommer `export default function PatientsPage()` en `function ListePatients()` et remplacer le début de son corps (de la déclaration jusqu'à la `useQuery` incluse) par :

```tsx
function ListePatients() {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [date, setDate] = useState(params.get('date') ?? '');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', search, date, page],
    queryFn: () =>
      apiClient
        .get('/patients', { params: { q: search || undefined, date: date || undefined, page, limit: 20 } })
        .then(r => r.data),
    staleTime: 10000,
  });
```

Sous le `<SearchInput … />`, ajouter :

```tsx
      {date && (
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
            Vus en consultation le {date.split('-').reverse().join('/')}
          </span>
          <button
            onClick={() => { setDate(''); setPage(1); }}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Retirer le filtre de date"
          >
            ✕
          </button>
        </div>
      )}
```

À la fin du fichier, ajouter :

```tsx
export default function PatientsPage() {
  return (
    <Suspense>
      <ListePatients />
    </Suspense>
  );
}
```

(`refetch` n'était pas utilisé : il disparaît de la déstructuration.)

- [x] **Step 2 : vérifier**

Run:
```bash
cd frontend && export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"
npx tsc --noEmit
npx next lint --file "src/app/(dashboard)/patients/page.tsx"
```
Expected: pas de nouvelle erreur.

- [x] **Step 3 : commit**

```bash
git add "frontend/src/app/(dashboard)/patients/page.tsx"
git commit -m "feat: open the patients list with the home search filters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : point 4, patient pré-rempli dans la nouvelle consultation

**Files:**
- Modify: `frontend/src/app/(dashboard)/consultations/nouvelle/page.tsx`
- Test: `frontend/src/app/(dashboard)/consultations/nouvelle/page.test.tsx`

**Cause** (à ne pas re-chercher) : `useQuery({ …, onSuccess } as any)` lignes ~48-55. React Query v5 n'appelle plus `onSuccess` dans `useQuery` ; le `as any` masquait l'erreur. Le patient est chargé mais jamais mis dans `selectedPatient`.

- [x] **Step 1 : écrire le test**

```tsx
// frontend/src/app/(dashboard)/consultations/nouvelle/page.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NouvelleConsultationPage from './page';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

let recherche = new URLSearchParams();
const back = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, back, replace: jest.fn() }),
  useSearchParams: () => recherche,
}));
jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const get = apiClient.get as jest.Mock;

const tazi = {
  id: 'p-tazi',
  nom: 'Tazi',
  prenom: 'Ahmed',
  dateNaissance: '1980-01-01T00:00:00.000Z',
  telephone: '0612345678',
  allergies: ['Pénicilline'],
};

function afficher(query: string) {
  recherche = new URLSearchParams(query);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NouvelleConsultationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  useAuthStore.setState({
    user: { id: 'u1', email: 'dr@cabinet.ma', nom: 'Benali', prenom: 'Hassan', role: 'MEDECIN' },
  });
});

describe('Nouvelle consultation : patient passé dans l adresse', () => {
  it('affiche le patient comme sélectionné, avec ses allergies', async () => {
    get.mockResolvedValue({ data: tazi });
    afficher('patientId=p-tazi');
    expect(screen.getByText('Chargement du patient…')).toBeInTheDocument();
    expect(await screen.findByText('Ahmed Tazi')).toBeInTheDocument();
    expect(screen.getByText(/Allergies : Pénicilline/)).toBeInTheDocument();
    expect(screen.getByTitle('Changer de patient')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/patients/p-tazi');
  });

  it('patient introuvable : champ de recherche et message discret', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    afficher('patientId=inconnu');
    expect(await screen.findByText('Patient introuvable, recherchez-le ci-dessous')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rechercher par nom ou téléphone...')).toBeInTheDocument();
  });

  it('sans patient dans l adresse : champ de recherche, aucune requête', () => {
    afficher('');
    expect(screen.getByPlaceholderText('Rechercher par nom ou téléphone...')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2 : vérifier qu'il échoue**

Run: `cd frontend && PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" npx jest "src/app/\(dashboard\)/consultations/nouvelle"`
Expected: FAIL (le patient n'apparaît jamais ; pas de « Chargement du patient… »).

- [x] **Step 3 : corriger le chargement**

Dans `page.tsx`, remplacer le bloc :

```tsx
  // Pré-remplir le patient si patientId passé en query param
  const preloadId = searchParams.get('patientId');
  useQuery({
    queryKey: ['patient-preload', preloadId],
    queryFn: () => apiClient.get(`/patients/${preloadId}`).then(r => r.data),
    enabled: !!preloadId && !selectedPatient,
    onSuccess: (data: Patient) => setSelectedPatient(data),
  } as any);
```

par :

```tsx
  // Pré-remplir le patient si patientId passé en query param.
  // React Query v5 n'appelle plus onSuccess dans useQuery : on lit la donnée
  // et on la place une seule fois (un choix manuel ultérieur n'est pas écrasé).
  const preloadId = searchParams.get('patientId');
  const [preloadTraite, setPreloadTraite] = useState(false);
  const preload = useQuery({
    queryKey: ['patient-preload', preloadId],
    queryFn: () => apiClient.get(`/patients/${preloadId}`).then(r => r.data as Patient),
    enabled: !!preloadId && !preloadTraite,
    retry: false,
  });
  useEffect(() => {
    if (preloadTraite) return;
    if (preload.data) {
      setSelectedPatient(preload.data);
      setPreloadTraite(true);
    } else if (preload.isError) {
      setPreloadTraite(true);
    }
  }, [preload.data, preload.isError, preloadTraite]);
  const chargementPatient = !!preloadId && !preloadTraite;
  const patientIntrouvable = preload.isError && !selectedPatient;

  // Retour à la page précédente (accueil ou fiche), sinon fiche du patient, sinon liste
  const retour = () => {
    if (window.history.length > 1) router.back();
    else router.push(selectedPatient ? `/patients/${selectedPatient.id}` : '/patients');
  };
```

- [x] **Step 4 : affichage du chargement et du message**

Remplacer `{selectedPatient ? (` (début du sélecteur patient, sous `<h2 …>Patient *</h2>`) par :

```tsx
        {chargementPatient ? (
          <p className="p-3 text-sm text-gray-500">Chargement du patient…</p>
        ) : selectedPatient ? (
```

Juste avant `<div ref={dropdownRef} className="relative">` (branche « champ de recherche »), insérer le message en enveloppant la branche dans un fragment :

```tsx
          <>
            {patientIntrouvable && (
              <p className="mb-2 text-sm text-gray-500">Patient introuvable, recherchez-le ci-dessous</p>
            )}
            <div ref={dropdownRef} className="relative">
              {/* … contenu inchangé … */}
            </div>
          </>
```

(fermer le fragment `</>` après le `</div>` qui ferme `dropdownRef`.)

Changer le placeholder du champ, qui annonçait à tort le CIN (colonne supprimée) :

```tsx
                placeholder="Rechercher par nom ou téléphone..."
```

- [x] **Step 5 : « ← Retour » et « Annuler »**

Remplacer le lien d'en-tête :

```tsx
        <Link
          href={selectedPatient ? `/patients/${selectedPatient.id}` : '/patients'}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Retour
        </Link>
```

par :

```tsx
        <button type="button" onClick={retour} className="text-left text-gray-400 hover:text-gray-600 text-sm">
          ← Retour
        </button>
```

et le lien « Annuler » du bas du formulaire par :

```tsx
          <button
            type="button"
            onClick={retour}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-center"
          >
            Annuler
          </button>
```

Si `Link` n'est plus utilisé nulle part dans le fichier, garder l'import uniquement s'il sert encore (le lien « Créer un patient » du menu déroulant l'utilise : il reste).

- [x] **Step 6 : vérifier**

Run:
```bash
cd frontend && export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"
npx jest
npx tsc --noEmit
```
Expected: tous les tests jest PASS ; seulement les 4 erreurs de type déjà présentes.

- [x] **Step 7 : commit**

```bash
git add "frontend/src/app/(dashboard)/consultations/nouvelle"
git commit -m "fix: prefill the patient of a new consultation from the address

React Query v5 no longer calls onSuccess in useQuery; the cast to any hid it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : documentation et vérification finale

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-11-11-recherche-patient-accueil.md` (cocher les cases)

- [x] **Step 1 : `CLAUDE.md`**

Dans la section « Architecture API », remplacer la ligne :

```
/patients            CRUD + export CSV + stats + /cin/:cin
```

par :

```
/patients            CRUD + export CSV + stats ; recherche ?q= (chaque mot : nom, prénom ou téléphone)
                     &date=AAAA-MM-JJ (patients vus ce jour, heure de Casablanca, + consultationsDuJour)
```

Dans « Pièges connus », ajouter la ligne :

```
| Filtre par jour et fuseau horaire | Le serveur tourne en UTC : calculer les bornes d'un jour avec `journeeEnUtc()` (`common/dates/journee.ts`, fuseau `Africa/Casablanca`), jamais `setHours(0,0,0,0)`. Le filtre `?date=` de `/consultations` utilise encore l'heure du serveur (à corriger avec l'agenda) |
```

- [x] **Step 2 : vérification complète**

```bash
export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend
npx jest
DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npm run test:e2e
npx tsc --noEmit -p tsconfig.json
cd ../frontend
npx jest
npx tsc --noEmit
npx next build
```
Expected: tout passe ; `tsc` frontend : seulement les 4 erreurs déjà présentes ; build OK.

- [x] **Step 3 : commit**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-11-11-recherche-patient-accueil.md
git commit -m "docs: document the patient search and check off the plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Points à vérifier à la main (après implémentation)

- Sur `/dashboard` en local : taper « tazi », « ahmed tazi », « 06 71 », une date d'une consultation du seed, « 10/11 », « 31/02/2026 ».
- Flèches, Entrée, Échap ; clic hors de la liste.
- « + Consultation » ouvre la consultation avec le patient pré-rempli ; « ← Retour » revient à l'accueil.
- Connecté en secrétaire : pas de « + Consultation ».
- « Voir tous les résultats » : la page Patients montre la recherche et la puce de date.
- Affichage mobile (largeur 375 px).
