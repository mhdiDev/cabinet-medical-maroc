# Modification du mot de passe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque utilisateur de changer son mot de passe (page « Mon compte ») et à l'admin de réinitialiser celui d'un autre utilisateur, avec changement forcé à la connexion suivante.

**Architecture:** Un champ `User.doitChangerMdp` est relu à chaque requête par `JwtStrategy` ; `JwtAuthGuard` renvoie 403 `MUST_CHANGE_PASSWORD` sauf sur les routes marquées `@AutoriseSiMdpAChanger()`. Le frontend redirige vers `/mon-compte` tant que le flag est actif (layout + intercepteur axios). L'admin dispose d'une page `/utilisateurs` (liste + reset).

**Tech Stack:** NestJS, Prisma, argon2, Jest/Supertest (backend) ; Next.js 14, Zustand, React Query, React Hook Form + Zod, react-hot-toast (frontend).

**Spec :** `docs/superpowers/specs/2026-10-31-modification-mot-de-passe-design.md`

## Statut (2026-10-31)

Tâches 1 à 9 faites sur la branche `feat/modification-mot-de-passe`, PR vers `master` ouverte, **non mergée**.

### Décisions prises

- Périmètre : self-service (« Mon compte ») + réinitialisation admin (« Utilisateurs », liste + reset seulement, pas de création/désactivation de comptes dans l'UI).
- Après une réinitialisation admin, changement **forcé** à la connexion suivante, appliqué côté API (guard) et pas seulement côté frontend.
- Ancien mot de passe incorrect → **400** (et non 401, que l'intercepteur axios traite comme un token expiré).
- Pas de `ParseUUIDPipe` sur `:id` (les ids de test e2e ne sont pas des UUID) ; un id inconnu donne 404.
- Mise à jour du mot de passe et révocation des sessions dans une transaction Prisma (retour de revue).
- Frontend : le polling des notifications est coupé pendant un changement forcé (sinon un 403 tardif rebloquait l'utilisateur), et `/mon-compte` resynchronise le flag via `GET /auth/me` (changement fait depuis un autre appareil).
- Tableau `/utilisateurs` sur le modèle de la page Stock (colonnes secondaires masquées en mobile).

### Vérifications

Unitaires 27/27, e2e 47/47 (base `cabinet_test`), `next build` OK, parcours navigateur Playwright 24/24 (reset admin, redirection forcée, erreur sans déconnexion, accès rétabli, médecin sans accès à `/utilisateurs`, mobile 375 px).

### Reste à faire

- [ ] Revue et merge de la PR.
- [ ] Déploiement : la migration `add_doit_changer_mdp` est appliquée par `prisma migrate deploy` au démarrage du backend ; vérifier après déploiement.
- [ ] En production : changer les mots de passe des comptes de démo via « Mon compte ».
- [ ] Optionnel (hors spec) : forcer aussi le changement pour les comptes créés par `POST /auth/users`.
- [ ] Optionnel : vider le cache React Query à la déconnexion ; renvoyer un `code` d'erreur pour « ancien mot de passe incorrect » au lieu de comparer le message.

---

## Prérequis d'environnement

- **Node 20** : avant toute commande npm/npx, `export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"` (ou `nvm use 20`).
- Infra locale : `docker compose -f docker-compose.dev.yml up -d` (PostgreSQL `postgres:password@localhost:5432`).
- **Les tests e2e vident la base** (`resetDb`). Ne jamais les lancer sur `cabinet_medical`. Utiliser une base dédiée `cabinet_test` :

```bash
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -c "CREATE DATABASE cabinet_test" || true
export TEST_DB="postgresql://postgres:password@localhost:5432/cabinet_test"
cd backend && DATABASE_URL="$TEST_DB" npx prisma migrate deploy
```

## Structure des fichiers

**Backend**
| Fichier | Action | Responsabilité |
|---|---|---|
| `backend/prisma/schema.prisma` | Modifier | Champ `doitChangerMdp` |
| `backend/prisma/migrations/<ts>_add_doit_changer_mdp/` | Créer (généré) | Migration SQL |
| `backend/src/common/decorators/autorise-si-mdp-a-changer.decorator.ts` | Créer | Métadonnée d'exemption |
| `backend/src/common/guards/jwt-auth.guard.ts` | Modifier | Blocage 403 si flag actif |
| `backend/src/auth/strategies/jwt.strategy.ts` | Modifier | Sélection du flag |
| `backend/src/auth/dto/reset-password.dto.ts` | Créer | DTO reset admin |
| `backend/src/auth/auth.module.ts` | Modifier | Import `AuditModule` |
| `backend/src/auth/auth.service.ts` | Modifier | `changePassword`, `listUsers`, `resetPassword` |
| `backend/src/auth/auth.controller.ts` | Modifier | Routes + décorateur |
| `backend/src/auth/auth.service.spec.ts` | Modifier | Tests unitaires |
| `backend/test/helpers.ts` | Modifier | `seedTestSecretaire`, `login` |
| `backend/test/auth.e2e-spec.ts` | Modifier | Tests e2e |

**Frontend**
| Fichier | Action | Responsabilité |
|---|---|---|
| `frontend/src/store/auth.ts` | Modifier | Flag + `setTokens` / `setDoitChangerMdp` |
| `frontend/src/lib/api.ts` | Modifier | 403 `MUST_CHANGE_PASSWORD` → redirection |
| `frontend/src/app/(dashboard)/layout.tsx` | Modifier | Redirection forcée |
| `frontend/src/components/layout/Sidebar.tsx` | Modifier | Items « Mon compte » / « Utilisateurs » |
| `frontend/src/app/(dashboard)/mon-compte/page.tsx` | Créer | Self-service |
| `frontend/src/app/(dashboard)/utilisateurs/page.tsx` | Créer | Liste + reset admin |

---

### Task 1: Champ Prisma `doitChangerMdp`

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `User`)
- Create: `backend/prisma/migrations/<timestamp>_add_doit_changer_mdp/migration.sql` (généré)

- [x] **Step 1: Ajouter le champ**

Dans `model User`, juste après `actif        Boolean  @default(true)` :

```prisma
  doitChangerMdp Boolean @default(false)
```

- [x] **Step 2: Générer la migration**

```bash
cd backend && npx prisma migrate dev --name add_doit_changer_mdp
```

Expected : nouveau dossier `prisma/migrations/<timestamp>_add_doit_changer_mdp/` contenant
`ALTER TABLE "users" ADD COLUMN "doitChangerMdp" BOOLEAN NOT NULL DEFAULT false;` et client Prisma régénéré.

- [x] **Step 3: Appliquer à la base de test**

```bash
cd backend && DATABASE_URL="$TEST_DB" npx prisma migrate deploy
```

Expected : `1 migration applied` (ou `No pending migrations` si déjà fait).

- [x] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add User.doitChangerMdp field"
```

---

### Task 2: Service — `changePassword` enrichi

**Files:**
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/auth/auth.service.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

- [x] **Step 1: Brancher `AuditService` dans le test unitaire et écrire les tests qui échouent**

Dans `backend/src/auth/auth.service.spec.ts` :

Remplacer l'import `@nestjs/common` par :

```ts
import { UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
```

Ajouter l'import :

```ts
import { AuditService } from '../audit/audit.service';
```

Remplacer `mockPrisma` et ajouter `mockAudit` :

```ts
const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  refreshToken: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
};

const mockAudit = { log: jest.fn() };
```

Ajouter le provider dans `Test.createTestingModule` :

```ts
        { provide: AuditService, useValue: mockAudit },
```

Ajouter à la fin du `describe('AuthService')` :

```ts
  describe('changePassword', () => {
    const userAvecMdp = async (mdp: string) => ({
      id: 'u1', email: 'test@ma', role: Role.SECRETAIRE,
      motDePasse: await argon2.hash(mdp), doitChangerMdp: true,
    });

    it('lève BadRequestException si ancien mot de passe incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await userAvecMdp('Ancien123!'));
      await expect(service.changePassword('u1', 'Faux123!', 'Nouveau123!'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si nouveau identique à l\'ancien', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await userAvecMdp('Ancien123!'));
      await expect(service.changePassword('u1', 'Ancien123!', 'Ancien123!'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si utilisateur inexistant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.changePassword('u1', 'Ancien123!', 'Nouveau123!'))
        .rejects.toThrow(NotFoundException);
    });

    it('met à jour le hash, lève le flag, révoque les sessions et renvoie de nouveaux tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(await userAvecMdp('Ancien123!'));

      const res = await service.changePassword('u1', 'Ancien123!', 'Nouveau123!');

      const updateArg = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'u1' });
      expect(updateArg.data.doitChangerMdp).toBe(false);
      expect(await argon2.verify(updateArg.data.motDePasse, 'Nouveau123!')).toBe(true);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(mockAudit.log).toHaveBeenCalledWith('u1', 'CHANGE_PASSWORD', 'User', 'u1');
      expect(res.accessToken).toBe('mock-token');
      expect(res.refreshToken).toBeDefined();
    });
  });
