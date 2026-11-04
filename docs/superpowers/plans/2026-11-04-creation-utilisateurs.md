# Création d'utilisateurs et mots de passe générés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'admin crée des comptes depuis la page « Utilisateurs » ; les mots de passe initiaux (création) et temporaires (réinitialisation) sont générés par le serveur, affichés une seule fois, et doivent être changés à la première connexion.

**Architecture:** Une fonction `genererMotDePasse()` (crypto) est utilisée par `AuthService.createUser` et `AuthService.resetPassword`, qui renvoient le mot de passe en clair une seule fois. Les DTO normalisent l'email (création + login) et durcissent le mot de passe choisi par l'utilisateur. Côté frontend, deux modales (création, réinitialisation) partagent un écran `MotDePasseGenere` avec bouton « Copier ».

**Tech Stack:** NestJS, Prisma, argon2, class-validator / class-transformer, Jest/Supertest ; Next.js 14, React Query v5, React Hook Form + Zod, react-hot-toast.

**Spec :** `docs/superpowers/specs/2026-11-04-creation-utilisateurs-design.md`

**Écarts d'organisation par rapport au spec (sans changement fonctionnel) :**
- Les modales sont dans `frontend/src/components/utilisateurs/` (et non dans la page) pour garder des fichiers courts.
- La route de réinitialisation garde un DTO **vide** (`ResetPasswordDto`) : sans `@Body()` typé, Nest ignorerait silencieusement un corps `{ nouveauMdp }` au lieu de répondre 400 comme le prévoit le spec.

---

## Prérequis d'environnement

- **Node 20** : préfixer toute commande npm/npx par `export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH" &&`.
- Infra locale : `docker compose -f docker-compose.dev.yml up -d` (Docker Desktop doit tourner).
- **Les tests e2e vident la base** : toujours `DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test"` (base déjà créée et migrée), jamais la base par défaut.
- Frontend : `npx tsc --noEmit` affiche 4 erreurs **déjà présentes** (`stock/page.tsx` l.147/157, `NouveauRdvModal.tsx` l.42/66) ; ne pas en ajouter. Supprimer `frontend/tsconfig.tsbuildinfo` s'il est généré (non suivi).
- Commits : préfixes `feat:` / `fix:` / `test:` / `docs:` / `refactor:`.

## Structure des fichiers

**Backend**
| Fichier | Action | Responsabilité |
|---|---|---|
| `backend/src/auth/generer-mot-de-passe.ts` | Créer | Génération du mot de passe |
| `backend/src/auth/generer-mot-de-passe.spec.ts` | Créer | Tests du générateur |
| `backend/src/common/transforms/normaliser-email.ts` | Créer | `@NormaliserEmail()` (trim + minuscules) |
| `backend/src/auth/dto/create-user.dto.ts` | Modifier | Sans mot de passe, email normalisé, téléphone validé |
| `backend/src/auth/dto/reset-password.dto.ts` | Modifier | DTO vide |
| `backend/src/auth/dto/login.dto.ts` | Modifier | Email normalisé |
| `backend/src/auth/dto/change-password.dto.ts` | Modifier | Règle stricte sur `nouveauMdp` |
| `backend/src/auth/auth.service.ts` | Modifier | `createUser(adminId, dto)`, `resetPassword(adminId, userId)` |
| `backend/src/auth/auth.controller.ts` | Modifier | Passage de `adminId`, plus de mot de passe reçu |
| `backend/src/auth/auth.service.spec.ts` | Modifier | Tests `createUser`, `resetPassword` |
| `backend/test/auth.e2e-spec.ts` | Modifier | Tests e2e |

**Frontend**
| Fichier | Action | Responsabilité |
|---|---|---|
| `frontend/src/components/utilisateurs/types.ts` | Créer | Types `Role`, `Utilisateur` |
| `frontend/src/components/utilisateurs/MotDePasseGenere.tsx` | Créer | Affichage unique + « Copier » |
| `frontend/src/components/utilisateurs/ResetModal.tsx` | Créer | Confirmation de réinitialisation |
| `frontend/src/components/utilisateurs/CreateUserModal.tsx` | Créer | Formulaire de création |
| `frontend/src/app/(dashboard)/utilisateurs/page.tsx` | Modifier | Bouton + branchement des modales |
| `frontend/src/app/(dashboard)/mon-compte/page.tsx` | Modifier | Règle stricte + nouveau bandeau |
| `CLAUDE.md` | Modifier | Section Auth à jour |

---

### Task 1: Générateur de mot de passe

