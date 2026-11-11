# Constantes médicales — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enregistrer les constantes d'un patient (secrétaire à l'arrivée, médecin en consultation), signaler les valeurs anormales (couleurs + notification au médecin) et afficher leur évolution dans un onglet « Constantes » de la fiche patient.

**Architecture:** Nouveau modèle Prisma `Constantes` (une ligne par prise, valeurs facultatives), cloisonné par cabinet, servi par un module NestJS `constantes/`. Les seuils et bornes vivent dans un fichier sans dépendance, recopié à l'identique côté frontend (un test vérifie la copie). La consultation reçoit un `constantesId` à sa création pour rattacher la prise du jour. Frontend : un formulaire contrôlé partagé (modale de la fiche patient + bloc du formulaire de consultation), un onglet avec courbes Recharts.

**Tech Stack:** NestJS 10, Prisma 5.22, PostgreSQL 16, class-validator ; Next.js 14, React Query v5, Tailwind 3.4, Recharts 2 ; Jest (backend, frontend), Playwright (`e2e/`).

**Spec :** `docs/superpowers/specs/2026-11-11-constantes-design.md` · **Branche :** `feat/constantes` (déjà créée).

---

## Règles pour toute la réalisation

- **Node 20** avant toute commande : `export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"`.
- **Tests e2e backend uniquement sur `cabinet_test`** : préfixer par `DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test"`. Ils vident la base. Jamais sur `cabinet_medical`.
- **Jamais `npm run lint` dans `backend/`** (il reformate tout) : `npx eslint <fichiers>`.
- Ne pas toucher au seed (`backend/prisma/seed.js`).
- Ne pas pousser, ne pas fusionner : commits locaux sur `feat/constantes` seulement.
- Chaque commit se termine par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `frontend: npx tsc --noEmit` a déjà 4 erreurs (`stock/page.tsx`, `NouveauRdvModal.tsx`) : vérifier qu'on n'en ajoute pas.

## Fichiers

| Fichier | Rôle |
|---|---|
| `backend/src/constantes/seuils.ts` (créé) | Champs, bornes, seuils, `evaluerConstantes`, `calculerImc`, `ageEnAnnees` — sans import |
| `backend/src/constantes/seuils.spec.ts` (créé) | Tests des seuils + copie frontend identique |
| `backend/src/constantes/regles.ts` (+ `.spec.ts`) (créé) | Règles métier pures : prise vide, tension, date, droits, enrichissement (IMC + alertes) |
| `backend/src/constantes/dto/create-constantes.dto.ts`, `update-constantes.dto.ts` (créés) | Validation des entrées |
| `backend/src/constantes/constantes.service.ts` (+ `.spec.ts`) (créé) | CRUD, notifications, audit |
| `backend/src/constantes/constantes.controller.ts`, `constantes.module.ts` (créés) | Routes `/constantes` |
| `backend/test/constantes.e2e-spec.ts` (créé) | Tests e2e (droits, bornes, isolation, rattachement) |
| `backend/prisma/schema.prisma` (modifié) | Modèle `Constantes` + relations |
| `backend/prisma/migrations/<horodatage>_constantes/` (créé) | Migration |
| `backend/src/prisma/client-filtre.ts` (modifié) | `Constantes` dans `MODELES_CLOISONNES` |
| `backend/src/common/dates/journee.ts` (+ spec) (modifié) | `jourCabinet()` |
| `backend/src/notifications/notifications.service.ts` (+ spec créé) | `notifierConstantesAnormales()` |
| `backend/src/consultations/*` (modifiés) | `constantesId` à la création, prise dans `findOne` |
| `backend/src/app.module.ts`, `backend/test/helpers.ts` (modifiés) | Module, `resetDb` |
| `frontend/src/lib/constantes/seuils.ts` (créé, copie) | Même contenu que le backend |
| `frontend/src/lib/constantes/saisie.ts` (+ test) (créé) | Saisie texte ↔ valeurs, erreurs |
| `frontend/src/lib/constantes/affichage.ts` (+ test) (créé) | Dernières valeurs, résumé, points et repères des courbes |
| `frontend/src/lib/constantes/api.ts` (créé) | Type `Prise`, `useConstantes`, droits, dernière taille |
| `frontend/src/lib/fuseau.ts` (modifié) | `jourCabinet()` |
| `frontend/src/components/constantes/PastilleAlerte.tsx` (créé) | Pastille orange/rouge |
| `frontend/src/components/constantes/FormulaireConstantes.tsx` (+ test) (créé) | Formulaire contrôlé partagé |
| `frontend/src/components/constantes/PriseConstantesModal.tsx` (créé) | Modale création / modification |
| `frontend/src/components/constantes/CourbeConstantes.tsx` (créé) | Courbe Recharts |
| `frontend/src/components/constantes/OngletConstantes.tsx` (+ test) (créé) | Onglet de la fiche patient |
| `frontend/src/components/constantes/ResumeConstantes.tsx` (créé) | Prise affichée dans le détail d'une consultation |
| `frontend/src/app/(dashboard)/patients/[id]/page.tsx` (modifié) | Bouton, onglet, `?onglet=constantes` |
| `frontend/src/app/(dashboard)/consultations/nouvelle/page.tsx` (+ test) (modifié) | Bloc « Constantes » |
| `frontend/src/app/(dashboard)/consultations/[id]/page.tsx` (modifié) | Affiche la prise rattachée |
| `frontend/src/components/layout/NotificationBell.tsx` (modifié) | Lien « Voir les constantes » |
| `e2e/tests/parcours.spec.ts`, `e2e/rapport/generer-rapport.ts` (modifiés) | Étapes de nuit |
| `CLAUDE.md` (modifié) | Documentation |

---

### Task 1 : Seuils et calculs partagés (backend)

**Files:**
- Create: `backend/src/constantes/seuils.ts`
- Test: `backend/src/constantes/seuils.spec.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// backend/src/constantes/seuils.spec.ts
import { ageEnAnnees, calculerImc, evaluerConstantes } from './seuils';

describe('calculerImc', () => {
  it('poids / taille² arrondi au dixième', () => {
    expect(calculerImc(72, 170)).toBe(24.9);
  });
  it('null sans poids ou sans taille', () => {
    expect(calculerImc(72, null)).toBeNull();
    expect(calculerImc(undefined, 170)).toBeNull();
  });
});

describe('ageEnAnnees', () => {
  it('compte les années révolues', () => {
    expect(ageEnAnnees(new Date('2008-11-12'), new Date('2026-11-11'))).toBe(17);
    expect(ageEnAnnees(new Date('2008-11-11'), new Date('2026-11-11'))).toBe(18);
  });
});

describe('evaluerConstantes (adulte)', () => {
  const adulte = 40;

  it('aucune alerte pour des valeurs normales', () => {
    expect(
      evaluerConstantes(
        { tensionSystolique: 120, tensionDiastolique: 80, pouls: 72, spo2: 98, temperature: 37, glycemie: 1, imc: 24 },
        adulte,
      ),
    ).toEqual([]);
  });

  it('tension élevée dès 140/90, critique dès 180/110', () => {
    expect(evaluerConstantes({ tensionSystolique: 140, tensionDiastolique: 80 }, adulte)).toEqual([
      { cle: 'tension', sens: 'elevee', niveau: 'attention', etat: 'élevée', texte: 'tension 140/80 mmHg élevée' },
    ]);
    expect(evaluerConstantes({ tensionSystolique: 130, tensionDiastolique: 110 }, adulte)[0].niveau).toBe('critique');
  });

  it('tension basse sous 90/60', () => {
    expect(evaluerConstantes({ tensionSystolique: 85, tensionDiastolique: 55 }, adulte)[0]).toMatchObject({
      sens: 'basse',
      etat: 'basse',
    });
  });

  it('tension incomplète : pas évaluée', () => {
    expect(evaluerConstantes({ tensionSystolique: 200 }, adulte)).toEqual([]);
  });

  it('accorde le masculin (pouls, IMC)', () => {
    expect(evaluerConstantes({ pouls: 100 }, adulte)[0].texte).toBe('pouls 100 bpm élevé');
    expect(evaluerConstantes({ imc: 17.2 }, adulte)[0].texte).toBe('IMC 17,2 bas');
  });

  it('température : virgule française, seuils 38 et 40', () => {
    expect(evaluerConstantes({ temperature: 39.5 }, adulte)[0]).toMatchObject({
      niveau: 'attention',
      texte: 'température 39,5 °C élevée',
    });
    expect(evaluerConstantes({ temperature: 40 }, adulte)[0].niveau).toBe('critique');
    expect(evaluerConstantes({ temperature: 35.2 }, adulte)[0]).toMatchObject({ sens: 'basse', niveau: 'attention' });
  });

  it('SpO2 basse sous 95, critique sous 90', () => {
    expect(evaluerConstantes({ spo2: 94 }, adulte)[0].niveau).toBe('attention');
    expect(evaluerConstantes({ spo2: 89 }, adulte)[0].niveau).toBe('critique');
  });

  it('glycémie : < 0,7 basse, ≥ 1,26 élevée, ≥ 3 critique', () => {
    expect(evaluerConstantes({ glycemie: 0.65 }, adulte)[0].sens).toBe('basse');
    expect(evaluerConstantes({ glycemie: 1.26 }, adulte)[0].sens).toBe('elevee');
    expect(evaluerConstantes({ glycemie: 3.1 }, adulte)[0].niveau).toBe('critique');
  });
});

describe('evaluerConstantes (enfant)', () => {
  it('ignore tension, pouls et IMC avant 18 ans', () => {
    expect(evaluerConstantes({ tensionSystolique: 150, tensionDiastolique: 95, pouls: 130, imc: 14 }, 8)).toEqual([]);
  });
  it('garde température, SpO2 et glycémie', () => {
    const cles = evaluerConstantes({ temperature: 39, spo2: 92, glycemie: 0.5 }, 8).map((a) => a.cle);
    expect(cles).toEqual(['spo2', 'temperature', 'glycemie']);
  });
});
```

- [ ] **Step 2 : Lancer le test, il échoue**

Run: `cd backend && npx jest src/constantes/seuils.spec.ts`
Expected: FAIL, `Cannot find module './seuils'`.

- [ ] **Step 3 : Écrire `seuils.ts`**

```ts
// backend/src/constantes/seuils.ts
// Constantes médicales : champs, bornes de saisie et seuils d'alerte.
// Fichier identique dans backend/src/constantes/seuils.ts et frontend/src/lib/constantes/seuils.ts :
// un test du backend vérifie que les deux copies ne divergent pas. Aucun import.

export const CHAMPS = {
  tensionSystolique: { libelle: 'Tension haute (systolique)', unite: 'mmHg', min: 50, max: 260, entier: true },
  tensionDiastolique: { libelle: 'Tension basse (diastolique)', unite: 'mmHg', min: 30, max: 160, entier: true },
  pouls: { libelle: 'Pouls', unite: 'bpm', min: 20, max: 250, entier: true },
  spo2: { libelle: 'SpO2', unite: '%', min: 50, max: 100, entier: true },
  temperature: { libelle: 'Température', unite: '°C', min: 30, max: 45, entier: false },
  poids: { libelle: 'Poids', unite: 'kg', min: 0.3, max: 400, entier: false },
  taille: { libelle: 'Taille', unite: 'cm', min: 20, max: 250, entier: false },
  glycemie: { libelle: 'Glycémie', unite: 'g/L', min: 0.1, max: 6, entier: false },
  perimetreCranien: { libelle: 'Périmètre crânien', unite: 'cm', min: 20, max: 70, entier: false },
  tourDeTaille: { libelle: 'Tour de taille', unite: 'cm', min: 30, max: 250, entier: false },
} as const;

export type ChampMesure = keyof typeof CHAMPS;
export const CHAMPS_MESURE = Object.keys(CHAMPS) as ChampMesure[];
export type ValeursConstantes = Partial<Record<ChampMesure, number | null>>;

// « haute » et « critiqueHaute » : alerte dès le seuil (≥) ; « basse » et « critiqueBasse » : sous le seuil (<)
export interface Seuil {
  basse?: number;
  critiqueBasse?: number;
  haute?: number;
  critiqueHaute?: number;
}

export type CleSeuil = 'tensionSystolique' | 'tensionDiastolique' | 'pouls' | 'spo2' | 'temperature' | 'glycemie' | 'imc';

// Seuils adultes
export const SEUILS: Record<CleSeuil, Seuil> = {
  tensionSystolique: { basse: 90, haute: 140, critiqueHaute: 180 },
  tensionDiastolique: { basse: 60, haute: 90, critiqueHaute: 110 },
  pouls: { basse: 50, haute: 100, critiqueBasse: 40, critiqueHaute: 130 },
  spo2: { basse: 95, critiqueBasse: 90 },
  temperature: { basse: 35.5, haute: 38, critiqueBasse: 35, critiqueHaute: 40 },
  glycemie: { basse: 0.7, haute: 1.26, critiqueBasse: 0.5, critiqueHaute: 3 },
  imc: { basse: 18.5, haute: 30 },
};

// Seuils valables à tout âge ; les autres ne s'appliquent qu'à partir de 18 ans
const TOUT_AGE: CleSeuil[] = ['spo2', 'temperature', 'glycemie'];

export type CleAlerte = 'tension' | 'pouls' | 'spo2' | 'temperature' | 'glycemie' | 'imc';
export type Sens = 'basse' | 'elevee';
export type Niveau = 'attention' | 'critique';

export interface AlerteConstante {
  cle: CleAlerte;
  sens: Sens;
  niveau: Niveau;
  etat: string; // « élevée », « bas »…
  texte: string; // « tension 160/100 mmHg élevée »
}

interface Classement {
  sens: Sens;
  niveau: Niveau;
}

function classer(valeur: number, s: Seuil): Classement | null {
  if (s.critiqueHaute !== undefined && valeur >= s.critiqueHaute) return { sens: 'elevee', niveau: 'critique' };
  if (s.critiqueBasse !== undefined && valeur < s.critiqueBasse) return { sens: 'basse', niveau: 'critique' };
  if (s.haute !== undefined && valeur >= s.haute) return { sens: 'elevee', niveau: 'attention' };
  if (s.basse !== undefined && valeur < s.basse) return { sens: 'basse', niveau: 'attention' };
  return null;
}

function plusGrave(a: Classement | null, b: Classement | null): Classement | null {
  if (!a) return b;
  if (!b) return a;
  if (a.niveau !== b.niveau) return a.niveau === 'critique' ? a : b;
  return a.sens === 'elevee' ? a : b;
}

const fr = (n: number) => String(n).replace('.', ',');

type ValeursEvaluees = ValeursConstantes & { imc?: number | null };

const PRESENTATION: Record<CleAlerte, { feminin: boolean; texte: (v: ValeursEvaluees) => string }> = {
  tension: { feminin: true, texte: (v) => `tension ${v.tensionSystolique}/${v.tensionDiastolique} mmHg` },
  pouls: { feminin: false, texte: (v) => `pouls ${v.pouls} bpm` },
  spo2: { feminin: true, texte: (v) => `SpO2 ${v.spo2} %` },
  temperature: { feminin: true, texte: (v) => `température ${fr(v.temperature as number)} °C` },
  glycemie: { feminin: true, texte: (v) => `glycémie ${fr(v.glycemie as number)} g/L` },
  imc: { feminin: false, texte: (v) => `IMC ${fr(v.imc as number)}` },
};

const estNombre = (n: number | null | undefined): n is number => typeof n === 'number';

/** Valeurs anormales d'une prise, pour un patient de l'âge donné (en années) */
export function evaluerConstantes(v: ValeursEvaluees, age: number): AlerteConstante[] {
  const applicable = (c: CleSeuil) => age >= 18 || TOUT_AGE.includes(c);
  const resultats: [CleAlerte, Classement | null][] = [];

  if (estNombre(v.tensionSystolique) && estNombre(v.tensionDiastolique) && applicable('tensionSystolique')) {
    resultats.push([
      'tension',
      plusGrave(
        classer(v.tensionSystolique, SEUILS.tensionSystolique),
        classer(v.tensionDiastolique, SEUILS.tensionDiastolique),
      ),
    ]);
  }
  for (const c of ['pouls', 'spo2', 'temperature', 'glycemie', 'imc'] as const) {
    const valeur = v[c];
    if (estNombre(valeur) && applicable(c)) resultats.push([c, classer(valeur, SEUILS[c])]);
  }

  const alertes: AlerteConstante[] = [];
  for (const [cle, r] of resultats) {
    if (!r) continue;
    const p = PRESENTATION[cle];
    const etat = r.sens === 'elevee' ? (p.feminin ? 'élevée' : 'élevé') : p.feminin ? 'basse' : 'bas';
    alertes.push({ cle, sens: r.sens, niveau: r.niveau, etat, texte: `${p.texte(v)} ${etat}` });
  }
  return alertes;
}

/** IMC arrondi au dixième, ou null s'il manque le poids ou la taille (en cm) */
export function calculerImc(poids?: number | null, tailleCm?: number | null): number | null {
  if (!poids || !tailleCm) return null;
  const m = tailleCm / 100;
  return Math.round((poids / (m * m)) * 10) / 10;
}

/** Âge en années révolues à une date donnée */
export function ageEnAnnees(dateNaissance: string | Date, le: Date = new Date()): number {
  const n = new Date(dateNaissance);
  let age = le.getUTCFullYear() - n.getUTCFullYear();
  const mois = le.getUTCMonth() - n.getUTCMonth();
  if (mois < 0 || (mois === 0 && le.getUTCDate() < n.getUTCDate())) age--;
  return age;
}
```