```

- [x] **Step 2: Lancer les tests — ils échouent**

```bash
cd backend && npx jest src/auth/auth.service.spec.ts
```

Expected : FAIL sur les tests `changePassword` (`UnauthorizedException` reçue au lieu de `BadRequestException`, `res` undefined, `deleteMany` non appelé). Les tests `validateUser` / `login` passent.

- [x] **Step 3: Importer `AuditModule` dans `AuthModule`**

Dans `backend/src/auth/auth.module.ts`, ajouter l'import :

```ts
import { AuditModule } from '../audit/audit.module';
```

et l'ajouter à `imports` :

```ts
  imports: [
    PassportModule,
    AuditModule,
    JwtModule.register({
```

- [x] **Step 4: Implémenter dans `AuthService`**

Dans `backend/src/auth/auth.service.ts` :

Ajouter `BadRequestException` aux imports `@nestjs/common` :

```ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
```

Ajouter l'import :

```ts
import { AuditService } from '../audit/audit.service';
```

Constructeur :

```ts
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}
```

Remplacer intégralement `changePassword` :

```ts
  async changePassword(userId: string, ancienMdp: string, nouveauMdp: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    // 400 et non 401 : un 401 déclencherait le refresh/déconnexion côté frontend
    const valid = await argon2.verify(user.motDePasse, ancienMdp);
    if (!valid) throw new BadRequestException('Ancien mot de passe incorrect');

    if (ancienMdp === nouveauMdp) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'ancien');
    }

    const hash = await argon2.hash(nouveauMdp);
    await this.prisma.user.update({
      where: { id: userId },
      data: { motDePasse: hash, doitChangerMdp: false },
    });

    // Révoque toutes les sessions, puis en ouvre une nouvelle pour l'appelant
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.audit.log(userId, 'CHANGE_PASSWORD', 'User', userId);

    return this.generateTokens(user.id, user.email, user.role);
  }