**Files:**
- Create: `backend/src/auth/generer-mot-de-passe.ts`
- Test: `backend/src/auth/generer-mot-de-passe.spec.ts`

- [x] **Step 1: Écrire les tests**

`backend/src/auth/generer-mot-de-passe.spec.ts` :

```ts
import { genererMotDePasse } from './generer-mot-de-passe';

describe('genererMotDePasse', () => {
  const tirages = Array.from({ length: 200 }, () => genererMotDePasse());

  it('génère 12 caractères', () => {
    tirages.forEach((m) => expect(m).toHaveLength(12));
  });

  it('contient au moins une majuscule, une minuscule et un chiffre', () => {
    tirages.forEach((m) => {
      expect(m).toMatch(/[A-Z]/);
      expect(m).toMatch(/[a-z]/);
      expect(m).toMatch(/\d/);
    });
  });

  it('n\'utilise aucun caractère ambigu (0, O, 1, l, I)', () => {
    tirages.forEach((m) => expect(m).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/));
  });

  it('produit des mots de passe différents', () => {
    expect(new Set(tirages).size).toBe(tirages.length);
  });
});
```

- [x] **Step 2: Lancer — échec**

```bash
cd backend && npx jest src/auth/generer-mot-de-passe.spec.ts
```

Expected : FAIL — `Cannot find module './generer-mot-de-passe'`.

- [x] **Step 3: Implémenter**

`backend/src/auth/generer-mot-de-passe.ts` :

```ts
import { randomInt } from 'crypto';

// Sans caractères ambigus à la lecture ou à la dictée : 0/O, 1/l/I
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULES = 'abcdefghijkmnopqrstuvwxyz';
const CHIFFRES = '23456789';
const TOUS = MAJUSCULES + MINUSCULES + CHIFFRES;
const LONGUEUR = 12;

const tirer = (alphabet: string) => alphabet[randomInt(alphabet.length)];

// Mot de passe aléatoire avec au moins une majuscule, une minuscule et un chiffre
export function genererMotDePasse(): string {
  const caracteres = [tirer(MAJUSCULES), tirer(MINUSCULES), tirer(CHIFFRES)];
  while (caracteres.length < LONGUEUR) caracteres.push(tirer(TOUS));

  // Mélange de Fisher-Yates, pour que les trois premiers caractères ne soient pas prévisibles
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
```

- [x] **Step 4: Lancer — succès**

```bash
cd backend && npx jest src/auth/generer-mot-de-passe.spec.ts
```

Expected : PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add backend/src/auth/generer-mot-de-passe.ts backend/src/auth/generer-mot-de-passe.spec.ts
git commit -m "feat: add secure password generator"
```

---

### Task 2: Service — création et réinitialisation avec mot de passe généré

**Files:**
- Modify: `backend/src/auth/auth.service.ts` (méthodes `createUser` et `resetPassword`)
- Modify: `backend/src/auth/auth.controller.ts` (routes `POST users` et `POST users/:id/reset-password`)
- Modify: `backend/src/auth/dto/create-user.dto.ts` (retrait de `motDePasse`)
- Test: `backend/src/auth/auth.service.spec.ts`

- [x] **Step 1: Tests unitaires (échouent)**

Dans `backend/src/auth/auth.service.spec.ts`, remplacer **tout** le bloc `describe('resetPassword', () => { ... });` par :

```ts
  describe('resetPassword', () => {
    it('lève BadRequestException si l\'admin cible son propre compte', async () => {
      await expect(service.resetPassword('admin1', 'admin1'))
        .rejects.toThrow(BadRequestException);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lève NotFoundException si utilisateur inexistant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.resetPassword('admin1', 'u1'))
        .rejects.toThrow(NotFoundException);
    });

    it('génère un mot de passe, force le changement, révoque les sessions et audite', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });

      const res = await service.resetPassword('admin1', 'u1');

      expect(res.motDePasseTemporaire).toHaveLength(12);
      const updateArg = mockPrisma.user.update.mock.calls[0][0];
      expect(updateArg.where).toEqual({ id: 'u1' });
      expect(updateArg.data.doitChangerMdp).toBe(true);
      expect(await argon2.verify(updateArg.data.motDePasse, res.motDePasseTemporaire)).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(mockAudit.log).toHaveBeenCalledWith('admin1', 'RESET_PASSWORD', 'User', 'u1');
    });
  });

  describe('createUser', () => {
    const dto = { email: 'nouveau@cabinet.ma', nom: 'Idrissi', prenom: 'Karim', role: Role.MEDECIN };

    it('lève ConflictException si l\'email est déjà utilisé', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      await expect(service.createUser('admin1', dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('crée le compte avec un mot de passe généré, force le changement et audite', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'u2', email: dto.email });

      const res = await service.createUser('admin1', dto);

      const arg = mockPrisma.user.create.mock.calls[0][0];
      expect(arg.data.email).toBe(dto.email);
      expect(arg.data.doitChangerMdp).toBe(true);
      expect(res.motDePasseInitial).toHaveLength(12);
      expect(await argon2.verify(arg.data.motDePasse, res.motDePasseInitial)).toBe(true);
      expect(arg.select.motDePasse).toBeUndefined();
      expect(arg.select).toMatchObject({ telephone: true, actif: true, doitChangerMdp: true });
      expect(res.user).toEqual({ id: 'u2', email: dto.email });
      expect(mockAudit.log).toHaveBeenCalledWith('admin1', 'CREATE_USER', 'User', 'u2');
    });
  });