- [ ] **Step 4 : Lancer le test, il passe**

Run: `cd backend && npx jest src/constantes/seuils.spec.ts`
Expected: PASS (tous les tests).

- [ ] **Step 5 : Commit**

```bash
git add backend/src/constantes/seuils.ts backend/src/constantes/seuils.spec.ts
git commit -m "feat: vital signs thresholds and BMI calculation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Jour civil du cabinet (`jourCabinet`)

**Files:**
- Modify: `backend/src/common/dates/journee.ts` (ajout en fin de fichier)
- Test: `backend/src/common/dates/journee.spec.ts` (ajout)

- [ ] **Step 1 : Ajouter le test** à la fin de `journee.spec.ts` (ajouter `jourCabinet` à l'import existant de `./journee`) :

```ts
describe('jourCabinet', () => {
  it('donne la date AAAA-MM-JJ dans le fuseau demandé', () => {
    const instant = new Date('2026-11-10T23:30:00Z');
    expect(jourCabinet(instant, 'UTC')).toBe('2026-11-10');
    expect(jourCabinet(instant, 'Asia/Tokyo')).toBe('2026-11-11');
  });
});
```

- [ ] **Step 2 : Lancer, il échoue**

Run: `cd backend && npx jest src/common/dates/journee.spec.ts`
Expected: FAIL, `jourCabinet is not a function` (ou erreur de type à l'import).

- [ ] **Step 3 : Implémenter** (fin de `journee.ts`) :

```ts
// Date civile AAAA-MM-JJ d'un instant dans le fuseau du cabinet (« aujourd'hui » au cabinet)
export function jourCabinet(instant: Date = new Date(), fuseau: string = FUSEAU_CABINET): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}
```

- [ ] **Step 4 : Lancer, il passe**

Run: `cd backend && npx jest src/common/dates/journee.spec.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/common/dates/journee.ts backend/src/common/dates/journee.spec.ts
git commit -m "feat: helper for today's date in the cabinet time zone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Modèle Prisma, migration, cloisonnement

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<horodatage>_constantes/migration.sql` (généré)
- Modify: `backend/src/prisma/client-filtre.ts:4-17`
- Modify: `backend/test/helpers.ts` (`resetDb`)

- [ ] **Step 1 : Ajouter le modèle** à la fin de `schema.prisma` :

```prisma
model Constantes {
  id                 String   @id @default(uuid())
  cabinetId          String
  patientId          String
  consultationId     String?  @unique
  priseParId         String
  datePrise          DateTime @default(now())
  tensionSystolique  Int?
  tensionDiastolique Int?
  pouls              Int?
  spo2               Int?
  temperature        Float?
  poids              Float?
  taille             Float?
  glycemie           Float?
  perimetreCranien   Float?
  tourDeTaille       Float?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  cabinet      Cabinet       @relation(fields: [cabinetId], references: [id])
  patient      Patient       @relation(fields: [patientId], references: [id])
  consultation Consultation? @relation(fields: [consultationId], references: [id])
  prisePar     User          @relation("ConstantesPrisePar", fields: [priseParId], references: [id])

  @@index([cabinetId, patientId, datePrise])
  @@map("constantes")
}
```

Et les relations inverses :
- dans `model Cabinet`, après `auditLogs       AuditLog[]` : `constantes      Constantes[]`
- dans `model Patient`, après `notifications Notification[]` : `constantes    Constantes[]`
- dans `model Consultation`, après `paiements   Paiement[]` : `constantes  Constantes?`
- dans `model User`, après `notifications Notification[]` : `constantesPrises Constantes[] @relation("ConstantesPrisePar")`

- [ ] **Step 2 : Créer la migration sans l'appliquer**

```bash
cd backend && npx prisma migrate dev --name constantes --create-only
```
Expected : un dossier `prisma/migrations/<horodatage>_constantes/` avec `CREATE TABLE "constantes"`, l'index unique sur `consultationId`, l'index `(cabinetId, patientId, datePrise)` et 4 clés étrangères. **Si Prisma propose de réinitialiser la base (« reset »), répondre non et s'arrêter** : signaler la dérive au lieu de perdre les données locales.

- [ ] **Step 3 : Appliquer la migration** à la base locale puis à la base de test

```bash
cd backend && npx prisma migrate deploy && npx prisma generate
DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npx prisma migrate deploy
```
Expected : « 1 migration applied » (deux fois), client régénéré.

- [ ] **Step 4 : Cloisonner le modèle** — dans `client-filtre.ts`, ajouter `'Constantes',` dans `MODELES_CLOISONNES` après `'AuditLog',`.

- [ ] **Step 5 : Vider la table dans les tests e2e** — dans `test/helpers.ts`, `resetDb`, mettre `'constantes',` en **première** position du tableau `tables` (elle référence consultations, patients et users).

- [ ] **Step 6 : Vérifier le test de cloisonnement**

Run: `cd backend && npx jest src/prisma`
Expected: PASS (le test « tous les modèles avec cabinetId sont cloisonnés » passe grâce au Step 4).

- [ ] **Step 7 : Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/prisma/client-filtre.ts backend/test/helpers.ts
git commit -m "feat: Constantes model, scoped to the cabinet

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Règles métier pures (`regles.ts`)

**Files:**
- Create: `backend/src/constantes/regles.ts`
- Test: `backend/src/constantes/regles.spec.ts`

- [ ] **Step 1 : Écrire le test**

```ts
// backend/src/constantes/regles.spec.ts
import { BadRequestException } from '@nestjs/common';
import { enrichirPrises, peutModifier, verifierDatePrise, verifierMesures } from './regles';

describe('verifierMesures', () => {
  it('refuse une prise sans aucune valeur', () => {
    expect(() => verifierMesures({})).toThrow(new BadRequestException('Aucune constante saisie'));
    expect(() => verifierMesures({ poids: null })).toThrow('Aucune constante saisie');
  });
  it('exige les deux valeurs de la tension', () => {
    expect(() => verifierMesures({ tensionSystolique: 120 })).toThrow('Tension : saisir les deux valeurs');
  });
  it('exige une tension haute supérieure à la basse', () => {
    expect(() => verifierMesures({ tensionSystolique: 80, tensionDiastolique: 120 })).toThrow(
      'Tension : la valeur haute doit dépasser la valeur basse',
    );
  });
  it('accepte une seule valeur', () => {
    expect(() => verifierMesures({ poids: 72 })).not.toThrow();
  });
});

describe('verifierDatePrise', () => {
  const maintenant = new Date('2026-11-11T10:00:00Z');
  it('accepte une date absente ou passée, et 5 minutes d avance', () => {
    expect(() => verifierDatePrise(undefined, maintenant)).not.toThrow();
    expect(() => verifierDatePrise('2026-11-10T10:00:00Z', maintenant)).not.toThrow();
    expect(() => verifierDatePrise('2026-11-11T10:04:00Z', maintenant)).not.toThrow();
  });
  it('refuse une date dans le futur ou avant 1900', () => {
    expect(() => verifierDatePrise('2026-11-11T11:00:00Z', maintenant)).toThrow('dans le futur');
    expect(() => verifierDatePrise('1899-12-31T00:00:00Z', maintenant)).toThrow('Date de prise invalide');
  });
});

describe('peutModifier', () => {
  const maintenant = new Date('2026-11-11T15:00:00Z');
  const prise = { priseParId: 'sec-1', createdAt: new Date('2026-11-11T09:00:00Z') };
  it('un médecin peut toujours', () => {
    expect(peutModifier({ ...prise, createdAt: new Date('2025-01-01') }, { id: 'dr', role: 'MEDECIN' }, maintenant)).toBe(true);
  });
  it('l auteur le jour même peut', () => {
    expect(peutModifier(prise, { id: 'sec-1', role: 'SECRETAIRE' }, maintenant)).toBe(true);
  });
  it('l auteur le lendemain ne peut plus, une autre secrétaire non plus', () => {
    expect(peutModifier(prise, { id: 'sec-1', role: 'SECRETAIRE' }, new Date('2026-11-12T15:00:00Z'))).toBe(false);
    expect(peutModifier(prise, { id: 'sec-2', role: 'SECRETAIRE' }, maintenant)).toBe(false);
  });
});

describe('enrichirPrises', () => {
  const adulte = new Date('1980-01-01');
  it('calcule l IMC avec la taille de la prise', () => {
    const [p] = enrichirPrises([{ id: 'a', datePrise: new Date('2026-11-11'), poids: 72, taille: 170 }], adulte);
    expect(p.imc).toBe(24.9);
    expect(p.alertes).toEqual([]);
  });
  it('reprend la dernière taille connue chez l adulte', () => {
    const prises = [
      { id: 'recente', datePrise: new Date('2026-11-11'), poids: 95 },
      { id: 'ancienne', datePrise: new Date('2026-01-01'), taille: 170 },
    ];
    const res = enrichirPrises(prises, adulte);
    expect(res.map((p) => p.id)).toEqual(['recente', 'ancienne']); // ordre d'origine conservé
    expect(res[0].imc).toBe(32.9);
    expect(res[0].alertes[0]).toMatchObject({ cle: 'imc', sens: 'elevee' });
  });
  it('ne reprend pas une ancienne taille chez l enfant', () => {
    const prises = [
      { id: 'recente', datePrise: new Date('2026-11-11'), poids: 20 },
      { id: 'ancienne', datePrise: new Date('2026-01-01'), taille: 110 },
    ];
    expect(enrichirPrises(prises, new Date('2020-01-01'))[0].imc).toBeNull();
  });
  it('évalue les alertes à l âge du jour de la prise', () => {
    const [p] = enrichirPrises(
      [{ id: 'a', datePrise: new Date('2026-11-11'), tensionSystolique: 150, tensionDiastolique: 95 }],
      new Date('2010-01-01'),
    );
    expect(p.alertes).toEqual([]); // 16 ans : pas de seuil de tension
  });
});
```

- [ ] **Step 2 : Lancer, il échoue**

Run: `cd backend && npx jest src/constantes/regles.spec.ts`
Expected: FAIL, `Cannot find module './regles'`.

- [ ] **Step 3 : Implémenter**

```ts
// backend/src/constantes/regles.ts
import { BadRequestException } from '@nestjs/common';
import { jourCabinet } from '../common/dates/journee';
import {
  ageEnAnnees,
  type AlerteConstante,
  calculerImc,
  CHAMPS_MESURE,
  evaluerConstantes,
  type ValeursConstantes,
} from './seuils';

const present = (n: number | null | undefined): n is number => n !== undefined && n !== null;

/** Une prise contient au moins une valeur ; la tension va par paire, haute > basse */
export function verifierMesures(m: ValeursConstantes): void {
  if (!CHAMPS_MESURE.some((c) => present(m[c]))) throw new BadRequestException('Aucune constante saisie');
  const haute = m.tensionSystolique;
  const basse = m.tensionDiastolique;
  if (present(haute) !== present(basse)) {
    throw new BadRequestException('Tension : saisir les deux valeurs (haute et basse)');
  }
  if (present(haute) && present(basse) && haute <= basse) {
    throw new BadRequestException('Tension : la valeur haute doit dépasser la valeur basse');
  }
}

/** Date de prise : ni dans le futur (5 min de tolérance), ni avant 1900 */
export function verifierDatePrise(iso: string | undefined, maintenant: Date = new Date()): void {
  if (!iso) return;
  const t = new Date(iso).getTime();
  if (t > maintenant.getTime() + 5 * 60_000) {
    throw new BadRequestException('La date de prise ne peut pas être dans le futur');
  }
  if (t < Date.UTC(1900, 0, 1)) throw new BadRequestException('Date de prise invalide');
}

/** Un médecin modifie toujours ; l'auteur de la prise, le jour même (heure du cabinet) */
export function peutModifier(
  prise: { priseParId: string; createdAt: Date },
  user: { id: string; role: string },
  maintenant: Date = new Date(),
): boolean {
  if (user.role === 'MEDECIN') return true;
  return prise.priseParId === user.id && jourCabinet(prise.createdAt) === jourCabinet(maintenant);
}

/** Les valeurs de mesure d'une ligne, sans les autres champs */
export function valeursDe(prise: ValeursConstantes): ValeursConstantes {
  return Object.fromEntries(CHAMPS_MESURE.map((c) => [c, prise[c] ?? null])) as ValeursConstantes;
}

export type PriseBrute = { id: string; datePrise: Date } & ValeursConstantes;
export type PriseEnrichie<T> = T & { imc: number | null; alertes: AlerteConstante[] };

/**
 * Ajoute l'IMC et les alertes à chaque prise (ordre d'origine conservé).
 * Sans taille dans la prise, l'IMC d'un adulte utilise la dernière taille mesurée avant elle.
 */
export function enrichirPrises<T extends PriseBrute>(prises: T[], dateNaissance: Date): PriseEnrichie<T>[] {
  const chronologique = [...prises].sort((a, b) => a.datePrise.getTime() - b.datePrise.getTime());
  const calculs = new Map<string, { imc: number | null; alertes: AlerteConstante[] }>();
  let derniereTaille: number | null = null;
  for (const p of chronologique) {
    if (present(p.taille)) derniereTaille = p.taille;
    const age = ageEnAnnees(dateNaissance, p.datePrise);
    const taille = present(p.taille) ? p.taille : age >= 18 ? derniereTaille : null;
    const imc = calculerImc(p.poids, taille);
    calculs.set(p.id, { imc, alertes: evaluerConstantes({ ...valeursDe(p), imc }, age) });
  }
  return prises.map((p) => ({ ...p, ...calculs.get(p.id)! }));
}
```

- [ ] **Step 4 : Lancer, il passe**

Run: `cd backend && npx jest src/constantes/regles.spec.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/constantes/regles.ts backend/src/constantes/regles.spec.ts
git commit -m "feat: business rules for vital signs (empty entry, blood pressure pair, edit rights, BMI)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Notification des constantes anormales