```

- [x] **Step 5: Lancer les tests — ils passent**

```bash
cd backend && npx jest src/auth/auth.service.spec.ts
```

Expected : PASS (tous les tests, y compris les anciens `validateUser` / `login`).

- [x] **Step 6: Commit**

```bash
git add backend/src/auth/auth.module.ts backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat: revoke sessions and clear forced-change flag on password change"
```

---

### Task 3: Service — `listUsers` et `resetPassword`

**Files:**
- Modify: `backend/src/auth/auth.service.ts`
- Test: `backend/src/auth/auth.service.spec.ts`

- [x] **Step 1: Écrire les tests qui échouent**

Ajouter à la fin du `describe('AuthService')` :

```ts
  describe('listUsers', () => {
    it('liste les utilisateurs sans le mot de passe, triés par nom puis prénom', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await service.listUsers();

      const arg = mockPrisma.user.findMany.mock.calls[0][0];
      expect(arg.orderBy).toEqual([{ nom: 'asc' }, { prenom: 'asc' }]);
      expect(arg.select.motDePasse).toBeUndefined();
      expect(arg.select).toMatchObject({
        id: true, nom: true, prenom: true, email: true, role: true,
        actif: true, doitChangerMdp: true, createdAt: true,
      });
    });
  });

  describe('resetPassword', () => {
    it('lève BadRequestException si l\'admin cible son propre compte', async () => {
      await expect(service.resetPassword('admin1', 'admin1', 'Temp1234!'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si utilisateur inexistant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('admin1', 'u1', 'Temp1234!'))
        .rejects.toThrow(NotFoundException);
    });

    it('définit le mot de passe, force le changement, révoque les sessions et audite', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      const res = await service.resetPassword('admin1', 'u1', 'Temp1234!');

      const updateArg = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'u1' });
      expect(updateArg.data.doitChangerMdp).toBe(true);
      expect(await argon2.verify(updateArg.data.motDePasse, 'Temp1234!')).toBe(true);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(mockAudit.log).toHaveBeenCalledWith('admin1', 'RESET_PASSWORD', 'User', 'u1');
      expect(res).toEqual({ success: true });
    });
  });