```

- [x] **Step 2: Lancer — échec**

```bash
cd backend && npx jest src/auth/auth.service.spec.ts
```

Expected : FAIL (erreurs TypeScript : `resetPassword` attend 3 arguments, `createUser` 1 argument).

- [x] **Step 3: Implémenter dans `AuthService`**

Dans `backend/src/auth/auth.service.ts`, ajouter l'import :

```ts
import { genererMotDePasse } from './generer-mot-de-passe';
```

Remplacer intégralement `createUser` :

```ts
  async createUser(adminId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const motDePasseInitial = genererMotDePasse();
    const user = await this.prisma.user.create({
      data: { ...dto, motDePasse: await argon2.hash(motDePasseInitial), doitChangerMdp: true },
      select: {
        id: true, email: true, nom: true, prenom: true, role: true,
        telephone: true, actif: true, doitChangerMdp: true, createdAt: true,
      },
    });
    await this.audit.log(adminId, 'CREATE_USER', 'User', user.id);

    // Renvoyé une seule fois à l'admin : seul le hash est stocké
    return { user, motDePasseInitial };
  }
```

Remplacer intégralement `resetPassword` :

```ts
  async resetPassword(adminId: string, userId: string) {
    if (adminId === userId) {
      throw new BadRequestException('Utilisez « Mon compte » pour changer votre propre mot de passe');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    const motDePasseTemporaire = genererMotDePasse();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { motDePasse: await argon2.hash(motDePasseTemporaire), doitChangerMdp: true },
      }),
      // Révoque toutes les sessions
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);
    await this.audit.log(adminId, 'RESET_PASSWORD', 'User', userId);

    // Renvoyé une seule fois à l'admin : seul le hash est stocké
    return { motDePasseTemporaire };
  }
```

- [x] **Step 4: Adapter le contrôleur**

Dans `backend/src/auth/auth.controller.ts`, remplacer la méthode `createUser` :

```ts
  createUser(@CurrentUser('sub') adminId: string, @Body() dto: CreateUserDto) {
    return this.authService.createUser(adminId, dto);
  }
```

et la méthode `resetPassword` (le DTO devient vide en Task 3 ; on le garde pour que Nest refuse un corps inattendu) :

```ts
  resetPassword(
    @CurrentUser('sub') adminId: string,
    @Param('id') userId: string,
    @Body() _dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(adminId, userId);
  }