**Files:**
- Modify: `backend/src/notifications/notifications.service.ts`
- Test: `backend/src/notifications/notifications.service.spec.ts` (créé)

- [ ] **Step 1 : Écrire le test**

```ts
// backend/src/notifications/notifications.service.spec.ts
import { Role, StatutRDV } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import type { AlerteConstante } from '../constantes/seuils';

jest.mock('../prisma/contexte-cabinet', () => ({ cabinetCourant: () => 'cabinet-test' }));

const prisma = {
  rendezVous: { findMany: jest.fn() },
  user: { findMany: jest.fn() },
  notification: { createMany: jest.fn() },
};
const service = new NotificationsService(prisma as any);
const patient = { id: 'p1', prenom: 'Ahmed', nom: 'Tazi' };
const alertes: AlerteConstante[] = [
  { cle: 'tension', sens: 'elevee', niveau: 'attention', etat: 'élevée', texte: 'tension 160/100 mmHg élevée' },
  { cle: 'temperature', sens: 'elevee', niveau: 'attention', etat: 'élevée', texte: 'température 39,5 °C élevée' },
];

beforeEach(() => jest.clearAllMocks());

describe('notifierConstantesAnormales', () => {
  it('prévient le médecin du rendez-vous du jour', async () => {
    prisma.rendezVous.findMany.mockResolvedValue([{ medecinId: 'dr-1' }, { medecinId: 'dr-1' }]);
    await service.notifierConstantesAnormales(patient, alertes);

    expect(prisma.rendezVous.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ patientId: 'p1', statut: { not: StatutRDV.ANNULE } }),
      }),
    );
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'dr-1',
          cabinetId: 'cabinet-test',
          type: 'CONSTANTES_ANORMALES',
          patientId: 'p1',
          message:
            'Constantes anormales — Ahmed Tazi : tension 160/100 mmHg élevée, température 39,5 °C élevée',
        },
      ],
    });
  });

  it('sans rendez-vous, prévient tous les médecins actifs', async () => {
    prisma.rendezVous.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([{ id: 'dr-1' }, { id: 'dr-2' }]);
    await service.notifierConstantesAnormales(patient, alertes);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.MEDECIN, actif: true },
      select: { id: true },
    });
    expect(prisma.notification.createMany.mock.calls[0][0].data.map((n: any) => n.userId)).toEqual(['dr-1', 'dr-2']);
  });

  it('aucune alerte : rien', async () => {
    await service.notifierConstantesAnormales(patient, []);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : Lancer, il échoue**

Run: `cd backend && npx jest src/notifications`
Expected: FAIL, `service.notifierConstantesAnormales is not a function`.

- [ ] **Step 3 : Implémenter** — dans `notifications.service.ts` :

Remplacer l'import `import { Role } from '@prisma/client';` par :

```ts
import { Role, StatutRDV } from '@prisma/client';
import { jourCabinet, journeeEnUtc } from '../common/dates/journee';
import type { AlerteConstante } from '../constantes/seuils';
```

Ajouter la méthode après `notifySecretaires` :

```ts
  /**
   * Constantes anormales saisies par la secrétaire : le médecin du rendez-vous du jour
   * est prévenu, ou à défaut tous les médecins actifs du cabinet.
   */
  async notifierConstantesAnormales(
    patient: { id: string; prenom: string; nom: string },
    alertes: AlerteConstante[],
  ) {
    if (!alertes.length) return;
    const { debut, fin } = journeeEnUtc(jourCabinet());
    const rdv = await this.prisma.rendezVous.findMany({
      where: { patientId: patient.id, dateHeure: { gte: debut, lt: fin }, statut: { not: StatutRDV.ANNULE } },
      select: { medecinId: true },
    });
    let destinataires = [...new Set(rdv.map((r) => r.medecinId))];
    if (!destinataires.length) {
      const medecins = await this.prisma.user.findMany({
        where: { role: Role.MEDECIN, actif: true },
        select: { id: true },
      });
      destinataires = medecins.map((m) => m.id);
    }
    if (!destinataires.length) return;

    const message = `Constantes anormales — ${patient.prenom} ${patient.nom} : ${alertes.map((a) => a.texte).join(', ')}`;
    await this.prisma.notification.createMany({
      data: destinataires.map((userId) => ({
        userId,
        cabinetId: cabinetCourant(),
        type: 'CONSTANTES_ANORMALES',
        patientId: patient.id,
        message,
      })),
    });
  }
```

- [ ] **Step 4 : Lancer, il passe**

Run: `cd backend && npx jest src/notifications`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/notifications
git commit -m "feat: notify the doctor when a secretary records abnormal vital signs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : DTO et service `ConstantesService`

**Files:**
- Create: `backend/src/constantes/dto/create-constantes.dto.ts`, `backend/src/constantes/dto/update-constantes.dto.ts`
- Create: `backend/src/constantes/constantes.service.ts`
- Test: `backend/src/constantes/constantes.service.spec.ts`

- [ ] **Step 1 : Écrire les DTO**

```ts
// backend/src/constantes/dto/create-constantes.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CHAMPS, type ChampMesure } from '../seuils';

const fr = (n: number) => String(n).replace('.', ',');
// Message français commun aux contrôles d'un champ (type, minimum, maximum)
const hors = (c: ChampMesure) => ({
  message: `${CHAMPS[c].libelle} : entre ${fr(CHAMPS[c].min)} et ${fr(CHAMPS[c].max)} ${CHAMPS[c].unite}`,
});
const DECIMALES = { maxDecimalPlaces: 2 };

export class CreateConstantesDto {
  @ApiProperty() @IsString() patientId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() consultationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() datePrise?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt(hors('tensionSystolique'))
  @Min(CHAMPS.tensionSystolique.min, hors('tensionSystolique')) @Max(CHAMPS.tensionSystolique.max, hors('tensionSystolique'))
  tensionSystolique?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt(hors('tensionDiastolique'))
  @Min(CHAMPS.tensionDiastolique.min, hors('tensionDiastolique')) @Max(CHAMPS.tensionDiastolique.max, hors('tensionDiastolique'))
  tensionDiastolique?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt(hors('pouls'))
  @Min(CHAMPS.pouls.min, hors('pouls')) @Max(CHAMPS.pouls.max, hors('pouls'))
  pouls?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt(hors('spo2'))
  @Min(CHAMPS.spo2.min, hors('spo2')) @Max(CHAMPS.spo2.max, hors('spo2'))
  spo2?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber(DECIMALES, hors('temperature'))
  @Min(CHAMPS.temperature.min, hors('temperature')) @Max(CHAMPS.temperature.max, hors('temperature'))
  temperature?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber(DECIMALES, hors('poids'))
  @Min(CHAMPS.poids.min, hors('poids')) @Max(CHAMPS.poids.max, hors('poids'))
  poids?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber(DECIMALES, hors('taille'))
  @Min(CHAMPS.taille.min, hors('taille')) @Max(CHAMPS.taille.max, hors('taille'))
  taille?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber(DECIMALES, hors('glycemie'))
  @Min(CHAMPS.glycemie.min, hors('glycemie')) @Max(CHAMPS.glycemie.max, hors('glycemie'))
  glycemie?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber(DECIMALES, hors('perimetreCranien'))
  @Min(CHAMPS.perimetreCranien.min, hors('perimetreCranien')) @Max(CHAMPS.perimetreCranien.max, hors('perimetreCranien'))
  perimetreCranien?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber(DECIMALES, hors('tourDeTaille'))
  @Min(CHAMPS.tourDeTaille.min, hors('tourDeTaille')) @Max(CHAMPS.tourDeTaille.max, hors('tourDeTaille'))
  tourDeTaille?: number;
}
```

Note : les propriétés sont typées `number` (pas `number | null`) pour que `enableImplicitConversion` voie un `Number`. Un `null` envoyé en modification passe quand même (`IsOptional` ignore `null`) et vide le champ.

```ts
// backend/src/constantes/dto/update-constantes.dto.ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateConstantesDto } from './create-constantes.dto';

// Le patient et la consultation d'une prise ne changent pas ; une valeur à null vide le champ
export class UpdateConstantesDto extends PartialType(
  OmitType(CreateConstantesDto, ['patientId', 'consultationId'] as const),
) {}
```

- [ ] **Step 2 : Écrire le test du service**

```ts
// backend/src/constantes/constantes.service.spec.ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConstantesService } from './constantes.service';

jest.mock('../prisma/contexte-cabinet', () => ({ cabinetCourant: () => 'cabinet-test' }));

const prisma = {
  patient: { findUnique: jest.fn() },
  consultation: { findUnique: jest.fn() },
  constantes: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
const references = { verifier: jest.fn() };
const audit = { log: jest.fn() };
const notifications = { notifierConstantesAnormales: jest.fn() };
const service = new ConstantesService(prisma as any, references as any, audit as any, notifications as any);

const secretaire = { id: 'sec-1', role: 'SECRETAIRE' };
const medecin = { id: 'dr-1', role: 'MEDECIN' };
const patient = { id: 'p1', prenom: 'Ahmed', nom: 'Tazi', dateNaissance: new Date('1980-01-01') };

function ligne(champs: Record<string, unknown> = {}) {
  return {
    id: 'k1',
    patientId: 'p1',
    consultationId: null,
    priseParId: 'sec-1',
    datePrise: new Date(),
    createdAt: new Date(),
    patient,
    prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
    consultation: null,
    ...champs,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.constantes.findFirst.mockResolvedValue(null);
  notifications.notifierConstantesAnormales.mockResolvedValue(undefined);
});

describe('create', () => {
  it('enregistre la prise au nom de l utilisateur connecté', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ poids: 72, taille: 170 }));
    const res = await service.create({ patientId: 'p1', poids: 72, taille: 170 }, secretaire);

    expect(references.verifier).toHaveBeenCalledWith({ patientId: 'p1', consultationId: undefined });
    expect(prisma.constantes.create.mock.calls[0][0].data).toMatchObject({
      patientId: 'p1',
      priseParId: 'sec-1',
      cabinetId: 'cabinet-test',
      poids: 72,
      taille: 170,
    });
    expect(res.imc).toBe(24.9);
    expect(audit.log).toHaveBeenCalledWith('sec-1', 'CREATE_CONSTANTES', 'Constantes', 'k1');
  });

  it('refuse une prise vide sans écrire', async () => {
    await expect(service.create({ patientId: 'p1' }, secretaire)).rejects.toThrow(BadRequestException);
    expect(prisma.constantes.create).not.toHaveBeenCalled();
  });

  it('refuse une consultation d un autre patient', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ patientId: 'autre' });
    await expect(
      service.create({ patientId: 'p1', consultationId: 'c1', poids: 70 }, medecin),
    ).rejects.toThrow('Cette consultation ne concerne pas ce patient');
  });

  it('consultation déjà pourvue : 400', async () => {
    prisma.consultation.findUnique.mockResolvedValue({ patientId: 'p1' });
    prisma.constantes.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(
      service.create({ patientId: 'p1', consultationId: 'c1', poids: 70 }, medecin),
    ).rejects.toThrow('Cette consultation a déjà des constantes');
  });

  it('secrétaire + valeur anormale : le médecin est prévenu', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 39.5 }));
    await service.create({ patientId: 'p1', temperature: 39.5 }, secretaire);
    expect(notifications.notifierConstantesAnormales).toHaveBeenCalledWith(
      { id: 'p1', prenom: 'Ahmed', nom: 'Tazi' },
      [expect.objectContaining({ cle: 'temperature' })],
    );
  });

  it('médecin ou valeurs normales : aucune notification', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 39.5 }));
    await service.create({ patientId: 'p1', temperature: 39.5 }, medecin);
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 37 }));
    await service.create({ patientId: 'p1', temperature: 37 }, secretaire);
    expect(notifications.notifierConstantesAnormales).not.toHaveBeenCalled();
  });

  it('une notification en échec n empêche pas l enregistrement', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ temperature: 39.5 }));
    notifications.notifierConstantesAnormales.mockRejectedValue(new Error('panne'));
    await expect(service.create({ patientId: 'p1', temperature: 39.5 }, secretaire)).resolves.toMatchObject({ id: 'k1' });
  });

  it('IMC avec la dernière taille connue', async () => {
    prisma.constantes.create.mockResolvedValue(ligne({ poids: 72 }));
    prisma.constantes.findFirst.mockResolvedValue({ id: 'k0', datePrise: new Date('2026-01-01'), taille: 170 });
    const res = await service.create({ patientId: 'p1', poids: 72 }, medecin);
    expect(res.imc).toBe(24.9);
  });
});

describe('findByPatient', () => {
  it('404 si le patient n est pas du cabinet', async () => {
    prisma.patient.findUnique.mockResolvedValue(null);
    await expect(service.findByPatient('p-b')).rejects.toThrow(NotFoundException);
  });
  it('liste enrichie, de la plus récente à la plus ancienne', async () => {
    prisma.patient.findUnique.mockResolvedValue({ dateNaissance: patient.dateNaissance });
    prisma.constantes.findMany.mockResolvedValue([ligne({ spo2: 92 })]);
    const res = await service.findByPatient('p1');
    expect(prisma.constantes.findMany.mock.calls[0][0].orderBy).toEqual({ datePrise: 'desc' });
    expect(res[0].alertes[0].cle).toBe('spo2');
  });
});

describe('duJour', () => {
  it('prise du jour sans consultation, ou null', async () => {
    prisma.patient.findUnique.mockResolvedValue({ dateNaissance: patient.dateNaissance });
    prisma.constantes.findFirst.mockResolvedValue(null);
    await expect(service.duJour('p1')).resolves.toEqual({ prise: null });
    expect(prisma.constantes.findFirst.mock.calls[0][0].where).toMatchObject({ patientId: 'p1', consultationId: null });
  });
});

describe('update', () => {
  it('l auteur le lendemain : 403', async () => {
    prisma.constantes.findUnique.mockResolvedValue(
      ligne({ poids: 70, createdAt: new Date(Date.now() - 2 * 86_400_000) }),
    );
    await expect(service.update('k1', { poids: 71 }, secretaire)).rejects.toThrow(ForbiddenException);
  });
  it('refuse de vider la dernière valeur', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    await expect(service.update('k1', { poids: null as unknown as number }, medecin)).rejects.toThrow(
      'Aucune constante saisie',
    );
  });
  it('un médecin modifie, audit avec le détail', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    prisma.constantes.update.mockResolvedValue(ligne({ poids: 71 }));
    await service.update('k1', { poids: 71 }, medecin);
    expect(prisma.constantes.update.mock.calls[0][0]).toMatchObject({ where: { id: 'k1' }, data: { poids: 71 } });
    expect(audit.log).toHaveBeenCalledWith('dr-1', 'UPDATE_CONSTANTES', 'Constantes', 'k1', { poids: 71 });
  });
  it('prise introuvable : 404', async () => {
    prisma.constantes.findUnique.mockResolvedValue(null);
    await expect(service.update('k9', { poids: 71 }, medecin)).rejects.toThrow(NotFoundException);
  });
});