```

- [x] **Step 2: Lancer — échec**

```bash
cd backend && npx jest src/auth/auth.service.spec.ts
```

Expected : FAIL — `service.listUsers is not a function`, `service.resetPassword is not a function`.

- [x] **Step 3: Implémenter**

Dans `backend/src/auth/auth.service.ts`, ajouter après `changePassword` :

```ts
  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true, nom: true, prenom: true, email: true, role: true,
        actif: true, doitChangerMdp: true, createdAt: true,
      },
      orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
    });
  }

  async resetPassword(adminId: string, userId: string, nouveauMdp: string) {
    if (adminId === userId) {
      throw new BadRequestException('Utilisez « Mon compte » pour changer votre propre mot de passe');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const hash = await argon2.hash(nouveauMdp);
    await this.prisma.user.update({
      where: { id: userId },
      data: { motDePasse: hash, doitChangerMdp: true },
    });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    await this.audit.log(adminId, 'RESET_PASSWORD', 'User', userId);

    return { success: true };
  }
```

- [x] **Step 4: Lancer — succès**

```bash
cd backend && npx jest src/auth/auth.service.spec.ts
```

Expected : PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat: add admin user listing and password reset to AuthService"
```

---

### Task 4: Guard, décorateur, stratégie JWT et routes

**Files:**
- Create: `backend/src/common/decorators/autorise-si-mdp-a-changer.decorator.ts`
- Create: `backend/src/auth/dto/reset-password.dto.ts`
- Modify: `backend/src/common/guards/jwt-auth.guard.ts`
- Modify: `backend/src/auth/strategies/jwt.strategy.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Modify: `backend/test/helpers.ts`
- Test: `backend/test/auth.e2e-spec.ts`

- [x] **Step 1: Helpers e2e**

Dans `backend/test/helpers.ts`, ajouter à la fin :

```ts
export async function seedTestSecretaire(prisma: PrismaService): Promise<string> {
  const hash = await argon2.hash('Secretaire123!');
  const user = await prisma.user.create({
    data: {
      id: 'test-secretaire-id',
      email: 'secretaire@cabinet.ma',
      motDePasse: hash,
      nom: 'Alaoui',
      prenom: 'Fatima',
      role: Role.SECRETAIRE,
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
```

- [x] **Step 2: Écrire les tests e2e qui échouent**

Dans `backend/test/auth.e2e-spec.ts` :

Remplacer l'import des helpers :

```ts
import { createApp, login, loginAdmin, resetDb, seedTestSecretaire, seedTestUser } from './helpers';
```

Dans le `beforeAll`, après `await seedTestUser(prisma);` :

```ts
    secretaireId = await seedTestSecretaire(prisma);
```

et déclarer en haut du `describe` (à côté de `let prisma`) :

```ts
  let secretaireId: string;
```

Ajouter à la fin du `describe('Auth (e2e)')` (après le bloc `POST /api/auth/refresh`) :

```ts
  describe('GET /api/auth/users', () => {
    it('200 pour l\'admin, sans motDePasse', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0].motDePasse).toBeUndefined();
      expect(res.body[0].doitChangerMdp).toBeDefined();
    });

    it('403 pour une secrétaire', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      const res = await request(app.getHttpServer())
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/auth/users/:id/reset-password — validations', () => {
    it('403 pour une secrétaire', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/test-admin-id/reset-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nouveauMdp: 'Temp1234!' });

      expect(res.status).toBe(403);
    });

    it('400 si mot de passe trop court', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post(`/api/auth/users/${secretaireId}/reset-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nouveauMdp: 'court' });

      expect(res.status).toBe(400);
    });

    it('400 si l\'admin cible son propre compte', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/test-admin-id/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ nouveauMdp: 'Temp1234!' });

      expect(res.status).toBe(400);
    });

    it('404 si utilisateur inexistant', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/inexistant/reset-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ nouveauMdp: 'Temp1234!' });

      expect(res.status).toBe(404);
    });
  });

  describe('Scénario : réinitialisation admin puis changement forcé', () => {
    it('bloque l\'API jusqu\'au changement, puis rétablit l\'accès', async () => {
      const server = app.getHttpServer();
      const adminToken = await loginAdmin(app);

      // 1. L'admin réinitialise le mot de passe de la secrétaire
      const reset = await request(server)
        .post(`/api/auth/users/${secretaireId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nouveauMdp: 'Temp1234!' });
      expect(reset.status).toBe(201);

      // 2. Connexion avec le mot de passe temporaire
      const session = await login(app, 'secretaire@cabinet.ma', 'Temp1234!');
      expect(session.user.doitChangerMdp).toBe(true);
      const auth = { Authorization: `Bearer ${session.accessToken}` };

      // 3. API bloquée, sauf les routes autorisées
      const bloque = await request(server).get('/api/patients').set(auth);
      expect(bloque.status).toBe(403);
      expect(bloque.body.code).toBe('MUST_CHANGE_PASSWORD');

      const me = await request(server).get('/api/auth/me').set(auth);
      expect(me.status).toBe(200);

      // 3b. Le nouveau mot de passe ne peut pas être le temporaire
      const identique = await request(server)
        .post('/api/auth/change-password').set(auth)
        .send({ ancienMdp: 'Temp1234!', nouveauMdp: 'Temp1234!' });
      expect(identique.status).toBe(400);

      // 4. Changement du mot de passe → nouveaux tokens
      const change = await request(server)
        .post('/api/auth/change-password').set(auth)
        .send({ ancienMdp: 'Temp1234!', nouveauMdp: 'Secretaire456!' });
      expect(change.status).toBe(201);
      expect(change.body.accessToken).toBeDefined();
      expect(change.body.refreshToken).toBeDefined();

      // 5. Accès rétabli avec le nouveau token
      const ok = await request(server)
        .get('/api/patients')
        .set('Authorization', `Bearer ${change.body.accessToken}`);
      expect(ok.status).toBe(200);

      // 6. L'ancien refresh token est révoqué
      const refresh = await request(server)
        .post('/api/auth/refresh')
        .send({ refreshToken: session.refreshToken });
      expect(refresh.status).toBe(401);
    });

    it('400 si ancien mot de passe incorrect', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire456!');
      const res = await request(app.getHttpServer())
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ancienMdp: 'Faux1234!', nouveauMdp: 'Autre1234!' });

      expect(res.status).toBe(400);
    });
  });