```

- [x] **Step 5: Retirer `motDePasse` de `CreateUserDto`**

Dans `backend/src/auth/dto/create-user.dto.ts`, supprimer la propriété `motDePasse` et ses décorateurs (le bloc `@ApiProperty() @IsString() @MinLength(8) @Matches(...) motDePasse: string;`), puis retirer `MinLength` et `Matches` de l'import `class-validator` s'ils ne sont plus utilisés. (Le reste du DTO est réécrit en Task 3.)

- [x] **Step 6: Lancer — succès**

```bash
cd backend && npx jest src/auth && npx tsc --noEmit -p tsconfig.json
```

Expected : PASS (tous les tests de `src/auth`), aucune erreur TypeScript.

- [x] **Step 7: Commit**

```bash
git add backend/src/auth/auth.service.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.service.spec.ts backend/src/auth/dto/create-user.dto.ts
git commit -m "feat: generate initial and temporary passwords server-side"
```

---

### Task 3: DTO (email normalisé, téléphone, règle stricte) et tests e2e

**Files:**
- Create: `backend/src/common/transforms/normaliser-email.ts`
- Modify: `backend/src/auth/dto/create-user.dto.ts`
- Modify: `backend/src/auth/dto/reset-password.dto.ts`
- Modify: `backend/src/auth/dto/login.dto.ts`
- Modify: `backend/src/auth/dto/change-password.dto.ts`
- Test: `backend/test/auth.e2e-spec.ts`

- [x] **Step 1: Adapter et compléter les tests e2e (échouent)**

Dans `backend/test/auth.e2e-spec.ts` :

**a)** Juste **après** le bloc `describe('GET /api/auth/users', ...)` (la secrétaire a encore `Secretaire123!` à ce moment), insérer :

```ts
  describe('POST /api/auth/users', () => {
    const nouveau = { email: 'Nouveau.Medecin@Cabinet.ma', nom: 'Idrissi', prenom: 'Karim', role: 'MEDECIN' };

    it('403 pour une secrétaire', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      const res = await request(app.getHttpServer())
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...nouveau, email: 'refuse@cabinet.ma' });

      expect(res.status).toBe(403);
    });

    it('201 : mot de passe généré, email normalisé, changement forcé à la première connexion', async () => {
      const server = app.getHttpServer();
      const token = await loginAdmin(app);

      const res = await request(server)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send(nouveau);

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('nouveau.medecin@cabinet.ma');
      expect(res.body.user.doitChangerMdp).toBe(true);
      expect(res.body.user.motDePasse).toBeUndefined();
      expect(res.body.motDePasseInitial).toHaveLength(12);

      // Connexion insensible à la casse, avec le mot de passe généré
      const session = await login(app, 'NOUVEAU.medecin@CABINET.ma', res.body.motDePasseInitial);
      expect(session.user.doitChangerMdp).toBe(true);
      const auth = { Authorization: `Bearer ${session.accessToken}` };

      const bloque = await request(server).get('/api/patients').set(auth);
      expect(bloque.status).toBe(403);
      expect(bloque.body.code).toBe('MUST_CHANGE_PASSWORD');

      const change = await request(server)
        .post('/api/auth/change-password').set(auth)
        .send({ ancienMdp: res.body.motDePasseInitial, nouveauMdp: 'Medecin789!' });
      expect(change.status).toBe(201);

      const ok = await request(server)
        .get('/api/patients')
        .set('Authorization', `Bearer ${change.body.accessToken}`);
      expect(ok.status).toBe(200);
    });

    it('409 si l\'email existe déjà, quelle que soit la casse', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...nouveau, email: 'NOUVEAU.MEDECIN@cabinet.ma' });

      expect(res.status).toBe(409);
    });

    it('400 si un mot de passe est envoyé', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...nouveau, email: 'avec-mdp@cabinet.ma', motDePasse: 'Admin123!' });

      expect(res.status).toBe(400);
    });

    it('400 si le téléphone est invalide', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...nouveau, email: 'tel@cabinet.ma', telephone: '12345' });

      expect(res.status).toBe(400);
    });

    it('201 avec un téléphone marocain valide', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...nouveau, email: 'tel-ok@cabinet.ma', telephone: '0612345678' });

      expect(res.status).toBe(201);
      expect(res.body.user.telephone).toBe('0612345678');
    });
  });
