# Multi-cabinet étape 3 : gestion de l'équipe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le médecin titulaire peut modifier (nom, prénom, téléphone, email) et désactiver / réactiver les comptes de son cabinet depuis la page « Utilisateurs ».

**Architecture:** Deux routes `PATCH /auth/users/:id` et `PATCH /auth/users/:id/statut` dans `AuthController`, protégées par `@TitulaireSeulement()`, servies par `AuthService` avec le client filtré `this.prisma` (jamais `prismaSansFiltre`). La liste ajoute `telephone` et `rdvAVenir`. Côté frontend, deux modales sur le modèle de la page « Cabinets ».

**Tech Stack:** NestJS, Prisma 5, class-validator, Jest + Supertest ; Next.js 14, React Query, React Hook Form, Zod.

**Spec :** `docs/superpowers/specs/2026-11-08-multi-cabinet-equipe-design.md`.

---

## Règles communes (à lire avant toute tâche)

- Dépôt : `/Users/Mehdi/Work/code/cabinet-medical-maroc`, branche `feat/multi-cabinet-equipe`. Ne pas changer de branche, ne jamais pousser.
- Node 20 pour toute commande : `export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"`.
- E2E **uniquement** sur `cabinet_test` : `export TEST_DB="postgresql://postgres:password@localhost:5432/cabinet_test"`, puis `cd backend && DATABASE_URL="$TEST_DB" npx prisma migrate deploy && DATABASE_URL="$TEST_DB" npm run test:e2e`. Jamais `cabinet_medical` (les e2e vident la base).
- Un seul fichier e2e : `DATABASE_URL="$TEST_DB" npx jest --config test/jest-e2e.json test/equipe.e2e-spec.ts --runInBand`.
- Jamais `npm run lint` dans `backend` (il reformate tout) : `npx eslint <fichiers>`. Corriger les erreurs prettier des lignes qu'on écrit, pas celles qui existaient déjà.
- Frontend : `npx tsc --noEmit` a 4 erreurs connues (`stock/page.tsx`, `NouveauRdvModal.tsx`) ; ne pas en ajouter.
- Les identifiants de test ne sont pas des UUID (`test-admin-id`) : pas de `ParseUUIDPipe`, comme les routes existantes.
- Commits : message indiqué, puis ligne vide, puis `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Fichiers

| Fichier | Rôle |
|---|---|
| `backend/src/auth/dto/update-user.dto.ts` (nouveau) | `UpdateUserDto` |
| `backend/src/auth/dto/statut-user.dto.ts` (nouveau) | `StatutUserDto` |
| `backend/src/auth/auth.service.ts` | `selectUtilisateur()`, `versUtilisateur`, `listUsers`, `modifierUser`, `changerStatutUser`, `resetPassword` (409) |
| `backend/src/auth/auth.controller.ts` | 2 routes `PATCH` |
| `backend/test/equipe.e2e-spec.ts` (nouveau) | tests e2e de l'étape |
| `frontend/src/components/commun/useModale.ts` (déplacé depuis `components/cabinets/`) | hook des modales |
| `frontend/src/components/utilisateurs/types.ts` | `telephone`, `rdvAVenir` |
| `frontend/src/components/utilisateurs/EditUserModal.tsx` (nouveau) | modale « Modifier » |
| `frontend/src/components/utilisateurs/StatutUserModal.tsx` (nouveau) | modale « Désactiver / Réactiver » |
| `frontend/src/app/(dashboard)/utilisateurs/page.tsx` | boutons, badge |
| `CLAUDE.md` | routes et règles |

---

### Task 1 : Liste enrichie et reset refusé sur un compte désactivé

**Files:**
- Create: `backend/test/equipe.e2e-spec.ts`
- Modify: `backend/src/auth/auth.service.ts` (`listUsers`, `resetPassword`)

- [ ] **Step 1 : Écrire les tests e2e (rouges)**

Créer `backend/test/equipe.e2e-spec.ts` :

```ts
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
```

Si le modèle `RendezVous` exige d'autres champs obligatoires (vérifier `backend/prisma/schema.prisma`, modèle `RendezVous`), les ajouter à la fonction `rdv` avec des valeurs simples.

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `cd backend && DATABASE_URL="$TEST_DB" npx jest --config test/jest-e2e.json test/equipe.e2e-spec.ts --runInBand`
Expected: 2 échecs (`rdvAVenir` indéfini ; reset répond 201 au lieu de 409).

- [ ] **Step 3 : Implémenter**

Dans `backend/src/auth/auth.service.ts`, au-dessus de la classe (une fonction et non une constante : « maintenant » doit être recalculé à chaque appel) :

```ts
function selectUtilisateur() {
  return {
    id: true,
    nom: true,
    prenom: true,
    email: true,
    telephone: true,
    role: true,
    actif: true,
    doitChangerMdp: true,
    estTitulaire: true,
    createdAt: true,
    _count: {
      select: {
        rendezVous: {
          where: { dateHeure: { gte: new Date() }, statut: { not: StatutRDV.ANNULE } },
        },
      },
    },
  } satisfies Prisma.UserSelect;
}