describe('remove', () => {
  it('une autre secrétaire : 403', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    await expect(service.remove('k1', { id: 'sec-2', role: 'SECRETAIRE' })).rejects.toThrow(ForbiddenException);
    expect(prisma.constantes.delete).not.toHaveBeenCalled();
  });
  it('un médecin supprime', async () => {
    prisma.constantes.findUnique.mockResolvedValue(ligne({ poids: 70 }));
    await expect(service.remove('k1', medecin)).resolves.toEqual({ supprime: true });
    expect(audit.log).toHaveBeenCalledWith('dr-1', 'DELETE_CONSTANTES', 'Constantes', 'k1');
  });
});
```

- [ ] **Step 3 : Lancer, il échoue**

Run: `cd backend && npx jest src/constantes/constantes.service.spec.ts`
Expected: FAIL, `Cannot find module './constantes.service'`.

- [ ] **Step 4 : Implémenter le service**

```ts
// backend/src/constantes/constantes.service.ts
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReferencesService } from '../prisma/references.service';
import { cabinetCourant } from '../prisma/contexte-cabinet';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { jourCabinet, journeeEnUtc } from '../common/dates/journee';
import { CreateConstantesDto } from './dto/create-constantes.dto';
import { UpdateConstantesDto } from './dto/update-constantes.dto';
import {
  enrichirPrises,
  peutModifier,
  type PriseBrute,
  type PriseEnrichie,
  valeursDe,
  verifierDatePrise,
  verifierMesures,
} from './regles';

export interface Auteur {
  id: string;
  role: Role | string;
}

const INCLURE = {
  prisePar: { select: { id: true, prenom: true, nom: true, role: true } },
  patient: { select: { id: true, prenom: true, nom: true, dateNaissance: true } },
  consultation: { select: { id: true, dateConsultation: true } },
} as const;

type Ligne = PriseBrute & {
  patientId: string;
  priseParId: string;
  createdAt: Date;
  patient: { id: string; prenom: string; nom: string; dateNaissance: Date };
};

@Injectable()
export class ConstantesService {
  private readonly logger = new Logger(ConstantesService.name);

  constructor(
    private prisma: PrismaService,
    private references: ReferencesService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  async create(dto: CreateConstantesDto, auteur: Auteur) {
    const { patientId, consultationId, datePrise, ...mesures } = dto;
    verifierMesures(mesures);
    verifierDatePrise(datePrise);
    await this.references.verifier({ patientId, consultationId });
    if (consultationId) {
      const c = await this.prisma.consultation.findUnique({
        where: { id: consultationId },
        select: { patientId: true },
      });
      if (c?.patientId !== patientId) throw new BadRequestException('Cette consultation ne concerne pas ce patient');
    }

    let prise: Ligne;
    try {
      prise = await this.prisma.constantes.create({
        data: {
          ...mesures,
          patientId,
          consultationId,
          datePrise: datePrise ? new Date(datePrise) : undefined,
          priseParId: auteur.id,
          cabinetId: cabinetCourant(),
        },
        include: INCLURE,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new BadRequestException('Cette consultation a déjà des constantes');
      }
      throw err;
    }

    await this.audit.log(auteur.id, 'CREATE_CONSTANTES', 'Constantes', prise.id);
    const enrichie = await this.enrichir(prise);
    await this.signaler(enrichie, auteur);
    return enrichie;
  }

  async findByPatient(patientId: string) {
    const patient = await this.patientOu404(patientId);
    const prises = await this.prisma.constantes.findMany({
      where: { patientId },
      include: INCLURE,
      orderBy: { datePrise: 'desc' },
    });
    return enrichirPrises(prises, patient.dateNaissance);
  }

  /** Dernière prise du jour (heure du cabinet) pas encore rattachée à une consultation */
  async duJour(patientId: string) {
    await this.patientOu404(patientId);
    const { debut, fin } = journeeEnUtc(jourCabinet());
    const prise = await this.prisma.constantes.findFirst({
      where: { patientId, consultationId: null, datePrise: { gte: debut, lt: fin } },
      include: INCLURE,
      orderBy: { datePrise: 'desc' },
    });
    return { prise: prise ? await this.enrichir(prise) : null };
  }

  async update(id: string, dto: UpdateConstantesDto, auteur: Auteur) {
    const prise = await this.trouver(id);
    this.exigerDroit(prise, auteur);
    const { datePrise, ...mesures } = dto;
    verifierMesures({ ...valeursDe(prise), ...mesures });
    verifierDatePrise(datePrise);

    const maj = await this.prisma.constantes.update({
      where: { id },
      data: { ...mesures, ...(datePrise ? { datePrise: new Date(datePrise) } : {}) },
      include: INCLURE,
    });
    await this.audit.log(auteur.id, 'UPDATE_CONSTANTES', 'Constantes', id, dto);
    const enrichie = await this.enrichir(maj);
    await this.signaler(enrichie, auteur);
    return enrichie;
  }

  async remove(id: string, auteur: Auteur) {
    const prise = await this.trouver(id);
    this.exigerDroit(prise, auteur);
    await this.prisma.constantes.delete({ where: { id } });
    await this.audit.log(auteur.id, 'DELETE_CONSTANTES', 'Constantes', id);
    return { supprime: true };
  }

  private async patientOu404(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { dateNaissance: true },
    });
    if (!patient) throw new NotFoundException('Patient introuvable');
    return patient;
  }

  private async trouver(id: string): Promise<Ligne> {
    const prise = await this.prisma.constantes.findUnique({ where: { id }, include: INCLURE });
    if (!prise) throw new NotFoundException('Constantes introuvables');
    return prise;
  }

  private exigerDroit(prise: Ligne, auteur: Auteur) {
    if (!peutModifier(prise, auteur)) {
      throw new ForbiddenException("Seul un médecin ou l'auteur de la prise, le jour même, peut la modifier");
    }
  }

  /** IMC et alertes d'une prise ; sans taille, l'IMC reprend la dernière taille mesurée avant elle */
  private async enrichir<T extends Ligne>(prise: T): Promise<PriseEnrichie<T>> {
    const avant: PriseBrute[] = [];
    if (prise.poids != null && prise.taille == null) {
      const t = await this.prisma.constantes.findFirst({
        where: { patientId: prise.patientId, taille: { not: null }, datePrise: { lt: prise.datePrise } },
        orderBy: { datePrise: 'desc' },
        select: { id: true, datePrise: true, taille: true },
      });
      if (t) avant.push(t);
    }
    const [enrichie] = enrichirPrises<PriseBrute>([prise, ...avant], prise.patient.dateNaissance);
    return enrichie as PriseEnrichie<T>;
  }