```

- [x] **Step 3: Lancer — échec**

```bash
cd backend && DATABASE_URL="$TEST_DB" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/auth.e2e-spec.ts
```

Expected : FAIL — `GET /api/auth/users` renvoie 404, reset-password 404, etc. Les tests existants (login, me, refresh) passent toujours.

- [x] **Step 4: Créer le décorateur**

`backend/src/common/decorators/autorise-si-mdp-a-changer.decorator.ts` :

```ts
import { SetMetadata } from '@nestjs/common';

export const AUTORISE_SI_MDP_A_CHANGER_KEY = 'autoriseSiMdpAChanger';

// Route accessible même si l'utilisateur doit changer son mot de passe
export const AutoriseSiMdpAChanger = () => SetMetadata(AUTORISE_SI_MDP_A_CHANGER_KEY, true);
```

- [x] **Step 5: Modifier `JwtAuthGuard`**

Remplacer intégralement `backend/src/common/guards/jwt-auth.guard.ts` :

```ts
import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AUTORISE_SI_MDP_A_CHANGER_KEY } from '../decorators/autorise-si-mdp-a-changer.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = (await super.canActivate(context)) as boolean;
    if (!authenticated) return false;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.doitChangerMdp) return true;

    const autorise = this.reflector.getAllAndOverride<boolean>(AUTORISE_SI_MDP_A_CHANGER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (autorise) return true;

    throw new ForbiddenException({
      code: 'MUST_CHANGE_PASSWORD',
      message: 'Vous devez changer votre mot de passe',
    });
  }
}
```

- [x] **Step 6: Exposer le flag dans `JwtStrategy`**

Dans `backend/src/auth/strategies/jwt.strategy.ts`, remplacer la ligne `select` :

```ts
      select: { id: true, email: true, nom: true, prenom: true, role: true, actif: true, doitChangerMdp: true },
```

- [x] **Step 7: Créer le DTO**

`backend/src/auth/dto/reset-password.dto.ts` :

```ts
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  nouveauMdp: string;
}
```

- [x] **Step 8: Routes du contrôleur**

Dans `backend/src/auth/auth.controller.ts` :

Remplacer la première ligne d'import :

```ts
import { Controller, Post, Body, UseGuards, Req, Get, Param } from '@nestjs/common';
```

Ajouter les imports :

```ts
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AutoriseSiMdpAChanger } from '../common/decorators/autorise-si-mdp-a-changer.decorator';
```

Ajouter `@AutoriseSiMdpAChanger()` sous `@UseGuards(JwtAuthGuard)` des routes `logout`, `me` et `change-password`. Exemple pour `logout` :

```ts
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @AutoriseSiMdpAChanger()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Déconnexion' })
  logout(@CurrentUser('sub') userId: string) {
    return this.authService.logout(userId);
  }