function versUtilisateur<T extends { _count: { rendezVous: number } }>({ _count, ...u }: T) {
  return { ...u, rdvAVenir: _count.rendezVous };
}
```

Importer `StatutRDV` depuis `@prisma/client`, à côté de `Prisma`.

Remplacer `listUsers` :

```ts
  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: selectUtilisateur(),
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
    return users.map(versUtilisateur);
  }
```

Dans `resetPassword`, juste après `if (!user) throw new NotFoundException(...)` :

```ts
    if (!user.actif) {
      throw new ConflictException(
        'Le compte est désactivé : réactivez-le avant de réinitialiser son mot de passe.',
      );
    }
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `cd backend && npx tsc --noEmit && DATABASE_URL="$TEST_DB" npx jest --config test/jest-e2e.json test/equipe.e2e-spec.ts test/auth.e2e-spec.ts --runInBand`
Expected: tout vert.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/auth/auth.service.ts backend/test/equipe.e2e-spec.ts
git commit -m "feat: list team phone and upcoming appointments, refuse resetting a deactivated account"
```

---

### Task 2 : Modifier un compte

**Files:**
- Create: `backend/src/auth/dto/update-user.dto.ts`
- Modify: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`
- Test: `backend/test/equipe.e2e-spec.ts`

- [ ] **Step 1 : Tests e2e (rouges)**

Ajouter dans `equipe.e2e-spec.ts`, avant la dernière accolade du `describe` principal :

```ts
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

    it.each([
      [{}],
      [{ nom: null }],
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
      expect((await login(app, 'salma@cabinet.ma', 'Secretaire123!')).accessToken).toBeDefined();

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
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `cd backend && DATABASE_URL="$TEST_DB" npx jest --config test/jest-e2e.json test/equipe.e2e-spec.ts --runInBand`
Expected: les tests `PATCH /api/auth/users/:id` échouent (404 : route absente).

- [ ] **Step 3 : DTO**

Créer `backend/src/auth/dto/update-user.dto.ts` :

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, Matches, ValidateIf } from 'class-validator';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';

const Nettoye = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
// Écrit à la main : IsOptional laisserait passer null, refusé par la base (500)
const SiFourni = () => ValidateIf((_, v) => v !== undefined);

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @SiFourni()
  @Nettoye()
  @IsString()
  @IsNotEmpty()
  nom?: string;

  @ApiProperty({ required: false })
  @SiFourni()
  @Nettoye()
  @IsString()
  @IsNotEmpty()
  prenom?: string;

  @ApiProperty({ required: false })
  @SiFourni()
  @NormaliserEmail()
  @IsEmail({}, { message: 'Email invalide' })
  email?: string;

  // null ou '' efface le numéro
  @ApiProperty({ required: false, nullable: true, example: '0612345678' })
  @Nettoye()
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @Matches(/^0[5-7][0-9]{8}$/, { message: 'Téléphone marocain invalide' })
  telephone?: string | null;
}
```