```

**b)** Remplacer **tout** le bloc `describe('POST /api/auth/users/:id/reset-password — validations', ...)` par :

```ts
  describe('POST /api/auth/users/:id/reset-password — validations', () => {
    it('403 pour une secrétaire', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire123!');
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/test-admin-id/reset-password')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(403);
    });

    it('400 si un mot de passe est envoyé', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post(`/api/auth/users/${secretaireId}/reset-password`)
        .set('Authorization', `Bearer ${token}`)
        .send({ nouveauMdp: 'Temp1234!' });

      expect(res.status).toBe(400);
    });

    it('400 si l\'admin cible son propre compte', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/test-admin-id/reset-password')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('404 si utilisateur inexistant', async () => {
      const token = await loginAdmin(app);
      const res = await request(app.getHttpServer())
        .post('/api/auth/users/inexistant/reset-password')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
```

**c)** Dans le test `bloque l'API jusqu'au changement, puis rétablit l'accès`, remplacer les étapes 1 et 2 :

```ts
      // 1. L'admin réinitialise le mot de passe de la secrétaire (généré par le serveur)
      const reset = await request(server)
        .post(`/api/auth/users/${secretaireId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(reset.status).toBe(201);
      const temporaire: string = reset.body.motDePasseTemporaire;
      expect(temporaire).toHaveLength(12);

      // 2. Connexion avec le mot de passe temporaire
      const session = await login(app, 'secretaire@cabinet.ma', temporaire);
```

puis, dans le même test, remplacer les deux `ancienMdp: 'Temp1234!'` par `ancienMdp: temporaire`, et le second `nouveauMdp: 'Temp1234!'` (étape 3b) par `nouveauMdp: temporaire`.

**d)** À la fin du bloc `describe('Scénario : réinitialisation admin puis changement forcé', ...)`, après le test `400 si ancien mot de passe incorrect`, ajouter :

```ts
    it('400 si le nouveau mot de passe est faible', async () => {
      const { accessToken } = await login(app, 'secretaire@cabinet.ma', 'Secretaire456!');
      for (const faible of ['faible123', 'SansChiffre', 'SANSMINUSCULE1']) {
        const res = await request(app.getHttpServer())
          .post('/api/auth/change-password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ ancienMdp: 'Secretaire456!', nouveauMdp: faible });

        expect(res.status).toBe(400);
      }
    });
```

- [x] **Step 2: Lancer — échec**

```bash
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/auth.e2e-spec.ts
```

Expected : FAIL — notamment création sans `motDePasse` → 400, email non normalisé, `400 si un mot de passe est envoyé` (reset) → 201, mots de passe faibles acceptés.

- [x] **Step 3: Transformation `@NormaliserEmail()`**

`backend/src/common/transforms/normaliser-email.ts` :

```ts
import { Transform } from 'class-transformer';

// Emails comparés sans tenir compte de la casse ni des espaces
export const NormaliserEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
```

- [x] **Step 4: DTO**

Remplacer intégralement `backend/src/auth/dto/create-user.dto.ts` :

```ts
import { IsEmail, IsString, IsNotEmpty, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';

// Le mot de passe initial est généré par le serveur : il n'est pas fourni par l'admin
export class CreateUserDto {
  @ApiProperty()
  @NormaliserEmail()
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty() @IsString() @IsNotEmpty() nom: string;
  @ApiProperty() @IsString() @IsNotEmpty() prenom: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role, { message: 'Rôle invalide' })
  role: Role;

  @ApiProperty({ required: false, example: '0612345678' })
  @IsOptional()
  @Matches(/^0[5-7][0-9]{8}$/, { message: 'Téléphone marocain invalide' })
  telephone?: string;
}
```

Remplacer intégralement `backend/src/auth/dto/reset-password.dto.ts` :

```ts
// Aucun champ : le mot de passe temporaire est généré par le serveur.
// Le DTO reste déclaré pour que la validation refuse tout corps inattendu (400).
export class ResetPasswordDto {}
```

Dans `backend/src/auth/dto/login.dto.ts`, ajouter l'import et le décorateur sur `email` :

```ts
import { NormaliserEmail } from '../../common/transforms/normaliser-email';
```

```ts
  @ApiProperty({ example: 'dr.benali@cabinet.ma' })
  @NormaliserEmail()
  @IsEmail({}, { message: 'Email invalide' })
  email: string;
```

Remplacer intégralement `backend/src/auth/dto/change-password.dto.ts` :

```ts
import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const REGLE_MDP =
  'Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule et un chiffre';

export class ChangePasswordDto {
  @ApiProperty() @IsString() ancienMdp: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: REGLE_MDP })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: REGLE_MDP })
  nouveauMdp: string;
}
```

- [x] **Step 5: Lancer — succès**

```bash
cd backend && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/auth.e2e-spec.ts
```

Expected : PASS (tous les tests du fichier).

- [x] **Step 6: Non-régression backend complète**

```bash
cd backend && npx jest && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npm run test:e2e && npx tsc --noEmit -p tsconfig.json
```

Expected : tous les tests unitaires et e2e PASS, aucune erreur TypeScript. (Les autres suites e2e se connectent avec des emails déjà en minuscules : la normalisation ne les affecte pas.)

- [x] **Step 7: Commit**

```bash
git add backend/src backend/test
git commit -m "feat: normalize emails, validate phone and enforce strong user-chosen passwords"
```

---

### Task 4: Frontend — types et écran du mot de passe généré

**Files:**
- Create: `frontend/src/components/utilisateurs/types.ts`
- Create: `frontend/src/components/utilisateurs/MotDePasseGenere.tsx`

- [x] **Step 1: Types**

`frontend/src/components/utilisateurs/types.ts` :

```ts
export type Role = 'ADMIN' | 'MEDECIN' | 'SECRETAIRE';