```

Même ajout (ligne `@AutoriseSiMdpAChanger()` après `@UseGuards(JwtAuthGuard)`) sur `@Get('me')` et `@Post('change-password')`.

Ajouter après `createUser` :

```ts
  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lister les utilisateurs (admin)' })
  listUsers() {
    return this.authService.listUsers();
  }

  @Post('users/:id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Réinitialiser le mot de passe d\'un utilisateur (admin)' })
  resetPassword(
    @CurrentUser('sub') adminId: string,
    @Param('id') userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(adminId, userId, dto.nouveauMdp);
  }
```

- [x] **Step 9: Lancer e2e auth — succès**

```bash
cd backend && DATABASE_URL="$TEST_DB" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/auth.e2e-spec.ts
```

Expected : PASS (tous les tests du fichier).

- [x] **Step 10: Lancer toute la suite backend (non-régression du guard)**

```bash
cd backend && npx jest && DATABASE_URL="$TEST_DB" npm run test:e2e && npx tsc --noEmit -p tsconfig.json
```

Expected : tous les tests unitaires et e2e PASS, aucune erreur TypeScript.

- [x] **Step 11: Commit**

```bash
git add backend/src backend/test
git commit -m "feat: admin password reset and forced password change enforcement"
```

---

### Task 5: Frontend — store et intercepteur axios

**Files:**
- Modify: `frontend/src/store/auth.ts`
- Modify: `frontend/src/lib/api.ts`

- [x] **Step 1: Store**

Dans `frontend/src/store/auth.ts` :

Interface `User`, ajouter après `role` :

```ts
  doitChangerMdp?: boolean;
```

Interface `AuthState`, ajouter après `setToken` :

```ts
  setTokens: (token: string, refreshToken: string) => void;
  setDoitChangerMdp: (value: boolean) => void;
```

Implémentation, ajouter après `setToken: ...` :

```ts
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setDoitChangerMdp: (value) =>
        set((state) => ({ user: state.user ? { ...state.user, doitChangerMdp: value } : null })),
```

- [x] **Step 2: Intercepteur**

Dans `frontend/src/lib/api.ts`, dans l'intercepteur de réponse de `apiClient`, ajouter **avant** `return Promise.reject(err);` :

```ts
    if (err.response?.status === 403 && err.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
      useAuthStore.getState().setDoitChangerMdp(true);
      if (window.location.pathname !== '/mon-compte') window.location.href = '/mon-compte';
    }
```

- [x] **Step 3: Vérifier le typage**

```bash
cd frontend && npx tsc --noEmit
```

Expected : aucune erreur.

- [x] **Step 4: Commit**

```bash
git add frontend/src/store/auth.ts frontend/src/lib/api.ts
git commit -m "feat: track forced password change in auth store and API client"
```

---

### Task 6: Frontend — layout et sidebar

**Files:**
- Modify: `frontend/src/app/(dashboard)/layout.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [x] **Step 1: Redirection forcée dans le layout**

Dans `frontend/src/app/(dashboard)/layout.tsx` :

Remplacer l'import `next/navigation` :

```ts
import { useRouter, usePathname } from 'next/navigation';
```

Remplacer le début du composant jusqu'à la fin du premier `useEffect` par :

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, user, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mdpAChanger = !!user?.doitChangerMdp && pathname !== '/mon-compte';

  useEffect(() => {
    // Attendre la fin de la réhydratation avant de juger l'état d'auth
    if (_hasHydrated && !token) router.push('/login');
  }, [_hasHydrated, token, router]);

  useEffect(() => {
    // Mot de passe réinitialisé par l'admin : seule la page Mon compte est accessible
    if (_hasHydrated && token && mdpAChanger) router.replace('/mon-compte');
  }, [_hasHydrated, token, mdpAChanger, router]);
```

Remplacer `if (!token) return null;` par :

```tsx
  if (!token || mdpAChanger) return null;