  /** Valeur anormale saisie par la secrétaire : le médecin est prévenu (sans bloquer l'enregistrement) */
  private async signaler(prise: PriseEnrichie<Ligne>, auteur: Auteur) {
    if (auteur.role !== Role.SECRETAIRE || prise.alertes.length === 0) return;
    try {
      const { id, prenom, nom } = prise.patient;
      await this.notifications.notifierConstantesAnormales({ id, prenom, nom }, prise.alertes);
    } catch (err) {
      this.logger.error(`Notification des constantes impossible : ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 5 : Lancer, il passe**

Run: `cd backend && npx jest src/constantes`
Expected: PASS (seuils, regles, service).

- [ ] **Step 6 : Commit**

```bash
git add backend/src/constantes
git commit -m "feat: vital signs service with edit rights, audit and doctor notification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Routes `/constantes` et tests e2e

**Files:**
- Create: `backend/src/constantes/constantes.controller.ts`, `backend/src/constantes/constantes.module.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/test/constantes.e2e-spec.ts`

- [ ] **Step 1 : Contrôleur et module**

```ts
// backend/src/constantes/constantes.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type Auteur, ConstantesService } from './constantes.service';
import { CreateConstantesDto } from './dto/create-constantes.dto';
import { UpdateConstantesDto } from './dto/update-constantes.dto';

@ApiTags('constantes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('constantes')
export class ConstantesController {
  constructor(private service: ConstantesService) {}

  @Post()
  @ApiOperation({ summary: 'Enregistrer une prise de constantes (médecin ou secrétaire)' })
  create(@Body() dto: CreateConstantesDto, @CurrentUser() user: Auteur) {
    return this.service.create(dto, user);
  }

  @Get('patient/:patientId/du-jour')
  @ApiOperation({ summary: 'Prise du jour non rattachée à une consultation' })
  duJour(@Param('patientId') patientId: string) {
    return this.service.duJour(patientId);
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.service.findByPatient(patientId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateConstantesDto, @CurrentUser() user: Auteur) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: Auteur) {
    return this.service.remove(id, user);
  }
}
```

```ts
// backend/src/constantes/constantes.module.ts
import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConstantesController } from './constantes.controller';
import { ConstantesService } from './constantes.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [ConstantesController],
  providers: [ConstantesService],
})
export class ConstantesModule {}
```

Dans `app.module.ts` : `import { ConstantesModule } from './constantes/constantes.module';` et ajouter `ConstantesModule,` dans `imports` après `ConsultationsModule,`.

- [ ] **Step 2 : Écrire le test e2e**

```ts
// backend/test/constantes.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import {
  createApp,
  login,
  loginAdmin,
  resetDb,
  seedCabinet,
  seedTestPatient,
  seedTestSecretaire,
  seedTestUser,
} from './helpers';

describe('Constantes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let medecin: string;
  let secretaire: string;
  let patientId: string;
  let priseB: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await seedTestUser(prisma); // médecin titulaire admin@cabinet.ma (test-admin-id)
    await seedTestSecretaire(prisma);
    patientId = await seedTestPatient(prisma);
    medecin = await loginAdmin(app);
    secretaire = (await login(app, 'secretaire@cabinet.ma', 'Secretaire123!')).accessToken;

    // Un autre cabinet, avec une prise
    const cabinetB = await seedCabinet(prisma, 'cabinet-b');
    await prisma.user.create({
      data: {
        id: 'b-medecin',
        email: 'b.medecin@cabinet.ma',
        motDePasse: await argon2.hash('Medecin123!'),
        nom: 'B',
        prenom: 'Medecin',
        role: Role.MEDECIN,
        cabinetId: cabinetB,
      },
    });
    await prisma.patient.create({
      data: {
        id: 'b-patient',
        cabinetId: cabinetB,
        nom: 'Patient',
        prenom: 'B',
        dateNaissance: new Date('1980-01-01'),
        sexe: 'FEMININ',
        telephone: '0671234568',
      },
    });
    priseB = (
      await prisma.constantes.create({
        data: { cabinetId: cabinetB, patientId: 'b-patient', priseParId: 'b-medecin', poids: 60 },
      })
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 sans jeton', async () => {
    expect((await api().get(`/api/constantes/patient/${patientId}`)).status).toBe(401);
  });

  it('la secrétaire enregistre une fièvre : prise à son nom, alerte, médecin prévenu', async () => {
    const res = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ patientId, temperature: 39.5, poids: 72, taille: 170 });

    expect(res.status).toBe(201);
    expect(res.body.priseParId).toBe('test-secretaire-id');
    expect(res.body.imc).toBe(24.9);
    expect(res.body.alertes).toEqual([expect.objectContaining({ cle: 'temperature', etat: 'élevée' })]);

    const notifs = await prisma.notification.findMany({ where: { type: 'CONSTANTES_ANORMALES' } });
    expect(notifs.map((n) => n.userId)).toEqual(['test-admin-id']);
    expect(notifs[0].message).toBe('Constantes anormales — Ahmed Tazi : température 39,5 °C élevée');
  });

  it('400 : valeur hors bornes, en français', async () => {
    const res = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ patientId, temperature: 375 });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.message)).toContain('Température : entre 30 et 45 °C');
  });

  it('400 : tension incomplète, prise vide', async () => {
    const auth = { Authorization: `Bearer ${secretaire}` };
    expect((await api().post('/api/constantes').set(auth).send({ patientId, tensionSystolique: 120 })).status).toBe(400);
    expect((await api().post('/api/constantes').set(auth).send({ patientId })).status).toBe(400);
  });

  it('du-jour puis rattachement à la consultation', async () => {
    const duJour = await api()
      .get(`/api/constantes/patient/${patientId}/du-jour`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(duJour.status).toBe(200);
    const constantesId = duJour.body.prise.id;

    const consultation = await api()
      .post('/api/consultations')
      .set('Authorization', `Bearer ${medecin}`)
      .send({ patientId, medecinId: 'test-admin-id', motif: 'Fièvre', constantesId });
    expect(consultation.status).toBe(201);
    const ligne = await prisma.constantes.findUnique({ where: { id: constantesId } });
    expect(ligne?.consultationId).toBe(consultation.body.id);

    const encore = await api()
      .post('/api/consultations')
      .set('Authorization', `Bearer ${medecin}`)
      .send({ patientId, medecinId: 'test-admin-id', constantesId });
    expect(encore.status).toBe(400);

    const apres = await api()
      .get(`/api/constantes/patient/${patientId}/du-jour`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(apres.body).toEqual({ prise: null });

    const detail = await api()
      .get(`/api/consultations/${consultation.body.id}`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(detail.body.constantes.temperature).toBe(39.5);
  });

  it('droits : la secrétaire modifie sa prise, pas celle du médecin ; le médecin supprime', async () => {
    const sienne = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ patientId, pouls: 72 });
    const duMedecin = await api()
      .post('/api/constantes')
      .set('Authorization', `Bearer ${medecin}`)
      .send({ patientId, pouls: 80 });

    const ok = await api()
      .patch(`/api/constantes/${sienne.body.id}`)
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ pouls: 75 });
    expect(ok.status).toBe(200);
    expect(ok.body.pouls).toBe(75);

    const refus = await api()
      .patch(`/api/constantes/${duMedecin.body.id}`)
      .set('Authorization', `Bearer ${secretaire}`)
      .send({ pouls: 60 });
    expect(refus.status).toBe(403);

    const suppression = await api()
      .delete(`/api/constantes/${sienne.body.id}`)
      .set('Authorization', `Bearer ${medecin}`);
    expect(suppression.status).toBe(200);
  });

  it('liste du patient, de la plus récente à la plus ancienne', async () => {
    const res = await api()
      .get(`/api/constantes/patient/${patientId}`)
      .set('Authorization', `Bearer ${secretaire}`);
    expect(res.status).toBe(200);
    const dates = res.body.map((p: { datePrise: string }) => p.datePrise);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(res.body[0].prisePar).toEqual(expect.objectContaining({ prenom: expect.any(String), role: expect.any(String) }));
  });

  it('isolation : un autre cabinet répond 404', async () => {
    const auth = { Authorization: `Bearer ${medecin}` };
    expect((await api().get('/api/constantes/patient/b-patient').set(auth)).status).toBe(404);
    expect((await api().post('/api/constantes').set(auth).send({ patientId: 'b-patient', poids: 70 })).status).toBe(404);
    expect((await api().patch(`/api/constantes/${priseB}`).set(auth).send({ poids: 61 })).status).toBe(404);
    expect((await api().delete(`/api/constantes/${priseB}`).set(auth)).status).toBe(404);
  });
});
```

- [ ] **Step 3 : Lancer, les tests de rattachement échouent** (Task 8 pas encore faite)

Run: `cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/constantes.e2e-spec.ts`
Expected: tout passe **sauf** « du-jour puis rattachement à la consultation » (400 `property constantesId should not exist`). C'est attendu : on le fait passer en Task 8.

- [ ] **Step 4 : Commit**

```bash
git add backend/src/constantes backend/src/app.module.ts backend/test/constantes.e2e-spec.ts
git commit -m "feat: /constantes API routes with e2e tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8 : Rattacher les constantes à la consultation

**Files:**
- Modify: `backend/src/consultations/dto/create-consultation.dto.ts`, `update-consultation.dto.ts`
- Modify: `backend/src/consultations/consultations.service.ts` (`create`, `findOne`)
- Test: `backend/src/consultations/consultations.service.spec.ts`

- [ ] **Step 1 : Ajouter les tests unitaires** — dans `consultations.service.spec.ts` :

Compléter `mockPrisma` :

```ts
const mockPrisma: any = {
  consultation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  constantes: { findUnique: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn((fn: (tx: unknown) => unknown) => fn(mockPrisma)),
};
```

Ajouter dans `describe('create', …)` :

```ts
    it('rattache la prise de constantes du patient', async () => {
      mockPrisma.constantes.findUnique.mockResolvedValue({ patientId: 'patient-1' });
      mockPrisma.constantes.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.consultation.create.mockResolvedValue({
        id: 'consult-1',
        patientId: 'patient-1',
        patient: { nom: 'Tazi', prenom: 'Ahmed' },
      });

      await service.create({ patientId: 'patient-1', medecinId: 'medecin-1', constantesId: 'k1' }, 'user-1');

      expect(mockPrisma.consultation.create.mock.calls[0][0].data.constantesId).toBeUndefined();
      expect(mockPrisma.constantes.updateMany).toHaveBeenCalledWith({
        where: { id: 'k1', consultationId: null },
        data: { consultationId: 'consult-1' },
      });
    });

    it('refuse les constantes d un autre patient', async () => {
      mockPrisma.constantes.findUnique.mockResolvedValue({ patientId: 'autre' });
      await expect(
        service.create({ patientId: 'patient-1', medecinId: 'medecin-1', constantesId: 'k1' }, 'user-1'),
      ).rejects.toThrow('Ces constantes concernent un autre patient');
      expect(mockPrisma.consultation.create).not.toHaveBeenCalled();
    });

    it('refuse des constantes déjà rattachées (la transaction annule la consultation)', async () => {
      mockPrisma.constantes.findUnique.mockResolvedValue({ patientId: 'patient-1' });
      mockPrisma.constantes.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.consultation.create.mockResolvedValue({ id: 'consult-2', patient: { nom: 'T', prenom: 'A' } });
      await expect(
        service.create({ patientId: 'patient-1', medecinId: 'medecin-1', constantesId: 'k1' }, 'user-1'),
      ).rejects.toThrow('Ces constantes sont déjà rattachées à une consultation');
    });
```

- [ ] **Step 2 : Lancer, ils échouent**

Run: `cd backend && npx jest src/consultations`
Expected: FAIL (les 3 nouveaux tests ; `updateMany` jamais appelé).

- [ ] **Step 3 : Implémenter**

`create-consultation.dto.ts`, ajouter après `actes` :

```ts
  @ApiProperty({ required: false, description: 'Prise de constantes du jour à rattacher' })
  @IsOptional() @IsString() constantesId?: string;
```

`update-consultation.dto.ts` (la modification ne rattache pas de constantes) :

```ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateConsultationDto } from './create-consultation.dto';

export class UpdateConsultationDto extends PartialType(OmitType(CreateConsultationDto, ['constantesId'] as const)) {}
```

`consultations.service.ts` : ajouter `BadRequestException` à l'import `@nestjs/common`, puis remplacer le début de `create` jusqu'au `await this.audit.log(...)` exclu par :

```ts
  async create(dto: CreateConsultationDto, userId: string) {
    const { constantesId, ...donnees } = dto;
    await this.references.verifier(donnees);
    if (constantesId) {
      const prise = await this.prisma.constantes.findUnique({
        where: { id: constantesId },
        select: { patientId: true },
      });
      if (!prise) throw new NotFoundException('Constantes introuvables');
      if (prise.patientId !== donnees.patientId) {
        throw new BadRequestException('Ces constantes concernent un autre patient');
      }
    }

    // Consultation et rattachement des constantes : tout ou rien
    const consultation = await this.prisma.$transaction(async (tx) => {
      const c = await tx.consultation.create({
        data: {
          ...donnees,
          dateConsultation: donnees.dateConsultation ? new Date(donnees.dateConsultation) : undefined,
          cabinetId: cabinetCourant(),
        },
        include: {
          patient: { select: { nom: true, prenom: true } },
          medecin: { select: { nom: true, prenom: true } },
        },
      });
      if (constantesId) {
        // consultationId: null dans le filtre : deux consultations ne prennent pas la même prise
        const { count } = await tx.constantes.updateMany({
          where: { id: constantesId, consultationId: null },
          data: { consultationId: c.id },
        });
        if (count === 0) throw new BadRequestException('Ces constantes sont déjà rattachées à une consultation');
      }
      return c;
    });
```

(La suite de `create` — audit, notification des secrétaires, `return consultation` — ne change pas.)

Dans `findOne`, ajouter à `include` :

```ts
        constantes: { include: { prisePar: { select: { prenom: true, nom: true, role: true } } } },
```

- [ ] **Step 4 : Lancer les tests unitaires et e2e**

Run: `cd backend && npx jest src/consultations src/constantes`
Expected: PASS.

Run: `cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npm run test:e2e`
Expected: PASS, tous les fichiers (y compris `constantes.e2e-spec.ts` et `consultations.e2e-spec.ts`).

- [ ] **Step 5 : Vérifier le style**

Run: `cd backend && npx eslint src/constantes src/consultations src/notifications src/common/dates test/constantes.e2e-spec.ts && npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur. Si `seuils.ts` doit être reformaté, le recopier ensuite à l'identique dans le frontend (Task 9, Step 2) : le test de copie l'exige.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/consultations
git commit -m "feat: attach the day's vital signs when creating a consultation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9 : Frontend — seuils, saisie, API

**Files:**
- Create: `frontend/src/lib/constantes/seuils.ts` (copie), `saisie.ts`, `api.ts`
- Modify: `frontend/src/lib/fuseau.ts`
- Test: `frontend/src/lib/constantes/saisie.test.ts`, et contrôle de copie dans `backend/src/constantes/seuils.spec.ts`

- [ ] **Step 1 : Test de la copie** — ajouter à la fin de `backend/src/constantes/seuils.spec.ts` (et `import { readFileSync } from 'fs'; import { join } from 'path';` en tête) :

```ts
describe('copie frontend', () => {
  it('frontend/src/lib/constantes/seuils.ts est identique', () => {
    const backend = readFileSync(join(__dirname, 'seuils.ts'), 'utf8');
    const frontend = readFileSync(join(__dirname, '../../../frontend/src/lib/constantes/seuils.ts'), 'utf8');
    expect(frontend).toBe(backend);
  });
});
```

Run: `cd backend && npx jest src/constantes/seuils.spec.ts` → FAIL (`ENOENT`).

- [ ] **Step 2 : Copier le fichier**

```bash
mkdir -p frontend/src/lib/constantes && cp backend/src/constantes/seuils.ts frontend/src/lib/constantes/seuils.ts
```

Run: `cd backend && npx jest src/constantes/seuils.spec.ts` → PASS.

- [ ] **Step 3 : `jourCabinet` côté frontend** — ajouter à la fin de `frontend/src/lib/fuseau.ts` :

```ts
// Date AAAA-MM-JJ d'un instant dans le fuseau du cabinet
export function jourCabinet(instant: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU_CABINET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}
```

- [ ] **Step 4 : Écrire le test de la saisie**

```ts
// frontend/src/lib/constantes/saisie.test.ts
import {
  erreursSaisie,
  lireNombre,
  memeSaisie,
  SAISIE_VIDE,
  saisieVide,
  versSaisie,
  versValeurs,
  versValeursCompletes,
} from './saisie';

const avec = (champs: Partial<typeof SAISIE_VIDE>) => ({ ...SAISIE_VIDE, ...champs });

describe('lireNombre', () => {
  it('accepte la virgule et le point', () => {
    expect(lireNombre('37,5')).toBe(37.5);
    expect(lireNombre(' 72.4 ')).toBe(72.4);
  });
  it('vide : undefined ; illisible : NaN', () => {
    expect(lireNombre('  ')).toBeUndefined();
    expect(lireNombre('12a')).toBeNaN();
  });
});

describe('erreursSaisie', () => {
  it('aucune erreur pour une saisie correcte ou vide', () => {
    expect(erreursSaisie(SAISIE_VIDE)).toEqual({});
    expect(erreursSaisie(avec({ tensionSystolique: '120', tensionDiastolique: '80', poids: '72,5' }))).toEqual({});
  });
  it('hors bornes, illisible, entier attendu, trop de décimales', () => {
    expect(erreursSaisie(avec({ temperature: '375' })).temperature).toBe('Entre 30 et 45 °C');
    expect(erreursSaisie(avec({ poids: 'abc' })).poids).toBe('Entre 0,3 et 400 kg');
    expect(erreursSaisie(avec({ pouls: '72,5' })).pouls).toBe('Entre 20 et 250 bpm, nombre entier');
    expect(erreursSaisie(avec({ glycemie: '1,255' })).glycemie).toBe('Entre 0,1 et 6 g/L, 2 décimales au plus');
  });
  it('tension : les deux valeurs, haute > basse', () => {
    expect(erreursSaisie(avec({ tensionSystolique: '120' })).tensionDiastolique).toBe('Saisir les deux valeurs de la tension');
    expect(erreursSaisie(avec({ tensionSystolique: '80', tensionDiastolique: '120' })).tensionSystolique).toBe(
      'La tension haute doit dépasser la basse',
    );
  });
});

describe('conversions', () => {
  it('versValeurs ne garde que les champs remplis', () => {
    expect(versValeurs(avec({ poids: '72,5', taille: '' }))).toEqual({ poids: 72.5 });
  });
  it('versValeursCompletes met null dans les champs vidés', () => {
    const v = versValeursCompletes(avec({ poids: '70' }));
    expect(v.poids).toBe(70);
    expect(v.taille).toBeNull();
  });
  it('versSaisie écrit la virgule', () => {
    expect(versSaisie({ temperature: 37.5, poids: null }).temperature).toBe('37,5');
    expect(versSaisie({ temperature: 37.5, poids: null }).poids).toBe('');
  });
  it('saisieVide et memeSaisie', () => {
    expect(saisieVide(SAISIE_VIDE)).toBe(true);
    expect(saisieVide(avec({ poids: '7' }))).toBe(false);
    expect(memeSaisie(avec({ poids: '70' }), avec({ poids: ' 70 ' }))).toBe(true);
  });
});
```

Run: `cd frontend && npx jest src/lib/constantes` → FAIL (`Cannot find module './saisie'`).

- [ ] **Step 5 : Écrire `saisie.ts`**

```ts
// frontend/src/lib/constantes/saisie.ts
import { CHAMPS, CHAMPS_MESURE, type ChampMesure, type ValeursConstantes } from './seuils';

/** Ce que l'utilisateur a tapé, champ par champ (texte, virgule ou point) */
export type SaisieConstantes = Record<ChampMesure, string>;
export type ErreursSaisie = Partial<Record<ChampMesure, string>>;

export const SAISIE_VIDE = Object.fromEntries(CHAMPS_MESURE.map((c) => [c, ''])) as SaisieConstantes;

const fr = (n: number) => String(n).replace('.', ',');
const normaliser = (texte: string) => texte.trim().replace(',', '.');

/** Texte → nombre : undefined si vide, NaN si illisible */
export function lireNombre(texte: string): number | undefined {
  const t = normaliser(texte);
  if (!t) return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function erreursSaisie(s: SaisieConstantes): ErreursSaisie {
  const erreurs: ErreursSaisie = {};
  for (const c of CHAMPS_MESURE) {
    const n = lireNombre(s[c]);
    if (n === undefined) continue;
    const { min, max, unite, entier } = CHAMPS[c];
    const bornes = `Entre ${fr(min)} et ${fr(max)} ${unite}`;
    const decimales = normaliser(s[c]).split('.')[1]?.length ?? 0;
    if (Number.isNaN(n) || n < min || n > max) erreurs[c] = bornes;
    else if (entier && decimales > 0) erreurs[c] = `${bornes}, nombre entier`;
    else if (decimales > 2) erreurs[c] = `${bornes}, 2 décimales au plus`;
  }
  if (!erreurs.tensionSystolique && !erreurs.tensionDiastolique) {
    const haute = lireNombre(s.tensionSystolique);
    const basse = lireNombre(s.tensionDiastolique);
    if ((haute === undefined) !== (basse === undefined)) {
      erreurs[haute === undefined ? 'tensionSystolique' : 'tensionDiastolique'] = 'Saisir les deux valeurs de la tension';
    } else if (haute !== undefined && basse !== undefined && haute <= basse) {
      erreurs.tensionSystolique = 'La tension haute doit dépasser la basse';
    }
  }
  return erreurs;
}

/** Valeurs remplies seulement (création) */
export function versValeurs(s: SaisieConstantes): ValeursConstantes {
  const v: ValeursConstantes = {};
  for (const c of CHAMPS_MESURE) {
    const n = lireNombre(s[c]);
    if (n !== undefined && !Number.isNaN(n)) v[c] = n;
  }
  return v;
}

/** Tous les champs, null pour un champ vide (modification : vider un champ efface la valeur) */
export function versValeursCompletes(s: SaisieConstantes): Record<ChampMesure, number | null> {
  const v = versValeurs(s);
  return Object.fromEntries(CHAMPS_MESURE.map((c) => [c, v[c] ?? null])) as Record<ChampMesure, number | null>;
}

export function versSaisie(v: ValeursConstantes): SaisieConstantes {
  return Object.fromEntries(
    CHAMPS_MESURE.map((c) => [c, v[c] === undefined || v[c] === null ? '' : fr(v[c] as number)]),
  ) as SaisieConstantes;
}

export const saisieVide = (s: SaisieConstantes) => CHAMPS_MESURE.every((c) => !s[c].trim());
export const memeSaisie = (a: SaisieConstantes, b: SaisieConstantes) =>
  CHAMPS_MESURE.every((c) => a[c].trim() === b[c].trim());
```

- [ ] **Step 6 : Écrire `api.ts`**

```ts
// frontend/src/lib/constantes/api.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { jourCabinet } from '@/lib/fuseau';
import type { AlerteConstante, ChampMesure } from './seuils';

/** Une prise de constantes telle que renvoyée par l'API (IMC et alertes calculés par le serveur) */
export type Prise = Partial<Record<ChampMesure, number | null>> & {
  id: string;
  patientId: string;
  consultationId: string | null;
  datePrise: string;
  createdAt: string;
  priseParId: string;
  prisePar: { id: string; prenom: string; nom: string; role: string };
  consultation: { id: string; dateConsultation: string } | null;
  imc: number | null;
  alertes: AlerteConstante[];
};

export const cleConstantes = (patientId: string) => ['constantes', patientId];

/** Prises du patient, de la plus récente à la plus ancienne */
export function useConstantes(patientId: string) {
  return useQuery({
    queryKey: cleConstantes(patientId),
    queryFn: () => apiClient.get(`/constantes/patient/${patientId}`).then((r) => r.data as Prise[]),
  });
}

/** Dernière taille mesurée (liste de la plus récente à la plus ancienne) */
export function derniereTaille(prises: Prise[] = []): number | null {
  return prises.find((p) => p.taille !== null && p.taille !== undefined)?.taille ?? null;
}

/** Même règle que le serveur : un médecin, ou l'auteur le jour même (heure du cabinet) */
export function peutModifier(
  prise: Pick<Prise, 'priseParId' | 'createdAt'>,
  user: { id: string; role: string } | null,
  maintenant: Date = new Date(),
): boolean {
  if (!user) return false;
  if (user.role === 'MEDECIN') return true;
  return prise.priseParId === user.id && jourCabinet(prise.createdAt) === jourCabinet(maintenant);
}

export const LIBELLE_ROLE: Record<string, string> = { MEDECIN: 'médecin', SECRETAIRE: 'secrétaire' };
```

- [ ] **Step 7 : Lancer les tests**

Run: `cd frontend && npx jest src/lib/constantes`
Expected: PASS.

- [ ] **Step 8 : Commit**

```bash
git add frontend/src/lib backend/src/constantes/seuils.spec.ts
git commit -m "feat: frontend helpers for vital signs entry and API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10 : Formulaire de constantes partagé

**Files:**
- Create: `frontend/src/components/constantes/PastilleAlerte.tsx`, `FormulaireConstantes.tsx`
- Test: `frontend/src/components/constantes/FormulaireConstantes.test.tsx`

- [ ] **Step 1 : Écrire le test**

```tsx
// frontend/src/components/constantes/FormulaireConstantes.test.tsx
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormulaireConstantes } from './FormulaireConstantes';
import { SAISIE_VIDE, type ErreursSaisie } from '@/lib/constantes/saisie';

function Hote({ dateNaissance = '1980-01-01', erreurs = {}, tailleConnue }: { dateNaissance?: string; erreurs?: ErreursSaisie; tailleConnue?: number }) {
  const [saisie, setSaisie] = useState(SAISIE_VIDE);
  return (
    <FormulaireConstantes saisie={saisie} onChange={setSaisie} erreurs={erreurs} dateNaissance={dateNaissance} tailleConnue={tailleConnue} />
  );
}

describe('FormulaireConstantes', () => {
  it('chaque champ a un libellé relié', () => {
    render(<Hote />);
    for (const libelle of ['Tension haute (systolique)', 'Tension basse (diastolique)', 'Pouls', 'SpO2', 'Température', 'Poids', 'Taille', 'Glycémie', 'Périmètre crânien', 'Tour de taille']) {
      expect(screen.getByLabelText(libelle)).toBeInTheDocument();
    }
  });

  it('pastille en direct : fièvre élevée, puis critique', async () => {
    render(<Hote />);
    const temperature = screen.getByLabelText('Température');
    await userEvent.type(temperature, '39,5');
    expect(screen.getByText('élevée')).toBeInTheDocument();
    await userEvent.clear(temperature);
    await userEvent.type(temperature, '40');
    expect(screen.getByText('élevée (critique)')).toBeInTheDocument();
  });

  it('IMC calculé avec le poids et la taille', async () => {
    render(<Hote />);
    await userEvent.type(screen.getByLabelText('Poids'), '72');
    await userEvent.type(screen.getByLabelText('Taille'), '170');
    expect(screen.getByTestId('imc')).toHaveTextContent('24,9');
  });

  it('IMC avec la dernière taille connue chez l adulte', async () => {
    render(<Hote tailleConnue={170} />);
    await userEvent.type(screen.getByLabelText('Poids'), '72');
    expect(screen.getByTestId('imc')).toHaveTextContent('24,9');
  });

  it('enfant : pas de pastille de tension', async () => {
    render(<Hote dateNaissance="2018-01-01" />);
    await userEvent.type(screen.getByLabelText('Tension haute (systolique)'), '150');
    await userEvent.type(screen.getByLabelText('Tension basse (diastolique)'), '95');
    expect(screen.queryByText('élevée')).not.toBeInTheDocument();
  });

  it('affiche les erreurs reçues sous le champ', () => {
    render(<Hote erreurs={{ temperature: 'Entre 30 et 45 °C' }} />);
    expect(screen.getByLabelText('Température')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Entre 30 et 45 °C')).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npx jest src/components/constantes` → FAIL (module introuvable).

- [ ] **Step 2 : Écrire `PastilleAlerte.tsx`**

```tsx
// frontend/src/components/constantes/PastilleAlerte.tsx
import type { AlerteConstante } from '@/lib/constantes/seuils';

/** « élevée » en orange, « élevée (critique) » en rouge */
export function PastilleAlerte({ alerte, className = '' }: { alerte: AlerteConstante; className?: string }) {
  const couleur = alerte.niveau === 'critique' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${couleur} ${className}`}>
      {alerte.etat}
      {alerte.niveau === 'critique' ? ' (critique)' : ''}
    </span>
  );
}
```

- [ ] **Step 3 : Écrire `FormulaireConstantes.tsx`**

```tsx
// frontend/src/components/constantes/FormulaireConstantes.tsx
'use client';
import { useId } from 'react';
import {
  ageEnAnnees,
  calculerImc,
  CHAMPS,
  evaluerConstantes,
  type AlerteConstante,
  type ChampMesure,
} from '@/lib/constantes/seuils';
import { lireNombre, versValeurs, type ErreursSaisie, type SaisieConstantes } from '@/lib/constantes/saisie';
import { PastilleAlerte } from './PastilleAlerte';

// Champ du formulaire → alerte affichée sous ce champ
const ALERTE_DU_CHAMP: Partial<Record<ChampMesure, AlerteConstante['cle']>> = {
  tensionSystolique: 'tension',
  pouls: 'pouls',
  spo2: 'spo2',
  temperature: 'temperature',
  glycemie: 'glycemie',
};

const ORDRE: ChampMesure[] = ['tensionSystolique', 'tensionDiastolique', 'pouls', 'spo2', 'temperature', 'poids', 'taille'];
const APRES_IMC: ChampMesure[] = ['glycemie', 'perimetreCranien', 'tourDeTaille'];

/** IMC de la saisie ; sans taille saisie, celle déjà connue (adulte seulement) */
export function imcDeSaisie(saisie: SaisieConstantes, age: number, tailleConnue?: number | null): number | null {
  const poids = lireNombre(saisie.poids);
  const taille = lireNombre(saisie.taille);
  const t = taille !== undefined && !Number.isNaN(taille) ? taille : age >= 18 ? tailleConnue ?? null : null;
  return poids !== undefined && !Number.isNaN(poids) ? calculerImc(poids, t) : null;
}

interface Props {
  saisie: SaisieConstantes;
  onChange: (saisie: SaisieConstantes) => void;
  erreurs: ErreursSaisie;
  dateNaissance: string;
  tailleConnue?: number | null;
  desactive?: boolean;
  /** Focus initial (modale) sur le premier champ */
  autoFocus?: boolean;
}

export function FormulaireConstantes({ saisie, onChange, erreurs, dateNaissance, tailleConnue, desactive, autoFocus }: Props) {
  const id = useId();
  const age = ageEnAnnees(dateNaissance);
  const imc = imcDeSaisie(saisie, age, tailleConnue);
  const alertes = evaluerConstantes({ ...versValeurs(saisie), imc }, age);
  const alerte = (cle?: AlerteConstante['cle']) => (cle ? alertes.find((a) => a.cle === cle) : undefined);

  const champ = (c: ChampMesure) => {
    const a = alerte(ALERTE_DU_CHAMP[c]);
    const idChamp = `${id}-${c}`;
    return (
      <div key={c}>
        <label htmlFor={idChamp} className="text-sm font-medium text-gray-700">
          {CHAMPS[c].libelle}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={idChamp}
            name={c}
            inputMode="decimal"
            autoComplete="off"
            value={saisie[c]}
            onChange={(e) => onChange({ ...saisie, [c]: e.target.value })}
            disabled={desactive}
            data-autofocus={autoFocus && c === 'tensionSystolique' ? true : undefined}
            aria-invalid={erreurs[c] ? true : undefined}
            aria-describedby={erreurs[c] ? `${idChamp}-erreur` : undefined}
            className={`w-full min-h-[44px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${
              erreurs[c] ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          <span className="w-12 shrink-0 text-sm text-gray-500">{CHAMPS[c].unite}</span>
        </div>
        {a && <PastilleAlerte alerte={a} className="mt-1" />}
        {erreurs[c] && (
          <p id={`${idChamp}-erreur`} className="mt-1 text-xs text-red-600">
            {erreurs[c]}
          </p>
        )}
      </div>
    );
  };

  const alerteImc = alerte('imc');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ORDRE.map(champ)}
      <div>
        <p id={`${id}-imc`} className="text-sm font-medium text-gray-700">
          IMC <span className="font-normal text-gray-400">(calculé)</span>
        </p>
        <p
          aria-labelledby={`${id}-imc`}
          data-testid="imc"
          className="mt-1 min-h-[44px] flex items-center px-3 rounded-lg bg-gray-50 text-sm text-gray-900"
        >
          {imc === null ? '—' : String(imc).replace('.', ',')}
        </p>
        {alerteImc && <PastilleAlerte alerte={alerteImc} className="mt-1" />}
      </div>
      {APRES_IMC.map(champ)}
    </div>
  );
}
```

- [ ] **Step 4 : Lancer les tests**

Run: `cd frontend && npx jest src/components/constantes`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/components/constantes
git commit -m "feat: shared vital signs form with live alerts and BMI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11 : Modale « Prendre les constantes » et bouton de la fiche patient

**Files:**
- Create: `frontend/src/components/constantes/PriseConstantesModal.tsx`
- Modify: `frontend/src/app/(dashboard)/patients/[id]/page.tsx`

- [ ] **Step 1 : Écrire la modale**

```tsx
// frontend/src/components/constantes/PriseConstantesModal.tsx
'use client';
import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useModale } from '@/components/commun/useModale';
import { cleConstantes, derniereTaille, type Prise, useConstantes } from '@/lib/constantes/api';
import {
  erreursSaisie,
  SAISIE_VIDE,
  saisieVide,
  versSaisie,
  versValeurs,
  versValeursCompletes,
  type ErreursSaisie,
  type SaisieConstantes,
} from '@/lib/constantes/saisie';
import { FormulaireConstantes } from './FormulaireConstantes';

interface Props {
  patient: { id: string; dateNaissance: string };
  /** Prise à modifier ; absente : nouvelle prise */
  prise?: Prise;
  onClose: () => void;
}

export function PriseConstantesModal({ patient, prise, onClose }: Props) {
  const queryClient = useQueryClient();
  const { data: prises } = useConstantes(patient.id);
  const [saisie, setSaisie] = useState<SaisieConstantes>(prise ? versSaisie(prise) : SAISIE_VIDE);
  const [erreurs, setErreurs] = useState<ErreursSaisie>({});

  const mutation = useMutation({
    mutationFn: () =>
      prise
        ? apiClient.patch(`/constantes/${prise.id}`, versValeursCompletes(saisie))
        : apiClient.post('/constantes', { patientId: patient.id, ...versValeurs(saisie) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cleConstantes(patient.id) });
      toast.success(prise ? 'Constantes modifiées' : 'Constantes enregistrées');
      onClose();
    },
    onError: (err: any) => {
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || "Erreur lors de l'enregistrement");
    },
  });

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    const trouvees = erreursSaisie(saisie);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length) return;
    if (saisieVide(saisie)) {
      toast.error('Saisissez au moins une constante');
      return;
    }
    mutation.mutate();
  };

  const titreId = `${useId()}-titre`;
  const modaleRef = useModale(onClose, mutation.isPending);
  const autres = prises?.filter((p) => p.id !== prise?.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modaleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 id={titreId} className="font-bold text-lg mb-4">
          {prise ? 'Modifier les constantes' : 'Prendre les constantes'}
        </h2>
        <form onSubmit={enregistrer} noValidate>
          <FormulaireConstantes
            saisie={saisie}
            onChange={setSaisie}
            erreurs={erreurs}
            dateNaissance={patient.dateNaissance}
            tailleConnue={derniereTaille(autres)}
            desactive={mutation.isPending}
            autoFocus
          />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? '...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Fiche patient** — dans `patients/[id]/page.tsx` :

1. Imports :

```tsx
import { useSearchParams } from 'next/navigation';
import { PriseConstantesModal } from '@/components/constantes/PriseConstantesModal';
import { OngletConstantes } from '@/components/constantes/OngletConstantes';
```

2. Onglets (Constantes entre Consultations et Ordonnances) :

```tsx
const TABS = ['Profil', 'Consultations', 'Constantes', 'Ordonnances', 'Documents', 'RDV'];
```

3. En tête du composant, remplacer `const [tab, setTab] = useState(0);` par :

```tsx
  const searchParams = useSearchParams();
  // ?onglet=constantes (lien de la notification « Constantes anormales »)
  const [tab, setTab] = useState(searchParams.get('onglet') === 'constantes' ? 2 : 0);
  const [priseOuverte, setPriseOuverte] = useState(false);
```

4. Dans le bloc des boutons (`<div className="flex flex-col sm:flex-row gap-3">`), avant le lien « Modifier » :

```tsx
          <button
            type="button"
            onClick={() => setPriseOuverte(true)}
            className="px-4 py-2 border border-blue-600 text-blue-700 rounded-lg text-sm hover:bg-blue-50 transition"
          >
            Prendre les constantes
          </button>
```

5. Contenu des onglets :

```tsx
          {tab === 0 && <ProfileTab patient={patient} />}
          {tab === 1 && <ConsultationsTab consultations={patient.consultations} patientId={params.id} canCreate={canCreateConsultation} />}
          {tab === 2 && <OngletConstantes patient={patient} />}
          {tab === 3 && <OrdonnancesTab ordonnances={patient.ordonnances} />}
          {tab === 4 && <DocumentsTab patientId={params.id} />}
          {tab === 5 && <RdvTab rdvList={patient.rendezVous} />}
```

6. Juste avant la dernière `</div>` du `return` :

```tsx
      {priseOuverte && <PriseConstantesModal patient={patient} onClose={() => setPriseOuverte(false)} />}
```

(`OngletConstantes` est créé en Task 12 : ne pas compiler avant la fin de Task 12.)

- [ ] **Step 3 : Commit** (après Task 12, voir Step 6 de Task 12).

---

### Task 12 : Onglet « Constantes » et courbes

**Files:**
- Create: `frontend/src/lib/constantes/affichage.ts`, `frontend/src/components/constantes/CourbeConstantes.tsx`, `OngletConstantes.tsx`
- Test: `frontend/src/lib/constantes/affichage.test.ts`, `frontend/src/components/constantes/OngletConstantes.test.tsx`

- [ ] **Step 1 : Installer Recharts**

```bash
cd frontend && npm install recharts@^2.15.0
```
Expected : `recharts` dans `dependencies` de `frontend/package.json`, `package-lock.json` mis à jour.

- [ ] **Step 2 : Écrire le test des fonctions d'affichage**

```ts
// frontend/src/lib/constantes/affichage.test.ts
import { COURBES, dernieresValeurs, pointsCourbe, reperesCourbe, resumePrise } from './affichage';
import type { Prise } from './api';

function prise(champs: Partial<Prise>): Prise {
  return {
    id: 'k',
    patientId: 'p1',
    consultationId: null,
    datePrise: '2026-11-11T09:00:00.000Z',
    createdAt: '2026-11-11T09:00:00.000Z',
    priseParId: 'sec-1',
    prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
    consultation: null,
    imc: null,
    alertes: [],
    ...champs,
  };
}

const tension = COURBES.find((c) => c.cle === 'tension')!;

describe('dernieresValeurs', () => {
  it('prend la valeur la plus récente de chaque constante', () => {
    const prises = [
      prise({ id: 'recente', datePrise: '2026-11-11T09:00:00.000Z', poids: 73 }),
      prise({ id: 'ancienne', datePrise: '2026-10-01T09:00:00.000Z', poids: 70, tensionSystolique: 130, tensionDiastolique: 85 }),
    ];
    const res = dernieresValeurs(prises);
    expect(res.find((d) => d.cle === 'poids')?.valeur).toBe('73 kg');
    expect(res.find((d) => d.cle === 'tension')?.valeur).toBe('130/85 mmHg');
    expect(res.find((d) => d.cle === 'spo2')).toBeUndefined();
  });
  it('associe l alerte de la prise', () => {
    const alerte = { cle: 'temperature' as const, sens: 'elevee' as const, niveau: 'attention' as const, etat: 'élevée', texte: '' };
    const [d] = dernieresValeurs([prise({ temperature: 39.5, alertes: [alerte] })]);
    expect(d).toMatchObject({ valeur: '39,5 °C', alerte });
  });
});

describe('resumePrise', () => {
  it('liste les valeurs présentes', () => {
    expect(resumePrise(prise({ tensionSystolique: 120, tensionDiastolique: 80, poids: 72, imc: 24.9 }))).toBe(
      'Tension 120/80 mmHg · Poids 72 kg · IMC 24,9',
    );
  });
});

describe('courbes', () => {
  it('points du plus ancien au plus récent, seulement les prises utiles', () => {
    const points = pointsCourbe(
      [
        prise({ datePrise: '2026-11-11T09:00:00.000Z', tensionSystolique: 140, tensionDiastolique: 90 }),
        prise({ datePrise: '2026-11-10T09:00:00.000Z', poids: 70 }),
        prise({ datePrise: '2026-10-01T09:00:00.000Z', tensionSystolique: 120, tensionDiastolique: 80 }),
      ],
      tension,
    );
    expect(points.map((p) => p.tensionSystolique)).toEqual([120, 140]);
  });
  it('repères de seuils sans doublon', () => {
    expect(reperesCourbe(tension)).toEqual([90, 140, 60]);
  });
});
```

Run: `cd frontend && npx jest src/lib/constantes/affichage.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : Écrire `affichage.ts`**

```ts
// frontend/src/lib/constantes/affichage.ts
import { FUSEAU_CABINET } from '@/lib/fuseau';
import type { Prise } from './api';
import { CHAMPS, type ChampMesure, type AlerteConstante, type CleAlerte, SEUILS } from './seuils';

export const fr = (n: number) => String(n).replace('.', ',');

interface Ligne {
  cle: string;
  libelle: string;
  lire: (p: Prise) => string | null;
  alerte?: CleAlerte;
}

const ALERTES_SIMPLES: ChampMesure[] = ['pouls', 'spo2', 'temperature', 'glycemie'];

const simple = (c: ChampMesure): Ligne => ({
  cle: c,
  libelle: CHAMPS[c].libelle,
  lire: (p) => (p[c] === null || p[c] === undefined ? null : `${fr(p[c] as number)} ${CHAMPS[c].unite}`),
  alerte: ALERTES_SIMPLES.includes(c) ? (c as CleAlerte) : undefined,
});

const LIGNES: Ligne[] = [
  {
    cle: 'tension',
    libelle: 'Tension',
    lire: (p) =>
      p.tensionSystolique != null && p.tensionDiastolique != null
        ? `${p.tensionSystolique}/${p.tensionDiastolique} mmHg`
        : null,
    alerte: 'tension',
  },
  simple('pouls'),
  simple('spo2'),
  simple('temperature'),
  simple('poids'),
  simple('taille'),
  { cle: 'imc', libelle: 'IMC', lire: (p) => (p.imc == null ? null : fr(p.imc)), alerte: 'imc' },
  simple('glycemie'),
  simple('perimetreCranien'),
  simple('tourDeTaille'),
];

export interface DerniereValeur {
  cle: string;
  libelle: string;
  valeur: string;
  date: string;
  alerte?: AlerteConstante;
}

/** Valeur la plus récente de chaque constante (prises de la plus récente à la plus ancienne) */
export function dernieresValeurs(prises: Prise[]): DerniereValeur[] {
  const res: DerniereValeur[] = [];
  for (const l of LIGNES) {
    const p = prises.find((x) => l.lire(x) !== null);
    if (!p) continue;
    res.push({
      cle: l.cle,
      libelle: l.libelle,
      valeur: l.lire(p)!,
      date: p.datePrise,
      alerte: l.alerte ? p.alertes.find((a) => a.cle === l.alerte) : undefined,
    });
  }
  return res;
}

/** « Tension 120/80 mmHg · Poids 72 kg · IMC 24,9 » */
export function resumePrise(p: Prise): string {
  return LIGNES.map((l) => {
    const v = l.lire(p);
    return v === null ? null : `${l.libelle} ${v}`;
  })
    .filter(Boolean)
    .join(' · ');
}

type CleSerie = ChampMesure | 'imc';

export interface Courbe {
  cle: string;
  libelle: string;
  unite: string;
  series: { cle: CleSerie; libelle: string }[];
}

const courbeSimple = (c: ChampMesure): Courbe => ({
  cle: c,
  libelle: CHAMPS[c].libelle,
  unite: CHAMPS[c].unite,
  series: [{ cle: c, libelle: CHAMPS[c].libelle }],
});

export const COURBES: Courbe[] = [
  {
    cle: 'tension',
    libelle: 'Tension',
    unite: 'mmHg',
    series: [
      { cle: 'tensionSystolique', libelle: 'Haute' },
      { cle: 'tensionDiastolique', libelle: 'Basse' },
    ],
  },
  courbeSimple('pouls'),
  courbeSimple('spo2'),
  courbeSimple('temperature'),
  courbeSimple('poids'),
  { cle: 'imc', libelle: 'IMC', unite: 'kg/m²', series: [{ cle: 'imc', libelle: 'IMC' }] },
  courbeSimple('glycemie'),
  courbeSimple('perimetreCranien'),
  courbeSimple('tourDeTaille'),
];

export type PointCourbe = { date: string } & Partial<Record<CleSerie, number | null>>;

/** Points de la courbe, du plus ancien au plus récent (prises sans valeur ignorées) */
export function pointsCourbe(prises: Prise[], courbe: Courbe): PointCourbe[] {
  return [...prises]
    .sort((a, b) => a.datePrise.localeCompare(b.datePrise))
    .filter((p) => courbe.series.some((s) => p[s.cle] !== null && p[s.cle] !== undefined))
    .map((p) => ({
      date: new Date(p.datePrise).toLocaleDateString('fr-MA', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        timeZone: FUSEAU_CABINET,
      }),
      ...Object.fromEntries(courbe.series.map((s) => [s.cle, p[s.cle] ?? null])),
    }));
}

/** Seuils adultes dessinés en pointillés (sans doublon) */
export function reperesCourbe(courbe: Courbe): number[] {
  const valeurs = courbe.series.flatMap((s) => {
    const seuil = (SEUILS as Record<string, { basse?: number; haute?: number }>)[s.cle];
    return seuil ? [seuil.basse, seuil.haute] : [];
  });
  return [...new Set(valeurs.filter((n): n is number => n !== undefined))];
}
```

Run: `cd frontend && npx jest src/lib/constantes/affichage.test.ts` → PASS.

- [ ] **Step 4 : Écrire `CourbeConstantes.tsx`**

```tsx
// frontend/src/components/constantes/CourbeConstantes.tsx
'use client';
import { useId, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COURBES, fr, pointsCourbe, reperesCourbe } from '@/lib/constantes/affichage';
import type { Prise } from '@/lib/constantes/api';

const COULEURS = ['#2563eb', '#7c3aed'];

export function CourbeConstantes({ prises }: { prises: Prise[] }) {
  const id = useId();
  const [cle, setCle] = useState(COURBES[0].cle);
  const courbe = COURBES.find((c) => c.cle === cle) ?? COURBES[0];
  const points = pointsCourbe(prises, courbe);

  return (
    <div>
      <label htmlFor={`${id}-choix`} className="text-sm font-medium text-gray-700">
        Constante affichée
      </label>
      <select
        id={`${id}-choix`}
        value={cle}
        onChange={(e) => setCle(e.target.value)}
        className="mt-1 block w-full sm:w-64 min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
      >
        {COURBES.map((c) => (
          <option key={c.cle} value={c.cle}>
            {c.libelle}
          </option>
        ))}
      </select>

      {points.length < 2 ? (
        <p className="mt-4 text-sm text-gray-500">Pas encore assez de mesures pour une courbe</p>
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={44} domain={['auto', 'auto']} />
              <Tooltip formatter={(v: number) => `${fr(v)} ${courbe.unite}`} />
              {courbe.series.length > 1 && <Legend />}
              {reperesCourbe(courbe).map((y) => (
                <ReferenceLine key={y} y={y} stroke="#f59e0b" strokeDasharray="4 4" />
              ))}
              {courbe.series.map((s, i) => (
                <Line
                  key={s.cle}
                  type="monotone"
                  dataKey={s.cle}
                  name={s.libelle}
                  stroke={COULEURS[i]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5 : Écrire le test de l'onglet puis l'onglet**

```tsx
// frontend/src/components/constantes/OngletConstantes.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OngletConstantes } from './OngletConstantes';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn(), delete: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
// Recharts ne se dessine pas dans jsdom : la courbe a ses propres tests (affichage.test.ts)
jest.mock('./CourbeConstantes', () => ({ CourbeConstantes: () => <div>courbe</div> }));
const get = apiClient.get as jest.Mock;

const maintenant = new Date().toISOString();
const prises = [
  {
    id: 'k2',
    patientId: 'p1',
    consultationId: null,
    datePrise: maintenant,
    createdAt: maintenant,
    priseParId: 'sec-1',
    prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
    consultation: null,
    temperature: 39.5,
    imc: null,
    alertes: [{ cle: 'temperature', sens: 'elevee', niveau: 'attention', etat: 'élevée', texte: 'température 39,5 °C élevée' }],
  },
  {
    id: 'k1',
    patientId: 'p1',
    consultationId: 'c1',
    datePrise: '2026-01-01T09:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z',
    priseParId: 'dr-1',
    prisePar: { id: 'dr-1', prenom: 'Hassan', nom: 'Benali', role: 'MEDECIN' },
    consultation: { id: 'c1', dateConsultation: '2026-01-01T09:00:00.000Z' },
    poids: 72,
    imc: null,
    alertes: [],
  },
];

function afficher(role: 'MEDECIN' | 'SECRETAIRE', id = 'sec-1') {
  useAuthStore.setState({ user: { id, email: 'x@cabinet.ma', nom: 'X', prenom: 'Y', role } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OngletConstantes patient={{ id: 'p1', dateNaissance: '1980-01-01' }} />
    </QueryClientProvider>,
  );
}

beforeEach(() => get.mockReset());

describe('OngletConstantes', () => {
  it('aucune prise : message', async () => {
    get.mockResolvedValue({ data: [] });
    afficher('MEDECIN', 'dr-1');
    expect(await screen.findByText(/Aucune constante enregistrée/)).toBeInTheDocument();
  });

  it('dernières valeurs, pastille et historique', async () => {
    get.mockResolvedValue({ data: prises });
    afficher('MEDECIN', 'dr-1');
    expect(await screen.findByText('39,5 °C')).toBeInTheDocument();
    expect(screen.getByText('72 kg')).toBeInTheDocument();
    expect(screen.getAllByText('élevée').length).toBeGreaterThan(0);
    expect(screen.getByText(/prise par Fatima Alaoui \(secrétaire\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'consultation' })).toHaveAttribute('href', '/consultations/c1');
    expect(get).toHaveBeenCalledWith('/constantes/patient/p1');
  });

  it('la secrétaire ne modifie que sa prise du jour', async () => {
    get.mockResolvedValue({ data: prises });
    afficher('SECRETAIRE', 'sec-1');
    await screen.findByText('39,5 °C');
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Supprimer' })).toHaveLength(1);
  });
});
```

```tsx
// frontend/src/components/constantes/OngletConstantes.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { FUSEAU_CABINET } from '@/lib/fuseau';
import { cleConstantes, LIBELLE_ROLE, peutModifier, type Prise, useConstantes } from '@/lib/constantes/api';
import { dernieresValeurs, resumePrise } from '@/lib/constantes/affichage';
import { CourbeConstantes } from './CourbeConstantes';
import { PastilleAlerte } from './PastilleAlerte';
import { PriseConstantesModal } from './PriseConstantesModal';

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSEAU_CABINET });
const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSEAU_CABINET,
  });

export function OngletConstantes({ patient }: { patient: { id: string; dateNaissance: string } }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: prises = [], isLoading } = useConstantes(patient.id);
  const [enEdition, setEnEdition] = useState<Prise | null>(null);

  const suppression = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/constantes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cleConstantes(patient.id) });
      toast.success('Prise supprimée');
    },
    onError: () => toast.error('Suppression impossible'),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Chargement…</p>;
  if (!prises.length) {
    return (
      <p className="text-sm text-gray-500">
        Aucune constante enregistrée. Utilisez « Prendre les constantes » en haut de la fiche.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Dernières valeurs</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {dernieresValeurs(prises).map((d) => (
            <div
              key={d.cle}
              className={`rounded-lg border p-3 ${
                d.alerte?.niveau === 'critique'
                  ? 'border-red-200 bg-red-50'
                  : d.alerte
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-gray-100'
              }`}
            >
              <p className="text-xs text-gray-500">{d.libelle}</p>
              <p className="font-semibold text-gray-900">{d.valeur}</p>
              {d.alerte && <PastilleAlerte alerte={d.alerte} className="mt-1" />}
              <p className="text-xs text-gray-400 mt-1">{dateCourte(d.date)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Évolution</h3>
        <CourbeConstantes prises={prises} />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Historique</h3>
        <ul className="divide-y divide-gray-100">
          {prises.map((p) => (
            <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {dateHeure(p.datePrise)} · prise par {p.prisePar.prenom} {p.prisePar.nom} (
                  {LIBELLE_ROLE[p.prisePar.role] ?? p.prisePar.role})
                  {p.consultation && (
                    <>
                      {' · '}
                      <Link href={`/consultations/${p.consultation.id}`} className="text-blue-600 hover:underline">
                        consultation
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-sm text-gray-600 mt-1 break-words">{resumePrise(p)}</p>
                {p.alertes.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {p.alertes.map((a) => (
                      <li
                        key={a.cle}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          a.niveau === 'critique' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {a.texte}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {peutModifier(p, user) && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEnEdition(p)}
                    className="min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    disabled={suppression.isPending}
                    onClick={() => {
                      if (window.confirm('Supprimer cette prise de constantes ?')) suppression.mutate(p.id);
                    }}
                    className="min-h-[44px] px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {enEdition && <PriseConstantesModal patient={patient} prise={enEdition} onClose={() => setEnEdition(null)} />}
    </div>
  );
}
```

- [ ] **Step 6 : Lancer tous les tests frontend, puis le typage et le build**

Run: `cd frontend && npx jest`
Expected: PASS (tous les fichiers).

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `4` (les 4 erreurs déjà présentes, aucune nouvelle). En cas de doute : `npx tsc --noEmit | grep -v "stock/page.tsx\|NouveauRdvModal.tsx"` ne doit rien afficher.

Run: `cd frontend && npx next lint --dir src/components/constantes --dir src/lib/constantes --dir "src/app/(dashboard)/patients"`
Expected: aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/constantes frontend/src/components/constantes "frontend/src/app/(dashboard)/patients/[id]/page.tsx"
git commit -m "feat: vital signs tab with latest values, charts and history on the patient page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13 : Bloc « Constantes » dans la nouvelle consultation

**Files:**
- Modify: `frontend/src/app/(dashboard)/consultations/nouvelle/page.tsx`
- Test: `frontend/src/app/(dashboard)/consultations/nouvelle/page.test.tsx`

- [ ] **Step 1 : Ajouter les tests** — dans `page.test.tsx` :

Remplacer le mock de l'API par :

```tsx
jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const patch = apiClient.patch as jest.Mock;
```

Dans `beforeEach`, ajouter `post.mockReset(); patch.mockReset();`.

Ajouter à la fin du fichier :

```tsx
const priseFatima = {
  id: 'k1',
  patientId: 'p-tazi',
  consultationId: null,
  datePrise: '2026-11-11T09:12:00.000Z',
  createdAt: '2026-11-11T09:12:00.000Z',
  priseParId: 'sec-1',
  prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
  consultation: null,
  poids: 72,
  imc: null,
  alertes: [],
};

function reponses(prise: unknown) {
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/du-jour') ? { prise } : tazi }),
  );
  post.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/constantes' ? { ...priseFatima, id: 'k2' } : { id: 'c1' } }),
  );
}

describe('Nouvelle consultation : constantes', () => {
  it('pré-remplit les constantes prises par la secrétaire et les rattache sans les renvoyer', async () => {
    reponses(priseFatima);
    afficher('patientId=p-tazi');
    expect(await screen.findByText(/Prises à .* par Fatima Alaoui/)).toBeInTheDocument();
    expect(screen.getByLabelText('Poids')).toHaveValue('72');

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/consultations', expect.objectContaining({ constantesId: 'k1' })),
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it('constantes modifiées par le médecin : PATCH avant la consultation', async () => {
    reponses(priseFatima);
    patch.mockResolvedValue({ data: { ...priseFatima, poids: 73 } });
    afficher('patientId=p-tazi');
    const poids = await screen.findByDisplayValue('72');
    await userEvent.clear(poids);
    await userEvent.type(poids, '73');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/consultations', expect.objectContaining({ constantesId: 'k1' })),
    );
    expect(patch).toHaveBeenCalledWith('/constantes/k1', expect.objectContaining({ poids: 73 }));
  });

  it('sans prise du jour : crée la prise puis la consultation', async () => {
    reponses(null);
    afficher('patientId=p-tazi');
    await screen.findByText('Ahmed Tazi');
    await userEvent.type(await screen.findByLabelText('Poids'), '70');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenNthCalledWith(1, '/constantes', { patientId: 'p-tazi', poids: 70 });
    expect(post).toHaveBeenNthCalledWith(2, '/consultations', expect.objectContaining({ constantesId: 'k2' }));
  });

  it('bloc vide : aucune prise créée', async () => {
    reponses(null);
    afficher('patientId=p-tazi');
    await screen.findByText('Ahmed Tazi');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/consultations', expect.objectContaining({ constantesId: undefined }));
  });

  it('valeur hors bornes : rien n est envoyé', async () => {
    reponses(null);
    afficher('patientId=p-tazi');
    await screen.findByText('Ahmed Tazi');
    await userEvent.type(await screen.findByLabelText('Température'), '375');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    expect(screen.getByText('Entre 30 et 45 °C')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
```

Ajouter `waitFor` à l'import de `@testing-library/react` en tête du fichier.

Run: `cd frontend && npx jest "src/app/(dashboard)/consultations/nouvelle"` → les nouveaux tests échouent (pas de champ « Poids »).

- [ ] **Step 2 : Implémenter** — dans `consultations/nouvelle/page.tsx` :

1. Imports à ajouter :

```tsx
import { FormulaireConstantes } from '@/components/constantes/FormulaireConstantes';
import type { Prise } from '@/lib/constantes/api';
import { heureCabinet } from '@/lib/fuseau';
import {
  erreursSaisie,
  memeSaisie,
  SAISIE_VIDE,
  saisieVide,
  versSaisie,
  versValeurs,
  versValeursCompletes,
  type ErreursSaisie,
  type SaisieConstantes,
} from '@/lib/constantes/saisie';
```

2. Après la ligne `const { register, handleSubmit } = useForm<ConsultationForm>();`, ajouter :

```tsx
  // Constantes : la prise du jour (secrétaire) est reprise et complétée, sinon une prise est créée
  const [saisie, setSaisie] = useState<SaisieConstantes>(SAISIE_VIDE);
  const [erreursConstantes, setErreursConstantes] = useState<ErreursSaisie>({});
  const [priseDuJour, setPriseDuJour] = useState<Prise | null>(null);
  const [priseChargeePour, setPriseChargeePour] = useState<string | null>(null);
  const duJour = useQuery({
    queryKey: ['constantes-du-jour', selectedPatient?.id],
    queryFn: () =>
      apiClient
        .get(`/constantes/patient/${selectedPatient!.id}/du-jour`)
        .then((r) => (r.data?.prise ?? null) as Prise | null),
    enabled: !!selectedPatient,
    retry: false,
    gcTime: 0,
  });
  // Changement de patient : on repart d'un bloc vide
  useEffect(() => {
    setPriseDuJour(null);
    setSaisie(SAISIE_VIDE);
    setErreursConstantes({});
  }, [selectedPatient?.id]);
  useEffect(() => {
    const id = selectedPatient?.id;
    if (!id || priseChargeePour === id || !duJour.isFetchedAfterMount) return;
    const prise = duJour.isError ? null : duJour.data ?? null;
    setPriseDuJour(prise);
    if (prise) setSaisie(versSaisie(prise));
    setPriseChargeePour(id);
  }, [selectedPatient?.id, duJour.data, duJour.isError, duJour.isFetchedAfterMount, priseChargeePour]);

  /** Enregistre les constantes et renvoie l'identifiant de la prise à rattacher */
  const enregistrerConstantes = async (): Promise<string | undefined> => {
    if (priseDuJour) {
      if (!memeSaisie(saisie, versSaisie(priseDuJour))) {
        const r = await apiClient.patch(`/constantes/${priseDuJour.id}`, versValeursCompletes(saisie));
        setPriseDuJour(r.data);
      }
      return priseDuJour.id;
    }
    if (saisieVide(saisie)) return undefined;
    const r = await apiClient.post('/constantes', { patientId: selectedPatient!.id, ...versValeurs(saisie) });
    setPriseDuJour(r.data); // un nouvel essai ne recrée pas la prise
    return r.data.id;
  };
```

3. Remplacer la `mutation` par :

```tsx
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const constantesId = await enregistrerConstantes();
      return apiClient.post('/consultations', { ...data, constantesId });
    },
    onSuccess: (res) => {
      toast.success('Consultation enregistrée — vous pouvez ajouter une ordonnance');
      const today = new Date().toISOString().split('T')[0];
      router.push(`/paiements?consultationId=${res.data.id}&date=${today}`);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || "Erreur lors de l'enregistrement");
    },
  });
```

4. Au début de `onSubmit`, après le contrôle `if (!selectedPatient) {…}` :

```tsx
    const erreurs = erreursSaisie(saisie);
    setErreursConstantes(erreurs);
    if (Object.keys(erreurs).length) {
      toast.error('Vérifiez les constantes');
      return;
    }
```

5. Dans le JSX, juste avant `<section>` « Examen clinique » :

```tsx
        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Constantes</h2>
          {priseDuJour && (
            <p className="text-sm text-gray-500 mb-3">
              Prises à {heureCabinet(priseDuJour.datePrise)} par {priseDuJour.prisePar.prenom} {priseDuJour.prisePar.nom}
            </p>
          )}
          {selectedPatient ? (
            <FormulaireConstantes
              saisie={saisie}
              onChange={setSaisie}
              erreurs={erreursConstantes}
              dateNaissance={selectedPatient.dateNaissance}
              desactive={mutation.isPending}
            />
          ) : (
            <p className="text-sm text-gray-500">Choisissez d&apos;abord le patient.</p>
          )}
        </section>
```

- [ ] **Step 3 : Lancer les tests**

Run: `cd frontend && npx jest "src/app/(dashboard)/consultations/nouvelle"`
Expected: PASS (anciens et nouveaux tests).

- [ ] **Step 4 : Commit**

```bash
git add "frontend/src/app/(dashboard)/consultations/nouvelle"
git commit -m "feat: vital signs block in the new consultation form, prefilled from the day's entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14 : Détail de consultation et notification

**Files:**
- Create: `frontend/src/components/constantes/ResumeConstantes.tsx`
- Modify: `frontend/src/app/(dashboard)/consultations/[id]/page.tsx`
- Modify: `frontend/src/components/layout/NotificationBell.tsx`

- [ ] **Step 1 : `ResumeConstantes.tsx`** (alertes recalculées côté client : `findOne` renvoie la ligne brute)

```tsx
// frontend/src/components/constantes/ResumeConstantes.tsx
import { ageEnAnnees, calculerImc, evaluerConstantes, type ValeursConstantes } from '@/lib/constantes/seuils';
import { resumePrise } from '@/lib/constantes/affichage';
import type { Prise } from '@/lib/constantes/api';

/** Constantes rattachées à une consultation, avec leurs alertes */
export function ResumeConstantes({ constantes, dateNaissance }: { constantes: ValeursConstantes & Pick<Prise, 'datePrise'>; dateNaissance: string }) {
  const age = ageEnAnnees(dateNaissance, new Date(constantes.datePrise));
  const imc = calculerImc(constantes.poids, constantes.taille);
  const alertes = evaluerConstantes({ ...constantes, imc }, age);
  const prise = { ...constantes, imc, alertes } as unknown as Prise;
  return (
    <div className="px-6 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Constantes</p>
      <p className="text-gray-800">{resumePrise(prise)}</p>
      {alertes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {alertes.map((a) => (
            <li
              key={a.cle}
              className={`rounded-full px-2 py-0.5 text-xs ${a.niveau === 'critique' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800'}`}
            >
              {a.texte}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Détail de consultation** — dans `consultations/[id]/page.tsx`, importer `import { ResumeConstantes } from '@/components/constantes/ResumeConstantes';` et ajouter, comme **premier enfant** du bloc `<div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">` (avant le tableau Motif/Anamnèse…) :

```tsx
        {consultation.constantes && (
          <ResumeConstantes constantes={consultation.constantes} dateNaissance={consultation.patient.dateNaissance} />
        )}
```

- [ ] **Step 3 : Notification** — dans `NotificationBell.tsx`, remplacer le lien `{n.patientId && (<Link href={`/paiements?patientId=${n.patientId}`} …>Aller à la caisse →</Link>)}` par :

```tsx
                      {n.patientId && (
                        <Link
                          href={
                            n.type === 'CONSTANTES_ANORMALES'
                              ? `/patients/${n.patientId}?onglet=constantes`
                              : `/paiements?patientId=${n.patientId}`
                          }
                          className="mt-1 text-xs text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!n.lu) markOne.mutate(n.id);
                            setOpen(false);
                          }}
                        >
                          {n.type === 'CONSTANTES_ANORMALES' ? 'Voir les constantes →' : 'Aller à la caisse →'}
                        </Link>
                      )}
```

- [ ] **Step 4 : Vérifier**

Run: `cd frontend && npx jest && npx tsc --noEmit 2>&1 | grep -v "stock/page.tsx\|NouveauRdvModal.tsx" | grep "error TS"`
Expected: tests PASS ; la commande `grep` n'affiche rien.

Run: `cd frontend && npx next build`
Expected: build réussi.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/components "frontend/src/app/(dashboard)/consultations/[id]/page.tsx"
git commit -m "feat: show vital signs in consultation details and link the alert notification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15 : Tests de nuit (Playwright)

**Files:**
- Modify: `e2e/tests/parcours.spec.ts`
- Modify: `e2e/rapport/generer-rapport.ts` (`FICHIERS`)

- [ ] **Step 1 : Parcours 3** — dans `test('3. Patients : création et fiche', …)`, après l'étape « Fiche patient » et avant « Modifier le patient » :

```ts
  await etape(page, testInfo, 'Constantes — prise', async () => {
    await page.getByRole('button', { name: 'Prendre les constantes' }).click();
    const modale = page.getByRole('dialog', { name: 'Prendre les constantes' });
    await expect(modale).toBeVisible();
    await modale.locator('[name="tensionSystolique"]').fill('125');
    await modale.locator('[name="tensionDiastolique"]').fill('80');
    await modale.locator('[name="temperature"]').fill('37,2');
    await modale.locator('[name="poids"]').fill('72');
    await modale.locator('[name="taille"]').fill('170');
    await expect(modale.getByTestId('imc')).toHaveText('24,9');
    await controlerEcran(page, testInfo, 'Constantes — prise');
    await modale.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Constantes enregistrées')).toBeVisible();
  });

  await etape(page, testInfo, 'Constantes — onglet', async () => {
    await page.getByRole('button', { name: 'Constantes', exact: true }).click();
    await expect(page.getByText('Dernières valeurs')).toBeVisible();
    await controlerEcran(page, testInfo, 'Constantes — onglet');
  });
```

- [ ] **Step 2 : Parcours 5** — dans l'étape « Nouvelle consultation », après le remplissage de `diagnostic` et avant `controlerEcran` :

```ts
    await page.locator('[name="pouls"]').fill('76');
    await page.locator('[name="spo2"]').fill('98');
```

- [ ] **Step 3 : Rapport** — dans `FICHIERS` de `generer-rapport.ts`, ajouter :

```ts
  'Constantes — prise': 'frontend/src/components/constantes/PriseConstantesModal.tsx',
  'Constantes — onglet': 'frontend/src/components/constantes/OngletConstantes.tsx',
```

- [ ] **Step 4 : Lancer en local sur un frontend compilé**

Pré-requis : backend local lancé (`cd backend && npm run start:dev`), migration appliquée (Task 3), frontend compilé et servi (`cd frontend && npx next build && npx next start -p 3000`).

Run: `cd e2e && npx tsc --noEmit && npx playwright test`
Expected: 21 tests réussis. Puis `npm run rapport` : le rapport du jour contient les écrans « Constantes — prise » et « Constantes — onglet » ; **aucun chevauchement de champ** ni débordement horizontal sur ces deux écrans (sinon corriger les classes Tailwind du formulaire et relancer).

Les patients `TEST-E2E` restent désactivés en fin de parcours ; leurs prises de constantes restent en base locale (données fictives, comme leurs consultations).

- [ ] **Step 5 : Commit**

```bash
git add e2e/tests/parcours.spec.ts e2e/rapport/generer-rapport.ts
git commit -m "test: nightly journeys cover vital signs entry and tab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16 : Documentation et vérification finale

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1 : Mettre à jour `CLAUDE.md`**

- Titre « Modèles Prisma (16 modèles) » → « (17 modèles) » et ajouter `` · `Constantes` `` à la liste.
- Sous « Relations clés », ajouter : ``- `Constantes` → `Patient`, `Consultation` (consultationId unique, optionnel), `User` (priseParId)``.
- Dans « Architecture API », après la ligne `/consultations` :

```
/constantes          POST + /patient/:id + /patient/:id/du-jour + PATCH/DELETE :id (médecin, ou auteur le jour même)
```

- Dans « Pièges connus », ajouter la ligne :

```
| Seuils des constantes | `backend/src/constantes/seuils.ts` est recopié dans `frontend/src/lib/constantes/seuils.ts` : modifier les deux (un test du backend compare les fichiers) |
```

- [ ] **Step 2 : Vérification complète**

```bash
cd backend && npx jest
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npm run test:e2e
cd frontend && npx jest && npx next build
```
Expected : tout passe ; le build frontend réussit.

- [ ] **Step 3 : Contrôle manuel rapide** (frontend local, compte de démo local)

1. Se connecter `secretaire@cabinet.ma` / `Secretaire123!`, ouvrir un patient, « Prendre les constantes », saisir une température de 39,5 → pastille « élevée », enregistrer.
2. Se connecter `admin@cabinet.ma` / `Admin123!` : la cloche affiche « Constantes anormales — … : température 39,5 °C élevée » ; « Voir les constantes → » ouvre l'onglet Constantes.
3. « + Consultation » sur ce patient : le bloc Constantes est pré-rempli « Prises à … par Fatima … » ; enregistrer ; le détail de la consultation affiche la prise.
4. Sur un écran de 390 px de large (outils du navigateur), la modale et l'onglet n'ont ni chevauchement ni défilement horizontal.

Ne changer aucun mot de passe de démo.

- [ ] **Step 4 : Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the Constantes model and API

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Ne pas pousser ni ouvrir de PR sans l'accord de l'utilisateur.