export const ROLES: Role[] = ['ADMIN', 'MEDECIN', 'SECRETAIRE'];

export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  actif: boolean;
  doitChangerMdp: boolean;
}
```

- [x] **Step 2: Composant**

`frontend/src/components/utilisateurs/MotDePasseGenere.tsx` :

```tsx
'use client';
import toast from 'react-hot-toast';
import type { Utilisateur } from './types';

interface Props {
  titre: string;
  utilisateur: Pick<Utilisateur, 'prenom' | 'nom' | 'email'>;
  motDePasse: string;
  onClose: () => void;
}

// Affiché une seule fois : le serveur ne conserve que le hash
export function MotDePasseGenere({ titre, utilisateur, motDePasse, onClose }: Props) {
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(motDePasse);
      toast.success('Mot de passe copié');
    } catch {
      toast.error('Copie impossible : sélectionnez le mot de passe');
    }
  };

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">{titre}</h2>
      <p className="text-sm text-gray-500 mb-4">
        {utilisateur.prenom} {utilisateur.nom} — {utilisateur.email}
      </p>
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <code
          data-testid="mot-de-passe-genere"
          className="flex-1 font-mono text-xl tracking-wider text-gray-900 select-all break-all"
        >
          {motDePasse}
        </code>
        <button
          type="button"
          onClick={copier}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition"
        >
          Copier
        </button>
      </div>
      <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
        Notez-le maintenant : il ne sera plus affiché. L&apos;utilisateur devra le changer à sa
        première connexion.
      </p>
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          J&apos;ai noté le mot de passe
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Vérifier**

```bash
cd frontend && npx tsc --noEmit; npm run lint
```

Expected : uniquement les 4 erreurs `tsc` déjà présentes ; lint sans erreur.

- [x] **Step 4: Commit**

```bash
git add frontend/src/components/utilisateurs
git commit -m "feat: add one-time generated password display"
```

---

### Task 5: Frontend — réinitialisation par confirmation

**Files:**
- Create: `frontend/src/components/utilisateurs/ResetModal.tsx`
- Modify: `frontend/src/app/(dashboard)/utilisateurs/page.tsx`

- [x] **Step 1: Modale de réinitialisation**

`frontend/src/components/utilisateurs/ResetModal.tsx` :

```tsx
'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { MotDePasseGenere } from './MotDePasseGenere';
import type { Utilisateur } from './types';

export function ResetModal({ utilisateur, onClose }: { utilisateur: Utilisateur; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motDePasse, setMotDePasse] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient
        .post<{ motDePasseTemporaire: string }>(`/auth/users/${utilisateur.id}/reset-password`)
        .then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setMotDePasse(data.motDePasseTemporaire);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        {motDePasse ? (
          <MotDePasseGenere
            titre="Mot de passe réinitialisé"
            utilisateur={utilisateur}
            motDePasse={motDePasse}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 className="font-bold text-lg mb-3">Réinitialiser le mot de passe</h2>
            <p className="text-sm text-gray-600">
              Réinitialiser le mot de passe de{' '}
              <span className="font-medium text-gray-900">{utilisateur.prenom} {utilisateur.nom}</span> ?
              Un nouveau mot de passe temporaire sera généré et ses sessions seront fermées.
            </p>
            <div className="flex justify-end gap-3 pt-5">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                Annuler
              </button>
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {mutation.isPending ? '...' : 'Réinitialiser'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Page — utiliser les composants partagés**

Dans `frontend/src/app/(dashboard)/utilisateurs/page.tsx` :

Remplacer le bloc d'imports (lignes `import { useQuery, useMutation, useQueryClient } ...` jusqu'à `import toast from 'react-hot-toast';`) et l'interface `Utilisateur` par :

```tsx
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import { ResetModal } from '@/components/utilisateurs/ResetModal';
import type { Utilisateur } from '@/components/utilisateurs/types';
```

(garder les deux premières lignes : `'use client';`, `import { useEffect, useState } from 'react';` et `import { useRouter } from 'next/navigation';`).

Supprimer tout ce qui suit la fin de `UtilisateursPage` : `const resetSchema = ...`, `type ResetForm = ...` et `function ResetModal(...) { ... }`.

- [x] **Step 3: Vérifier**

```bash
cd frontend && npx tsc --noEmit; npm run lint
```

Expected : uniquement les 4 erreurs `tsc` déjà présentes ; lint sans erreur (aucun import inutilisé).

- [x] **Step 4: Commit**

```bash
git add frontend/src/components/utilisateurs/ResetModal.tsx "frontend/src/app/(dashboard)/utilisateurs/page.tsx"
git commit -m "feat: reset password with server-generated temporary password"
```

---

### Task 6: Frontend — création d'utilisateur

**Files:**
- Create: `frontend/src/components/utilisateurs/CreateUserModal.tsx`
- Modify: `frontend/src/app/(dashboard)/utilisateurs/page.tsx`

- [x] **Step 1: Modale de création**

`frontend/src/components/utilisateurs/CreateUserModal.tsx` :

```tsx
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { MotDePasseGenere } from './MotDePasseGenere';
import { ROLES, type Utilisateur } from './types';