```

- [x] **Step 2: Sidebar**

Dans `frontend/src/components/layout/Sidebar.tsx`, ajouter à la fin du tableau `nav` :

```ts
  { href: '/utilisateurs', icon: '👤', label: 'Utilisateurs', roles: ['ADMIN'] },
  { href: '/mon-compte', icon: '🔑', label: 'Mon compte', roles: ['ADMIN', 'MEDECIN', 'SECRETAIRE'] },
```

Remplacer la ligne `const items = ...` par :

```ts
  const items = user?.doitChangerMdp
    ? nav.filter(n => n.href === '/mon-compte')
    : nav.filter(n => !user?.role || n.roles.includes(user.role));
```

Remplacer le bloc utilisateur en bas (`<div className="flex items-center gap-3 px-3 py-2">` … sa `</div>` fermante) par un lien :

```tsx
        <Link href="/mon-compte" onClick={onClose}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
        </Link>
```

- [x] **Step 3: Vérifier**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Expected : aucune erreur.

- [x] **Step 4: Commit**

```bash
git add "frontend/src/app/(dashboard)/layout.tsx" frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: redirect to account page while password change is required"
```

---

### Task 7: Frontend — page `/mon-compte`

**Files:**
- Create: `frontend/src/app/(dashboard)/mon-compte/page.tsx`

- [x] **Step 1: Créer la page**

```tsx
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

const schema = z
  .object({
    ancienMdp: z.string().min(1, 'Mot de passe actuel requis'),
    nouveauMdp: z.string().min(8, '8 caractères minimum'),
    confirmation: z.string(),
  })
  .refine(d => d.nouveauMdp === d.confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmation'],
  })
  .refine(d => d.nouveauMdp !== d.ancienMdp, {
    message: 'Le nouveau mot de passe doit être différent de l\'actuel',
    path: ['nouveauMdp'],
  });

type FormData = z.infer<typeof schema>;

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1';