Vérifier dans `backend/src/common/transforms/normaliser-email.ts` que `@NormaliserEmail()` laisse passer `null` tel quel (sinon `{ email: null }` planterait au lieu de répondre 400) ; le test `[{ email: null }]` le confirme.

- [ ] **Step 4 : Service**

Dans `auth.service.ts`, importer `UpdateUserDto` et ajouter :

```ts
  async modifierUser(titulaireId: string, id: string, dto: UpdateUserDto) {
    const champs = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    ) as UpdateUserDto;
    if (Object.keys(champs).length === 0) throw new BadRequestException('Aucune modification');

    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const emailChange = champs.email !== undefined && champs.email !== user.email;
    if (emailChange && id === titulaireId) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre email');
    }

    const data = {
      ...champs,
      ...(champs.telephone !== undefined && { telephone: champs.telephone || null }),
    };

    const [modifie] = await this.prisma
      .$transaction([
        this.prisma.user.update({ where: { id }, data, select: selectUtilisateur() }),
        // Nouvel identifiant de connexion : les sessions ouvertes avec l'ancien sont fermées
        ...(emailChange ? [this.prisma.refreshToken.deleteMany({ where: { userId: id } })] : []),
      ])
      .catch((e) => {
        // L'email est unique sur toute la plateforme : la contrainte de la base le garantit
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Email déjà utilisé');
        }
        throw e;
      });

    await this.audit.log(titulaireId, 'UPDATE_USER', 'User', id, {
      champs: Object.keys(champs),
      ...(emailChange && { email: champs.email }),
    });
    return versUtilisateur(modifie as Prisma.UserGetPayload<{ select: ReturnType<typeof selectUtilisateur> }>);
  }
```

Si TypeScript refuse le tableau mixte de `$transaction`, séparer : `const modifie = await this.prisma.$transaction(async (tx) => { ... })` n'est **pas** possible si le client filtré ne propage pas le filtre dans `tx` ; garder la forme tableau et typer le résultat avec un cast comme ci-dessus. Vérifier aussi que `this.prisma.refreshToken` est bien permis par le client filtré (`resetPassword` l'utilise déjà).

- [ ] **Step 5 : Route**

Dans `auth.controller.ts`, importer `Patch` et `UpdateUserDto`, puis ajouter après `listUsers` :

```ts
  @Patch('users/:id')
  @TitulaireSeulement()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Modifier un compte de l'équipe (titulaire)" })
  modifierUser(
    @CurrentUser('sub') titulaireId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.authService.modifierUser(titulaireId, id, dto);
  }
```

- [ ] **Step 6 : Lancer, vérifier le succès**

Run: `cd backend && npx tsc --noEmit && npx jest src/prisma && DATABASE_URL="$TEST_DB" npx jest --config test/jest-e2e.json test/equipe.e2e-spec.ts --runInBand`
Expected: tout vert, y compris le garde-fou `prisma-sans-filtre.spec.ts` (aucun nouvel accès sans filtre).

- [ ] **Step 7 : Lint et commit**

```bash
cd backend && npx eslint src/auth/auth.service.ts src/auth/auth.controller.ts src/auth/dto/update-user.dto.ts
cd .. && git add backend/src/auth backend/test/equipe.e2e-spec.ts
git commit -m "feat: let the cabinet owner edit team accounts"
```

---

### Task 3 : Désactiver / réactiver un compte