const schema = z.object({
  prenom: z.string().trim().min(1, 'Prénom requis'),
  nom: z.string().trim().min(1, 'Nom requis'),
  email: z.string().trim().email('Email invalide'),
  role: z.enum(['ADMIN', 'MEDECIN', 'SECRETAIRE'], {
    errorMap: () => ({ message: 'Choisissez un rôle' }),
  }),
  telephone: z
    .string()
    .trim()
    .regex(/^0[5-7][0-9]{8}$/, 'Téléphone marocain invalide')
    .or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface Reponse {
  user: Utilisateur;
  motDePasseInitial: string;
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1';
const errClass = 'text-xs text-red-600 mt-1';

export function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cree, setCree] = useState<Reponse | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient
        .post<Reponse>('/auth/users', { ...data, telephone: data.telephone || undefined })
        .then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCree(data);
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setError('email', { message: 'Email déjà utilisé' });
        return;
      }
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Erreur lors de la création');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        {cree ? (
          <MotDePasseGenere
            titre="Compte créé"
            utilisateur={cree.user}
            motDePasse={cree.motDePasseInitial}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 className="font-bold text-lg mb-4">Nouvel utilisateur</h2>
            <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Prénom *</label>
                  <input {...register('prenom')} className={inputClass} />
                  {errors.prenom && <p className={errClass}>{errors.prenom.message}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nom *</label>
                  <input {...register('nom')} className={inputClass} />
                  {errors.nom && <p className={errClass}>{errors.nom.message}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email *</label>
                <input type="email" autoComplete="off" {...register('email')} className={inputClass} />
                {errors.email && <p className={errClass}>{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Rôle *</label>
                <select {...register('role')} defaultValue="" className={inputClass}>
                  <option value="" disabled>Choisir un rôle…</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                {errors.role && <p className={errClass}>{errors.role.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Téléphone</label>
                <input {...register('telephone')} placeholder="0612345678" className={inputClass} />
                {errors.telephone && <p className={errClass}>{errors.telephone.message}</p>}
              </div>
              <p className="text-xs text-gray-500">
                Un mot de passe initial sera généré et affiché une seule fois après la création.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={mutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {mutation.isPending ? '...' : 'Créer'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Bouton dans la page**

Dans `frontend/src/app/(dashboard)/utilisateurs/page.tsx` :

Ajouter l'import :

```tsx
import { CreateUserModal } from '@/components/utilisateurs/CreateUserModal';
```

Sous `const [cible, setCible] = useState<Utilisateur | null>(null);`, ajouter :

```tsx
  const [creation, setCreation] = useState(false);
```

Remplacer la ligne `<h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>` par :

```tsx
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <button
          onClick={() => setCreation(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + Nouvel utilisateur
        </button>
      </div>
```

Après la ligne `{cible && <ResetModal utilisateur={cible} onClose={() => setCible(null)} />}`, ajouter :

```tsx
      {creation && <CreateUserModal onClose={() => setCreation(false)} />}
```

- [x] **Step 3: Vérifier**

```bash
cd frontend && npx tsc --noEmit; npm run lint
```

Expected : uniquement les 4 erreurs `tsc` déjà présentes ; lint sans erreur.

- [x] **Step 4: Commit**

```bash
git add frontend/src/components/utilisateurs/CreateUserModal.tsx "frontend/src/app/(dashboard)/utilisateurs/page.tsx"
git commit -m "feat: add admin user creation modal"
```

---

### Task 7: Frontend — « Mon compte » (règle stricte et bandeau)

**Files:**
- Modify: `frontend/src/app/(dashboard)/mon-compte/page.tsx`

- [x] **Step 1: Règle stricte**

Dans le schéma Zod, remplacer la ligne :

```ts
    nouveauMdp: z.string().min(8, '8 caractères minimum'),
```

par :

```ts
    nouveauMdp: z
      .string()
      .min(8, '8 caractères minimum')
      .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Au moins une majuscule, une minuscule et un chiffre'),
```

- [x] **Step 2: Aide sous le champ**

Remplacer la ligne :

```tsx
            {errors.nouveauMdp && <p className="text-xs text-red-600 mt-1">{errors.nouveauMdp.message}</p>}
```

par :

```tsx
            {errors.nouveauMdp ? (
              <p className="text-xs text-red-600 mt-1">{errors.nouveauMdp.message}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                8 caractères minimum, avec une majuscule, une minuscule et un chiffre
              </p>
            )}
```

- [x] **Step 3: Bandeau**

Remplacer :

```tsx
          Votre mot de passe a été réinitialisé par l&apos;administrateur. Choisissez un nouveau
          mot de passe pour continuer.
```

par :

```tsx
          Votre mot de passe a été défini par l&apos;administrateur. Choisissez un nouveau mot de
          passe pour continuer.
```

- [x] **Step 4: Vérifier**

```bash
cd frontend && npx tsc --noEmit; npm run lint
```

Expected : uniquement les 4 erreurs `tsc` déjà présentes ; lint sans erreur.

- [x] **Step 5: Commit**

```bash
git add "frontend/src/app/(dashboard)/mon-compte/page.tsx"
git commit -m "feat: enforce strong password rule on account page"
```

---

### Task 8: Vérification de bout en bout et documentation

- [x] **Step 1: Suites complètes**

```bash
cd backend && npx jest && DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npm run test:e2e
cd ../frontend && npx tsc --noEmit; npm run lint && npm run build
```

Expected : tests PASS, 4 erreurs `tsc` déjà présentes seulement, lint OK, build OK avec `/utilisateurs` et `/mon-compte`.

- [x] **Step 2: Lancer l'application locale**

Si `backend/dist/src` existe, le supprimer (ancien build que `nest start --watch` lancerait à la place du nouveau). Puis backend (`npm run start:dev`) et frontend (`npm run dev`) ; vérifier `curl -s -o /dev/null -w "%{http_code}" localhost:3001/api/auth/users` → `401`.

- [x] **Step 3: Parcours navigateur (Playwright)**

Sur http://localhost:3000 :

1. Admin (`admin@cabinet.ma` / `Admin123!`) → `/utilisateurs` → « + Nouvel utilisateur ».
2. Valider sans rien saisir → erreurs Prénom, Nom, Email, « Choisissez un rôle ». Téléphone `12345` → « Téléphone marocain invalide ».
3. Créer `Test.Playwright@Cabinet.ma`, rôle MEDECIN → écran « Compte créé » avec un mot de passe de 12 caractères et « Copier » ; « J'ai noté le mot de passe » ferme ; la ligne apparaît avec « Changement requis » et l'email en minuscules.
4. Recréer le même email → « Email déjà utilisé » sous le champ.
5. Déconnexion, connexion avec `test.playwright@cabinet.ma` + mot de passe noté → `/mon-compte`, bandeau « défini par l'administrateur ».
6. Nouveau mot de passe `faible123` → erreur ; `Medecin789!` → `/dashboard`, accès complet.
7. Admin → « Réinitialiser le mot de passe » sur ce compte → confirmation → « Mot de passe réinitialisé » avec un nouveau mot de passe → connexion du compte avec ce mot de passe → `/mon-compte`.
8. Mobile 375 px : `/utilisateurs` et la modale de création sans scroll horizontal.

Les comptes créés pour le test restent dans la base de dev locale (pas de suppression possible dans l'UI pour l'instant).

- [x] **Step 4: CLAUDE.md**

Dans `CLAUDE.md`, section « Auth : changement de mot de passe forcé », remplacer la première puce par :

```markdown
- Les mots de passe initiaux (`POST /auth/users`) et temporaires (`POST /auth/users/:id/reset-password`) sont **générés par le serveur** (`auth/generer-mot-de-passe.ts`) et renvoyés une seule fois à l'admin ; l'admin ne choisit jamais le mot de passe d'un autre. Le compte a alors `User.doitChangerMdp = true`.
- Emails normalisés (trim + minuscules) à la création et au login (`@NormaliserEmail()`).
- Seul l'utilisateur choisit son mot de passe (« Mon compte ») : 8 caractères minimum, avec majuscule, minuscule et chiffre.
```

- [x] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document generated passwords in CLAUDE.md"
```