export default function MonComptePage() {
  const router = useRouter();
  const { user, setTokens, setDoitChangerMdp } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const force = !!user?.doitChangerMdp;

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/change-password', {
        ancienMdp: data.ancienMdp,
        nouveauMdp: data.nouveauMdp,
      });
      setTokens(res.data.accessToken, res.data.refreshToken);
      setDoitChangerMdp(false);
      reset();
      toast.success('Mot de passe modifié');
      if (force) router.replace('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.message;
      if (message === 'Ancien mot de passe incorrect') {
        setError('ancienMdp', { message: 'Mot de passe actuel incorrect' });
      } else {
        toast.error(message || 'Erreur lors du changement de mot de passe');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>

      {force && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          Votre mot de passe a été réinitialisé par l&apos;administrateur. Choisissez un nouveau
          mot de passe pour continuer.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
        <p className="text-sm text-gray-500">Nom</p>
        <p className="font-medium text-gray-900">{user?.prenom} {user?.nom}</p>
        <p className="text-sm text-gray-500 pt-2">Email</p>
        <p className="font-medium text-gray-900">{user?.email}</p>
        <p className="text-sm text-gray-500 pt-2">Rôle</p>
        <p className="font-medium text-gray-900">{user?.role}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-lg mb-4">Changer le mot de passe</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">
              {force ? 'Mot de passe temporaire (communiqué par l’administrateur)' : 'Mot de passe actuel'}
            </label>
            <input type="password" autoComplete="current-password" {...register('ancienMdp')} className={inputClass} />
            {errors.ancienMdp && <p className="text-xs text-red-600 mt-1">{errors.ancienMdp.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Nouveau mot de passe</label>
            <input type="password" autoComplete="new-password" {...register('nouveauMdp')} className={inputClass} />
            {errors.nouveauMdp && <p className="text-xs text-red-600 mt-1">{errors.nouveauMdp.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmer le nouveau mot de passe</label>
            <input type="password" autoComplete="new-password" {...register('confirmation')} className={inputClass} />
            {errors.confirmation && <p className="text-xs text-red-600 mt-1">{errors.confirmation.message}</p>}
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '...' : 'Modifier le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Vérifier**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Expected : aucune erreur.

- [x] **Step 3: Commit**

```bash
git add "frontend/src/app/(dashboard)/mon-compte/page.tsx"
git commit -m "feat: add account page with password change form"
```

---

### Task 8: Frontend — page `/utilisateurs`

**Files:**
- Create: `frontend/src/app/(dashboard)/utilisateurs/page.tsx`

- [x] **Step 1: Créer la page**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: 'ADMIN' | 'MEDECIN' | 'SECRETAIRE';
  actif: boolean;
  doitChangerMdp: boolean;
}

export default function UtilisateursPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [cible, setCible] = useState<Utilisateur | null>(null);
  const estAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (user && !estAdmin) router.replace('/dashboard');
  }, [user, estAdmin, router]);

  const { data: utilisateurs = [], isLoading } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/auth/users').then(r => r.data),
    enabled: estAdmin,
  });

  if (!estAdmin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Chargement...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {utilisateurs.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-gray-400 sm:hidden">{u.email} · {u.role}</p>
                      {u.doitChangerMdp && (
                        <span className="text-xs text-orange-600 font-medium">Changement requis</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{u.role}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full ${u.actif ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => setCible(u)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Réinitialiser le mot de passe
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cible && <ResetModal utilisateur={cible} onClose={() => setCible(null)} />}
    </div>
  );
}

const resetSchema = z
  .object({
    nouveauMdp: z.string().min(8, '8 caractères minimum'),
    confirmation: z.string(),
  })
  .refine(d => d.nouveauMdp === d.confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmation'],
  });

type ResetForm = z.infer<typeof resetSchema>;

function ResetModal({ utilisateur, onClose }: { utilisateur: Utilisateur; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ResetForm) =>
      apiClient.post(`/auth/users/${utilisateur.id}/reset-password`, { nouveauMdp: data.nouveauMdp }),
    onSuccess: () => {
      toast.success(
        'Mot de passe réinitialisé. Communiquez-le à l’utilisateur : il devra le changer à sa prochaine connexion.',
        { duration: 6000 },
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg mb-1">Réinitialiser le mot de passe</h2>
        <p className="text-sm text-gray-500 mb-4">{utilisateur.prenom} {utilisateur.nom} — {utilisateur.email}</p>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Mot de passe temporaire</label>
            <input type="password" autoComplete="new-password" {...register('nouveauMdp')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
            {errors.nouveauMdp && <p className="text-xs text-red-600 mt-1">{errors.nouveauMdp.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmation</label>
            <input type="password" autoComplete="new-password" {...register('confirmation')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
            {errors.confirmation && <p className="text-xs text-red-600 mt-1">{errors.confirmation.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {mutation.isPending ? '...' : 'Réinitialiser'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [x] **Step 2: Vérifier**

```bash
cd frontend && npx tsc --noEmit && npm run lint
```

Expected : aucune erreur.

- [x] **Step 3: Commit**

```bash
git add "frontend/src/app/(dashboard)/utilisateurs/page.tsx"
git commit -m "feat: add admin users page with password reset"
```

---

### Task 9: Vérification manuelle bout en bout

Pas de commit (sauf correctifs éventuels, préfixe `fix:`).

- [x] **Step 1: Lancer l'app locale**

```bash
docker compose -f docker-compose.dev.yml up -d
cd backend && npx prisma migrate deploy && npm run start:dev   # terminal 1
cd frontend && npm run dev                                     # terminal 2
```

- [x] **Step 2: Parcours à vérifier sur http://localhost:3000**

1. Connexion `admin@cabinet.ma` / `Admin123!` → sidebar contient « Utilisateurs » et « Mon compte ».
2. `/utilisateurs` : liste des comptes, pas de bouton de reset sur la ligne admin.
3. Reset de `secretaire@cabinet.ma` avec `Temp1234!` (tester d'abord confirmation différente et < 8 caractères → erreurs sous les champs) → toast, badge « Changement requis ».
4. Déconnexion, connexion `secretaire@cabinet.ma` / `Temp1234!` → redirection automatique sur `/mon-compte`, bandeau orange, sidebar réduite à « Mon compte ». Saisir `/patients` dans l'URL → renvoyé sur `/mon-compte`.
5. Saisir un mot de passe temporaire faux → « Mot de passe actuel incorrect » sous le champ, **pas de déconnexion**.
6. Changer pour `Secretaire123!` → toast, arrivée sur `/dashboard`, sidebar complète, pages accessibles.
7. Connexion médecin → `/utilisateurs` dans l'URL → redirection `/dashboard` ; « Mon compte » permet un changement normal (sans bandeau) et la session reste active ensuite.
8. Affichage mobile (DevTools, 375px) de `/utilisateurs` et `/mon-compte` : pas de scroll horizontal de page.

- [x] **Step 3: Suites complètes**

```bash
cd backend && npx jest && DATABASE_URL="$TEST_DB" npm run test:e2e
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```

Expected : tout passe.