**Files:**
- Create: `backend/src/auth/dto/statut-user.dto.ts`
- Modify: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`
- Test: `backend/test/equipe.e2e-spec.ts`

- [ ] **Step 1 : Tests e2e (rouges)**

Ajouter dans `equipe.e2e-spec.ts` :

```ts
  describe('PATCH /api/auth/users/:id/statut', () => {
    const statut = (id: string, body: object, t = token) =>
      request(server()).patch(`/api/auth/users/${id}/statut`).set({ Authorization: `Bearer ${t}` }).send(body);

    it('désactive : connexion refusée, session coupée, refresh refusé, audit', async () => {
      const session = await login(app, 'dr.test@cabinet.ma', 'Medecin123!');

      const res = await statut(medecinId, { actif: false });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: medecinId, actif: false });

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
      expect((await login(app, 'dr.test@cabinet.ma', 'Medecin123!')).accessToken).toBeDefined();
      expect(await prisma.auditLog.count({ where: { action: 'REACTIVATE_USER', entiteId: medecinId } })).toBe(1);
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
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `cd backend && DATABASE_URL="$TEST_DB" npx jest --config test/jest-e2e.json test/equipe.e2e-spec.ts --runInBand`
Expected: les tests `statut` échouent (404 : route absente).

- [ ] **Step 3 : DTO**

Créer `backend/src/auth/dto/statut-user.dto.ts` :

```ts
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class StatutUserDto {
  // Valeur brute : la conversion implicite du ValidationPipe transformerait 'non' en true
  @ApiProperty() @Transform(({ obj }) => obj.actif) @IsBoolean() actif: boolean;
}
```

- [ ] **Step 4 : Service**

```ts
  async changerStatutUser(titulaireId: string, id: string, actif: boolean) {
    if (id === titulaireId) {
      throw new BadRequestException('Vous ne pouvez pas désactiver votre propre compte');
    }
    const user = await this.prisma.user.findUnique({ where: { id }, select: selectUtilisateur() });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    if (user.actif === actif) return versUtilisateur(user);

    const [modifie] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { actif }, select: selectUtilisateur() }),
      // Désactivation : les sessions ouvertes sont fermées tout de suite
      ...(actif ? [] : [this.prisma.refreshToken.deleteMany({ where: { userId: id } })]),
    ]);
    await this.audit.log(titulaireId, actif ? 'REACTIVATE_USER' : 'DEACTIVATE_USER', 'User', id);
    return versUtilisateur(modifie as Prisma.UserGetPayload<{ select: ReturnType<typeof selectUtilisateur> }>);
  }
```

Note : le test « 400 sur son propre compte » ne passe pas par la vérification d'existence, c'est voulu (son propre compte existe toujours).

- [ ] **Step 5 : Route**

Dans `auth.controller.ts`, importer `StatutUserDto`, puis :

```ts
  @Patch('users/:id/statut')
  @TitulaireSeulement()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Désactiver ou réactiver un compte de l'équipe (titulaire)" })
  changerStatutUser(
    @CurrentUser('sub') titulaireId: string,
    @Param('id') id: string,
    @Body() dto: StatutUserDto,
  ) {
    return this.authService.changerStatutUser(titulaireId, id, dto.actif);
  }
```

- [ ] **Step 6 : Vérifications complètes backend**

Run:
```bash
cd backend && npx tsc --noEmit && npx jest && DATABASE_URL="$TEST_DB" npm run test:e2e
npx eslint src/auth/auth.service.ts src/auth/auth.controller.ts src/auth/dto/statut-user.dto.ts src/auth/dto/update-user.dto.ts
```
Expected: tout vert, aucune erreur eslint dans ces fichiers.

- [ ] **Step 7 : Commit**

```bash
git add backend/src/auth backend/test/equipe.e2e-spec.ts
git commit -m "feat: let the cabinet owner deactivate and reactivate team accounts"
```

---

### Task 4 : Frontend — modale « Modifier »

**Files:**
- Move: `frontend/src/components/cabinets/useModale.ts` → `frontend/src/components/commun/useModale.ts`
- Modify: les 4 modales de `frontend/src/components/cabinets/` (import), `frontend/src/components/utilisateurs/types.ts`
- Create: `frontend/src/components/utilisateurs/EditUserModal.tsx`

- [ ] **Step 1 : Déplacer le hook**

```bash
mkdir -p frontend/src/components/commun
git mv frontend/src/components/cabinets/useModale.ts frontend/src/components/commun/useModale.ts
```

Dans `CreateCabinetModal.tsx`, `EditCabinetModal.tsx`, `StatutCabinetModal.tsx`, `ResetTitulaireModal.tsx`, remplacer `import { useModale } from './useModale';` par `import { useModale } from '@/components/commun/useModale';`.

- [ ] **Step 2 : Types**

Dans `frontend/src/components/utilisateurs/types.ts`, ajouter à `Utilisateur` :

```ts
  telephone: string | null;
  rdvAVenir: number;
```

et exporter :

```ts
export const TELEPHONE = /^0[5-7][0-9]{8}$/;
```

(`CreateUserModal.tsx` garde sa regex en ligne ; ne pas le modifier. Vérifier que `MotDePasseGenere` et les autres usages de `Utilisateur` compilent : `cree.user` renvoyé par `POST /auth/users` n'a pas `rdvAVenir` ; si TypeScript le signale, typer `Reponse.user` en `Omit<Utilisateur, 'rdvAVenir'>` dans `CreateUserModal.tsx` ou rendre `MotDePasseGenere` dépendant de `Pick<Utilisateur, 'prenom' | 'nom' | 'email'>`, selon ce qu'il utilise.)

- [ ] **Step 3 : Modale**

Créer `frontend/src/components/utilisateurs/EditUserModal.tsx` :

```tsx
'use client';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useModale } from '@/components/commun/useModale';
import { TELEPHONE, type Utilisateur } from './types';

const schema = z.object({
  prenom: z.string().trim().min(1, 'Prénom requis'),
  nom: z.string().trim().min(1, 'Nom requis'),
  email: z.string().trim().email('Email invalide'),
  telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide').or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 disabled:bg-gray-100 disabled:text-gray-500';
const errClass = 'text-xs text-red-600 mt-1';
const labelClass = 'text-sm font-medium text-gray-700';

export function EditUserModal({ utilisateur, onClose }: { utilisateur: Utilisateur; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user: moi, setUser } = useAuthStore();
  const soiMeme = moi?.id === utilisateur.id;

  const initial: FormData = {
    prenom: utilisateur.prenom,
    nom: utilisateur.nom,
    email: utilisateur.email,
    telephone: utilisateur.telephone ?? '',
  };
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  const mutation = useMutation({
    mutationFn: (changes: Partial<FormData>) =>
      apiClient.patch<Utilisateur>(`/auth/users/${utilisateur.id}`, changes).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (soiMeme && moi) setUser({ ...moi, nom: data.nom, prenom: data.prenom });
      toast.success('Compte modifié');
      onClose();
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setError('email', { message: 'Email déjà utilisé' });
        return;
      }
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Erreur lors de la modification');
    },
  });

  const envoyer = (data: FormData) => {
    // N'envoie que les champs modifiés ; son propre email n'est jamais envoyé
    const changes = Object.fromEntries(
      (Object.keys(data) as (keyof FormData)[])
        .filter(k => !(soiMeme && k === 'email'))
        .filter(k => data[k].trim() !== initial[k])
        .map(k => [k, data[k].trim()]),
    ) as Partial<FormData>;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(changes);
  };

  const uid = useId();
  const titreId = `${uid}-titre`;
  const champ = (nom: string, e?: { message?: string }) => ({
    id: `${uid}-${nom}`,
    'aria-invalid': !!e,
    'aria-describedby': e ? `${uid}-${nom}-err` : undefined,
  });
  const erreur = (nom: string, e?: { message?: string }) =>
    e && <p id={`${uid}-${nom}-err`} className={errClass}>{e.message}</p>;
  const modaleRef = useModale(onClose, mutation.isPending);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modaleRef} role="dialog" aria-modal="true" aria-labelledby={titreId} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 id={titreId} className="font-bold text-lg mb-4">Modifier {utilisateur.prenom} {utilisateur.nom}</h2>
        <form noValidate onSubmit={handleSubmit(envoyer)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-prenom`} className={labelClass}>Prénom *</label>
              <input {...register('prenom')} data-autofocus {...champ('prenom', errors.prenom)} className={inputClass} />
              {erreur('prenom', errors.prenom)}
            </div>
            <div>
              <label htmlFor={`${uid}-nom`} className={labelClass}>Nom *</label>
              <input {...register('nom')} {...champ('nom', errors.nom)} className={inputClass} />
              {erreur('nom', errors.nom)}
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-email`} className={labelClass}>Email *</label>
            <input type="email" autoComplete="off" disabled={soiMeme} {...register('email')} {...champ('email', errors.email)} className={inputClass} />
            {soiMeme && <p className="text-xs text-gray-500 mt-1">Vous ne pouvez pas modifier votre propre email.</p>}
            {erreur('email', errors.email)}
          </div>
          <div>
            <label htmlFor={`${uid}-telephone`} className={labelClass}>Téléphone</label>
            <input {...register('telephone')} placeholder="0612345678" {...champ('telephone', errors.telephone)} className={inputClass} />
            {erreur('telephone', errors.telephone)}
          </div>
          {!soiMeme && (
            <p className="text-xs text-gray-500">Si l'email change, la personne est déconnectée et se reconnecte avec le nouvel email, sans changer de mot de passe.</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {mutation.isPending ? '...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

Attention : un champ `disabled` n'est pas renvoyé par React Hook Form (`data.email` peut être `undefined`). Le filtre `soiMeme && k === 'email'` l'écarte avant tout appel à `.trim()` ; garder cet ordre.

- [ ] **Step 4 : Vérifier**

Run: `cd frontend && npx tsc --noEmit && npx eslint src/components/utilisateurs src/components/commun src/components/cabinets`
Expected: seulement les 4 erreurs tsc connues ; eslint sans erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/components
git commit -m "feat: add team account edit modal and share the modal hook"
```

---

### Task 5 : Frontend — statut et page « Utilisateurs »

**Files:**
- Create: `frontend/src/components/utilisateurs/StatutUserModal.tsx`
- Modify: `frontend/src/app/(dashboard)/utilisateurs/page.tsx`

- [ ] **Step 1 : Modale de statut**

Créer `frontend/src/components/utilisateurs/StatutUserModal.tsx` :

```tsx
'use client';
import { useId } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useModale } from '@/components/commun/useModale';
import type { Utilisateur } from './types';

export function StatutUserModal({ utilisateur, onClose }: { utilisateur: Utilisateur; onClose: () => void }) {
  const queryClient = useQueryClient();
  const desactiver = utilisateur.actif;
  const nom = `${utilisateur.prenom} ${utilisateur.nom}`;

  const mutation = useMutation({
    mutationFn: () => apiClient.patch(`/auth/users/${utilisateur.id}/statut`, { actif: !desactiver }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(desactiver ? 'Compte désactivé' : 'Compte réactivé');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors du changement'),
  });

  const titreId = `${useId()}-titre`;
  const modaleRef = useModale(onClose, mutation.isPending);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modaleRef} role="dialog" aria-modal="true" aria-labelledby={titreId} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 id={titreId} className="font-bold text-lg mb-3">{desactiver ? 'Désactiver le compte' : 'Réactiver le compte'}</h2>
        <p className="text-sm text-gray-600">
          {desactiver
            ? `Désactiver le compte de ${nom} ? La personne sera déconnectée et ne pourra plus se connecter. Ses données sont conservées.`
            : `Réactiver le compte de ${nom} ? La personne pourra de nouveau se connecter avec son mot de passe actuel.`}
        </p>
        {desactiver && utilisateur.rdvAVenir > 0 && (
          <p className="text-sm text-orange-700 bg-orange-50 rounded-lg p-3 mt-3">
            {utilisateur.rdvAVenir} rendez-vous à venir restent dans l'agenda.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-5">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
            Annuler
          </button>
          <button
            type="button"
            data-autofocus
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`px-6 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${desactiver ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {mutation.isPending ? '...' : desactiver ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Page**

Dans `frontend/src/app/(dashboard)/utilisateurs/page.tsx` :

1. Imports : `EditUserModal`, `StatutUserModal`.
2. Remplacer l'état `cible` par trois états :
   ```tsx
   const [aReinitialiser, setAReinitialiser] = useState<Utilisateur | null>(null);
   const [aModifier, setAModifier] = useState<Utilisateur | null>(null);
   const [aChangerStatut, setAChangerStatut] = useState<Utilisateur | null>(null);
   ```
3. Ligne : `<tr key={u.id} className={`hover:bg-gray-50 transition ${u.actif ? '' : 'opacity-60'}`}>`.
4. Colonne « Statut » : libellé `{u.actif ? 'Actif' : 'Désactivé'}`.
5. Ligne mobile (`sm:hidden`) : ajouter `{!u.actif && ' · Désactivé'}` après le rôle.
6. Colonne « Actions » :
   ```tsx
   <td className="px-4 py-3">
     <div className="flex flex-wrap gap-x-4 gap-y-1">
       <button onClick={() => setAModifier(u)} aria-label={`Modifier ${u.prenom} ${u.nom}`} className="text-sm text-blue-600 hover:text-blue-800">
         Modifier
       </button>
       {u.id !== user?.id && (
         <>
           <button
             onClick={() => setAChangerStatut(u)}
             aria-label={`${u.actif ? 'Désactiver' : 'Réactiver'} ${u.prenom} ${u.nom}`}
             className={`text-sm ${u.actif ? 'text-red-600 hover:text-red-800' : 'text-blue-600 hover:text-blue-800'}`}
           >
             {u.actif ? 'Désactiver' : 'Réactiver'}
           </button>
           {u.actif && (
             <button onClick={() => setAReinitialiser(u)} aria-label={`Réinitialiser le mot de passe de ${u.prenom} ${u.nom}`} className="text-sm text-blue-600 hover:text-blue-800">
               Réinitialiser le mot de passe
             </button>
           )}
         </>
       )}
     </div>
   </td>
   ```
7. Modales en bas :
   ```tsx
   {aReinitialiser && <ResetModal utilisateur={aReinitialiser} onClose={() => setAReinitialiser(null)} />}
   {aModifier && <EditUserModal utilisateur={aModifier} onClose={() => setAModifier(null)} />}
   {aChangerStatut && <StatutUserModal utilisateur={aChangerStatut} onClose={() => setAChangerStatut(null)} />}
   ```

- [ ] **Step 3 : Vérifier**

Run: `cd frontend && npx tsc --noEmit && npx eslint "src/app/(dashboard)/utilisateurs" src/components/utilisateurs`
Expected: seulement les 4 erreurs tsc connues ; eslint sans erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/src
git commit -m "feat: add edit and deactivate actions to the users page"
```

---

### Task 6 : Parcours navigateur, vérifications et documentation

**Files:**
- Modify: `CLAUDE.md`, ce plan (cases cochées)

- [ ] **Step 1 : Parcours Playwright sur la base locale**

Démarrer Docker (`docker compose -f docker-compose.dev.yml up -d`), le backend (`cd backend && npm run start:dev`, avec `MINIO_ENDPOINT=http://localhost:9000`) et le frontend (`cd frontend && npm run dev`) en arrière-plan. Si un serveur tourne déjà sur 3000/3001, vérifier ce que c'est avant d'agir ; n'arrêter à la fin que ceux qu'on a lancés.

Avec les outils Playwright sur http://localhost:3000, connecté en `admin@cabinet.ma` / `Admin123!` (ne jamais changer ce mot de passe) :

1. Créer un compte de test (« + Nouvel utilisateur », secrétaire, email `equipe.test@cabinet.ma`), noter le mot de passe affiché.
2. « Modifier » : erreurs (prénom vide, téléphone `0123`), email `dr.benali@cabinet.ma` → « Email déjà utilisé » sous l'email ; puis changement du nom et du téléphone → toast, liste à jour. Ouvrir et fermer sans rien changer : aucun appel réseau.
3. Dans un autre contexte de navigateur, se connecter avec le compte de test (changement forcé du mot de passe). Puis, côté titulaire, changer son email en `equipe.test2@cabinet.ma` : l'autre session est renvoyée à la connexion à son prochain renouvellement ; connexion avec le nouvel email et le même mot de passe.
4. « Désactiver » le compte de test : ligne grisée, badge « Désactivé », bouton « Réinitialiser » masqué ; l'autre session est coupée à son action suivante et la connexion est refusée.
5. « Désactiver » un médecin qui a des rendez-vous à venir (en créer un pour `dr.benali@cabinet.ma` si besoin, puis le supprimer) : l'avertissement « N rendez-vous à venir » s'affiche ; annuler.
6. « Réactiver » le compte de test : la connexion refonctionne.
7. Ligne du titulaire : seulement « Modifier », champ email grisé ; changer son prénom met à jour l'en-tête, puis remettre la valeur d'origine.
8. Échap ferme les modales ; aucune erreur JavaScript dans la console.

Nettoyer ensuite `cabinet_medical` par des requêtes ciblées sur les identifiants créés (compte de test, ses refresh tokens, ses lignes d'audit et celles du titulaire écrites pendant le parcours, rendez-vous de test). Aucun `DELETE` sans `WHERE` sur un identifiant créé. Compter avant / après. Arrêter les serveurs lancés.

- [ ] **Step 2 : Vérifications complètes**

```bash
cd backend && npx tsc --noEmit && npx jest && DATABASE_URL="$TEST_DB" npm run test:e2e
cd ../frontend && npx tsc --noEmit && npm run build
```

Expected : tout vert (4 erreurs tsc frontend connues). `next build` seulement après l'arrêt du serveur de dev. Noter les nombres de tests.

- [ ] **Step 3 : `CLAUDE.md`**

Dans « Architecture API », remplacer la ligne des users de `/auth` par :

```
                     users (GET liste / POST création / PATCH :id modification / PATCH :id/statut)
                     + users/:id/reset-password  (titulaire)
```

Dans « Multi-cabinet : isolation », ajouter :

```markdown
- Le titulaire modifie (nom, prénom, téléphone, email) et désactive / réactive les comptes de son cabinet. Changer l'email ou désactiver supprime les refresh tokens dans la même transaction ; il ne peut ni changer son propre email ni désactiver son propre compte. L'unicité de l'email à la modification repose sur la contrainte de la base (`P2002` → 409), sans `PrismaSansFiltre`.
- Un compte désactivé ne peut pas être réinitialisé (409) ; ses données restent visibles par le cabinet.
```

- [ ] **Step 4 : Cocher le plan et commit**

Cocher toutes les cases de ce plan, ajouter sous le titre : `Statut : réalisé le <date> sur la branche feat/multi-cabinet-equipe, non mergé.`

```bash
git add CLAUDE.md docs/superpowers/plans/2026-11-08-multi-cabinet-equipe.md
git commit -m "docs: document team management and check off the plan"
```
