# Multi-cabinet, étape 2 (espace Super Admin) — Plan d'implémentation

**Statut :** réalisé le 2026-11-07 sur la branche feat/multi-cabinet-super-admin, non mergé.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un Super Admin, créé par une commande serveur, de créer, consulter, modifier, suspendre et réactiver des cabinets, et de réinitialiser le mot de passe d'un titulaire, sans jamais accéder aux données des patients.

**Architecture:** Un module `plateforme` réservé au rôle `SUPER_ADMIN` utilise `PrismaSansFiltre`, limité par des tests aux modèles `Cabinet`, `User`, `AuditLog` et `RefreshToken`. La suspension est appliquée à la connexion, à chaque requête (`JwtStrategy`) et au renouvellement de session. Le client filtré refuse désormais le modèle `Cabinet`.

**Tech Stack:** NestJS 10, Prisma 5.22, PostgreSQL 16, Next.js 14, React Query, React Hook Form, Zod, Jest, Supertest.

**Spec :** `docs/superpowers/specs/2026-11-07-multi-cabinet-super-admin-design.md`

---

## Règles d'exécution

- Branche : `feat/multi-cabinet-super-admin`. Ne jamais pousser ni merger sans l'accord de l'utilisateur.
- Node 20 pour chaque commande (la version par défaut est la v8).
- Les e2e vident la base : toujours `cabinet_test`, jamais `cabinet_medical`.
- Ne pas lancer `npm run lint` dans `backend` (il reformate tout) : `npx eslint <fichiers>`. Les fichiers de `backend/test/` ne sont pas analysables par eslint : c'est normal.
- Aucune migration de base dans cette étape.
- Ajouter les fichiers un par un au commit, jamais `git add -A`.

```bash
export PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"
export REPO=/Users/Mehdi/Work/code/cabinet-medical-maroc
export TEST_DB="postgresql://postgres:password@localhost:5432/cabinet_test"
```

L'état du shell ne persiste pas entre deux commandes : relancer ces `export` à chaque fois.

Commandes de vérification backend :

```bash
cd $REPO/backend && npx tsc --noEmit -p tsconfig.json && npx jest
cd $REPO/backend && DATABASE_URL="$TEST_DB" npx prisma migrate deploy && DATABASE_URL="$TEST_DB" npm run test:e2e
```

## Fichiers

**Créés (backend)**
- `backend/src/auth/cabinet-suspendu.ts` : message et code de la suspension
- `backend/src/common/guards/super-admin.guard.ts`, `backend/src/common/guards/super-admin.guard.spec.ts`
- `backend/src/common/decorators/super-admin-seulement.decorator.ts`
- `backend/src/prisma/creer-super-admin.ts`, `backend/src/prisma/creer-super-admin.spec.ts`
- `backend/src/ordonnances/lieu-et-date.ts`, `backend/src/ordonnances/lieu-et-date.spec.ts`
- `backend/src/plateforme/plateforme.module.ts`, `plateforme.controller.ts`, `plateforme.service.ts`, `dto/cabinet.dto.ts`
- `backend/test/plateforme.e2e-spec.ts`

**Créés (frontend)**
- `frontend/src/app/(dashboard)/cabinets/page.tsx`
- `frontend/src/components/cabinets/types.ts`, `CreateCabinetModal.tsx`, `EditCabinetModal.tsx`, `StatutCabinetModal.tsx`, `ResetTitulaireModal.tsx`

**Modifiés :** `client-filtre.ts` et son spec, `prisma-sans-filtre.spec.ts`, `auth.service.ts` et son spec, `jwt.strategy.ts`, `ordonnances.service.ts`, `app.module.ts`, la page de connexion, le layout `(dashboard)`, `Sidebar.tsx`, `CLAUDE.md`.

---

### Task 1 : Cabinet refusé sur le client filtré, ville de l'ordonnance

**Files:**
- Modify: `backend/src/prisma/client-filtre.ts`, `backend/src/prisma/client-filtre.spec.ts`
- Create: `backend/src/ordonnances/lieu-et-date.ts`, `backend/src/ordonnances/lieu-et-date.spec.ts`
- Modify: `backend/src/ordonnances/ordonnances.service.ts`

- [x] **Step 1 : Écrire les tests**

Dans `backend/src/prisma/client-filtre.spec.ts`, le bloc qui teste `creerClientFiltre` construit déjà un `PrismaClient` sur une URL factice, sans connexion. Ajouter dans ce bloc, en reprenant sa variable de client (`client` ci-dessous ; adapter au nom réel) :

```ts
  it('refuse toute opération directe sur Cabinet, même avec un cabinet connu', async () => {
    await ouvrirContexte(async () => {
      definirCabinet('c1');
      await expect(client.cabinet.findMany()).rejects.toThrow(
        'Accès direct aux cabinets interdit sur le client filtré',
      );
      await expect(client.cabinet.findUnique({ where: { id: 'c1' } })).rejects.toThrow(
        'Accès direct aux cabinets interdit sur le client filtré',
      );
    });
  });
```

`backend/src/ordonnances/lieu-et-date.spec.ts` :

```ts
import { lieuEtDate } from './lieu-et-date';

describe('lieuEtDate', () => {
  it('écrit la ville du cabinet et la date en français', () => {
    expect(lieuEtDate('Rabat', new Date('2026-11-07T10:00:00Z'))).toBe('Rabat, le 07/11/2026');
  });

  it('garde les accents de la ville', () => {
    expect(lieuEtDate('Fès', new Date('2026-01-02T10:00:00Z'))).toBe('Fès, le 02/01/2026');
  });
});
```

- [x] **Step 2 : Vérifier l'échec**

Run: `cd $REPO/backend && npx jest src/prisma/client-filtre.spec.ts src/ordonnances/lieu-et-date.spec.ts`
Expected : FAIL. `lieu-et-date` est introuvable et `cabinet.findMany` ne lève pas l'erreur attendue.

Si le format `fr-MA` de Node ne donne pas `07/11/2026`, corriger l'attendu du test selon la sortie réelle de `new Date('2026-11-07T10:00:00Z').toLocaleDateString('fr-MA')`, qui est déjà le format utilisé aujourd'hui sur l'ordonnance.

- [x] **Step 3 : Refuser Cabinet**

Dans `backend/src/prisma/client-filtre.ts`, dans `$allOperations`, juste après la ligne qui refuse le SQL brut :

```ts
        // Les services d'un cabinet ne listent jamais les cabinets : seule une relation
        // depuis une ligne déjà filtrée peut atteindre son propre cabinet
        if (model === 'Cabinet') {
          throw new Error('Accès direct aux cabinets interdit sur le client filtré');
        }
```

- [x] **Step 4 : Écrire la ville de l'ordonnance**

`backend/src/ordonnances/lieu-et-date.ts` :

```ts
// Ligne « <ville>, le <date> » de l'ordonnance : la ville est celle du cabinet
export function lieuEtDate(ville: string, date: Date): string {
  return `${ville}, le ${date.toLocaleDateString('fr-MA')}`;
}
```

Dans `backend/src/ordonnances/ordonnances.service.ts` :
- importer `lieuEtDate` depuis `'./lieu-et-date'` ;
- dans `findOne`, ajouter à `include` : `cabinet: { select: { ville: true } },` ;
- dans `generatePdf`, remplacer `` .text(`Casablanca, le ${new Date(ord.createdAt).toLocaleDateString('fr-MA')}`, { align: 'right' }) `` par :

```ts
        .text(lieuEtDate(ord.cabinet.ville, new Date(ord.createdAt)), { align: 'right' });
```

- [x] **Step 5 : Vérifier**

Run : les commandes de vérification backend (unitaires et e2e).
Expected : tout est vert. Si un test unitaire d'`OrdonnancesService` simule `findUnique` sans `cabinet`, n'y ajouter `cabinet: { ville: 'Rabat' }` que si un test appelle `generatePdf`.

- [x] **Step 6 : Commit**

```bash
cd $REPO && git add backend/src/prisma/client-filtre.ts backend/src/prisma/client-filtre.spec.ts backend/src/ordonnances/lieu-et-date.ts backend/src/ordonnances/lieu-et-date.spec.ts backend/src/ordonnances/ordonnances.service.ts
git commit -m "feat: hide cabinets from the filtered client and print the cabinet city on prescriptions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Suspension appliquée aux sessions, mot de passe sans cabinet

**Files:**
- Create: `backend/src/auth/cabinet-suspendu.ts`
- Modify: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.service.spec.ts`
- Modify: `backend/src/auth/strategies/jwt.strategy.ts`
- Modify: `backend/src/prisma/prisma-sans-filtre.spec.ts`

- [x] **Step 1 : Écrire les tests unitaires**

Dans `backend/src/auth/auth.service.spec.ts`, ajouter `ForbiddenException` à l'import de `@nestjs/common`, et dans `describe('validateUser', ...)` :

```ts
    it('refuse avec CABINET_SUSPENDU un bon mot de passe si le cabinet est suspendu', async () => {
      const hash = await argon2.hash('Password123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'a@b.ma',
        motDePasse: hash,
        actif: true,
        cabinet: { actif: false },
      });
      const erreur = await service.validateUser('a@b.ma', 'Password123!').catch((e) => e);
      expect(erreur).toBeInstanceOf(ForbiddenException);
      expect(erreur.getResponse()).toMatchObject({ code: 'CABINET_SUSPENDU' });
    });

    it("ne révèle pas la suspension à qui n'a pas le bon mot de passe", async () => {
      const hash = await argon2.hash('Password123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        motDePasse: hash,
        actif: true,
        cabinet: { actif: false },
      });
      await expect(service.validateUser('a@b.ma', 'Mauvais123!')).resolves.toBeNull();
    });

    it("ne renvoie pas l'objet cabinet avec l'utilisateur", async () => {
      const hash = await argon2.hash('Password123!');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        motDePasse: hash,
        actif: true,
        cabinet: { actif: true },
      });
      const user = await service.validateUser('a@b.ma', 'Password123!');
      expect(user).not.toHaveProperty('cabinet');
      expect(user).not.toHaveProperty('motDePasse');
    });
```

Ajouter un bloc :

```ts
  describe('refreshToken', () => {
    const futur = () => new Date(Date.now() + 3600_000);

    it('refuse et supprime le token si le compte est désactivé', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 't',
        expiresAt: futur(),
        user: { id: 'u1', actif: false, cabinet: { actif: true } },
      });
      await expect(service.refreshToken('t')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { token: 't' } });
    });

    it('refuse et supprime le token si le cabinet est suspendu', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 't',
        expiresAt: futur(),
        user: { id: 'u1', actif: true, cabinet: { actif: false } },
      });
      await expect(service.refreshToken('t')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { token: 't' } });
    });

    it('renouvelle la session d’un SUPER_ADMIN, qui n’a pas de cabinet', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 't',
        expiresAt: futur(),
        user: { id: 'sa', email: 's@p.ma', role: Role.SUPER_ADMIN, actif: true, cabinet: null },
      });
      const res = await service.refreshToken('t');
      expect(res.accessToken).toBe('mock-token');
    });
  });
```

- [x] **Step 2 : Vérifier l'échec**

Run: `cd $REPO/backend && npx jest src/auth/auth.service.spec.ts`
Expected : FAIL sur les nouveaux tests.

- [x] **Step 3 : Message partagé**

`backend/src/auth/cabinet-suspendu.ts` :

```ts
export const CODE_CABINET_SUSPENDU = 'CABINET_SUSPENDU';

export const MESSAGE_CABINET_SUSPENDU =
  "Ce cabinet est suspendu. Contactez l'administrateur de la plateforme.";

// Un SUPER_ADMIN n'a pas de cabinet : il n'est jamais concerné
export function cabinetSuspendu(cabinet: { actif: boolean } | null | undefined): boolean {
  return !!cabinet && !cabinet.actif;
}
```

- [x] **Step 4 : Adapter `AuthService`**

Dans `backend/src/auth/auth.service.ts`, ajouter `ForbiddenException` à l'import de `@nestjs/common` et :

```ts
import {
  CODE_CABINET_SUSPENDU,
  MESSAGE_CABINET_SUSPENDU,
  cabinetSuspendu,
} from './cabinet-suspendu';
```

`validateUser` devient :

```ts
  async validateUser(email: string, motDePasse: string) {
    // Le cabinet n'est pas encore connu à la connexion
    const user = await this.prismaSansFiltre.user.findUnique({
      where: { email },
      include: { cabinet: { select: { actif: true } } },
    });
    if (!user || !user.actif) return null;

    // Vérification sécurisée avec argon2 (résistant timing attacks)
    const valid = await argon2.verify(user.motDePasse, motDePasse);
    if (!valid) return null;

    // Vérifiée après le mot de passe : la suspension n'est révélée qu'au titulaire du compte
    if (cabinetSuspendu(user.cabinet)) {
      throw new ForbiddenException({
        code: CODE_CABINET_SUSPENDU,
        message: MESSAGE_CABINET_SUSPENDU,
      });
    }

    const { motDePasse: _, cabinet: _cabinet, ...result } = user;
    return result;
  }
```

Si eslint signale `_cabinet` inutilisé, suivre la même solution que celle déjà employée dans le fichier pour `_`.

`refreshToken` devient :

```ts
  async refreshToken(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { include: { cabinet: { select: { actif: true } } } } },
    });

    if (!stored) {
      throw new UnauthorizedException('Token de rafraîchissement invalide ou expiré');
    }

    const { user } = stored;
    if (stored.expiresAt < new Date() || !user.actif || cabinetSuspendu(user.cabinet)) {
      await this.prisma.refreshToken.delete({ where: { token: refreshToken } });
      throw new UnauthorizedException(
        cabinetSuspendu(user.cabinet)
          ? MESSAGE_CABINET_SUSPENDU
          : 'Token de rafraîchissement invalide ou expiré',
      );
    }

    await this.prisma.refreshToken.delete({ where: { token: refreshToken } });

    return this.generateTokens(user.id, user.email, user.role);
  }
```

`RefreshToken` n'est pas cloisonné : le client filtré l'accepte sans contexte, et l'`include` du compte suit une relation.

`changePassword` : remplacer les trois accès `this.prisma.` par `this.prismaSansFiltre.` (le `findUnique`, le `$transaction`, le `user.update` et le `refreshToken.deleteMany` qu'il contient), et ajouter ce commentaire au-dessus du `findUnique` :

```ts
    // Sans filtre : un SUPER_ADMIN n'a pas de cabinet. L'identifiant vient du token,
    // l'appelant ne modifie donc que son propre compte
```

L'audit `CHANGE_PASSWORD` reste sur `AuditService` : pour un `SUPER_ADMIN`, il est ignoré sans erreur (`AuditService` intercepte l'exception), comme le prévoit la spec, qui ne demande l'audit que des actions de la plateforme.

- [x] **Step 5 : Adapter `JwtStrategy`**

Dans `backend/src/auth/strategies/jwt.strategy.ts`, importer `MESSAGE_CABINET_SUSPENDU` et `cabinetSuspendu` depuis `'../cabinet-suspendu'`, ajouter au `select` :

```ts
        cabinet: { select: { actif: true } },
```

et remplacer la fin de `validate` par :

```ts
    if (!user || !user.actif) {
      throw new UnauthorizedException('Compte désactivé ou inexistant');
    }

    if (cabinetSuspendu(user.cabinet)) {
      throw new UnauthorizedException(MESSAGE_CABINET_SUSPENDU);
    }

    const { cabinet: _cabinet, ...profil } = user;
    return { ...profil, sub: user.id };
```

- [x] **Step 6 : Élargir le garde-fou d'`auth.service.ts`**

Dans `backend/src/prisma/prisma-sans-filtre.spec.ts`, remplacer le test `auth.service.ts n'utilise que prismaSansFiltre.user.findUnique` par :

```ts
  it("auth.service.ts n'utilise que les accès sans filtre prévus", () => {
    const source = readFileSync(join(RACINE, 'auth/auth.service.ts'), 'utf8');
    const autres =
      source.match(
        /prismaSansFiltre\.(?!(user\.findUnique|user\.update|refreshToken\.deleteMany|\$transaction)\b)\S*/g,
      ) ?? [];
    expect(autres).toEqual([]);
  });
```

Vérifier par mutation : ajouter temporairement `this.prismaSansFiltre.patient.findMany();` dans `auth.service.ts`, constater l'échec du test, puis retirer la ligne.

- [x] **Step 7 : Vérifier**

Run : les commandes de vérification backend.
Expected : tout est vert. `auth.e2e-spec.ts` et `isolation.e2e-spec.ts` couvrent la connexion, le renouvellement et le changement de mot de passe existants.

- [x] **Step 8 : Commit**

```bash
cd $REPO && git add backend/src/auth/cabinet-suspendu.ts backend/src/auth/auth.service.ts backend/src/auth/auth.service.spec.ts backend/src/auth/strategies/jwt.strategy.ts backend/src/prisma/prisma-sans-filtre.spec.ts
git commit -m "feat: block sessions of suspended cabinets and check active accounts on refresh

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Accès Super Admin et commande de création

**Files:**
- Create: `backend/src/common/guards/super-admin.guard.ts`, `backend/src/common/guards/super-admin.guard.spec.ts`
- Create: `backend/src/common/decorators/super-admin-seulement.decorator.ts`
- Create: `backend/src/prisma/creer-super-admin.ts`, `backend/src/prisma/creer-super-admin.spec.ts`

- [x] **Step 1 : Écrire les tests**

`backend/src/common/guards/super-admin.guard.spec.ts` :

```ts
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

const contexte = (user: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();

  it('laisse passer un SUPER_ADMIN', () => {
    expect(guard.canActivate(contexte({ role: 'SUPER_ADMIN' }))).toBe(true);
  });

  it.each([
    { role: 'MEDECIN' },
    { role: 'MEDECIN', estTitulaire: true },
    { role: 'SECRETAIRE' },
    undefined,
  ])('refuse %j', (user) => {
    expect(() => guard.canActivate(contexte(user))).toThrow(ForbiddenException);
  });
});
```

`backend/src/prisma/creer-super-admin.spec.ts` :

```ts
import * as argon2 from 'argon2';
import { creerSuperAdmin } from './creer-super-admin';

const prismaFactice = () => ({
  user: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'sa1', ...data })),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
});

describe('creerSuperAdmin', () => {
  it('crée un SUPER_ADMIN sans cabinet, avec un mot de passe généré à changer', async () => {
    const prisma = prismaFactice();
    const res = await creerSuperAdmin(prisma as any, ['  Admin@Plateforme.MA ', 'Sara', 'Idrissi']);

    const data = prisma.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      email: 'admin@plateforme.ma',
      prenom: 'Sara',
      nom: 'Idrissi',
      role: 'SUPER_ADMIN',
      cabinetId: null,
      estTitulaire: false,
      doitChangerMdp: true,
    });
    expect(res.email).toBe('admin@plateforme.ma');
    expect(res.motDePasse).toHaveLength(12);
    expect(await argon2.verify(data.motDePasse, res.motDePasse)).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: { userId: null, action: 'CREATE_SUPER_ADMIN', entite: 'User', entiteId: 'sa1' },
    });
  });

  it.each([
    [[]],
    [['admin@plateforme.ma', 'Sara']],
    [['pas-un-email', 'Sara', 'Idrissi']],
    [['admin@plateforme.ma', '  ', 'Idrissi']],
  ])('refuse des arguments invalides %j sans rien créer', async (args) => {
    const prisma = prismaFactice();
    await expect(creerSuperAdmin(prisma as any, args)).rejects.toThrow('Usage');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuse un email déjà utilisé', async () => {
    const prisma = prismaFactice();
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });
    await expect(
      creerSuperAdmin(prisma as any, ['admin@plateforme.ma', 'Sara', 'Idrissi']),
    ).rejects.toThrow('Email déjà utilisé');
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2 : Vérifier l'échec**

Run: `cd $REPO/backend && npx jest src/common/guards/super-admin.guard.spec.ts src/prisma/creer-super-admin.spec.ts`
Expected : FAIL, modules introuvables.

- [x] **Step 3 : Garde et décorateur**

`backend/src/common/guards/super-admin.guard.ts` :

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException("Accès réservé à l'administrateur de la plateforme");
    }
    return true;
  }
}
```

`backend/src/common/decorators/super-admin-seulement.decorator.ts` :

```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SuperAdminGuard } from '../guards/super-admin.guard';

// Route réservée à l'administrateur de la plateforme
export const SuperAdminSeulement = () => UseGuards(JwtAuthGuard, SuperAdminGuard);
```

- [x] **Step 4 : Commande de création**

`backend/src/prisma/creer-super-admin.ts` :

```ts
// Crée un compte SUPER_ADMIN. Sur le serveur :
//   docker exec cabinet_backend node dist/prisma/creer-super-admin.js <email> <prénom> <nom>
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { isEmail } from 'class-validator';
import { genererMotDePasse } from '../auth/generer-mot-de-passe';

const USAGE = 'Usage : node dist/prisma/creer-super-admin.js <email> <prénom> <nom>';

type Client = Pick<PrismaClient, 'user' | 'auditLog'>;

export async function creerSuperAdmin(prisma: Client, args: string[]) {
  const [emailBrut, prenomBrut, nomBrut] = args;
  const email = (emailBrut ?? '').trim().toLowerCase();
  const prenom = (prenomBrut ?? '').trim();
  const nom = (nomBrut ?? '').trim();
  if (!isEmail(email) || !prenom || !nom) throw new Error(USAGE);

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`Email déjà utilisé : ${email}`);
  }

  const motDePasse = genererMotDePasse();
  const user = await prisma.user.create({
    data: {
      email,
      prenom,
      nom,
      role: Role.SUPER_ADMIN,
      cabinetId: null,
      estTitulaire: false,
      doitChangerMdp: true,
      motDePasse: await argon2.hash(motDePasse),
    },
  });
  await prisma.auditLog.create({
    data: { userId: null, action: 'CREATE_SUPER_ADMIN', entite: 'User', entiteId: user.id },
  });

  return { id: user.id, email, motDePasse };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const { email, motDePasse } = await creerSuperAdmin(prisma, process.argv.slice(2));
    console.log(`Compte SUPER_ADMIN créé : ${email}`);
    console.log(`Mot de passe initial (affiché une seule fois) : ${motDePasse}`);
    console.log('Il devra être changé à la première connexion.');
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
```

- [x] **Step 5 : Vérifier**

```bash
cd $REPO/backend && npx jest src/common/guards/super-admin.guard.spec.ts src/prisma/creer-super-admin.spec.ts src/prisma/prisma-sans-filtre.spec.ts
npm run build && ls dist/prisma/creer-super-admin.js
DATABASE_URL="$TEST_DB" node dist/prisma/creer-super-admin.js; echo "code: $?"
DATABASE_URL="$TEST_DB" node dist/prisma/creer-super-admin.js super.essai@plateforme.ma Essai Script; echo "code: $?"
DATABASE_URL="$TEST_DB" node dist/prisma/creer-super-admin.js super.essai@plateforme.ma Essai Script; echo "code: $?"
```

Expected : tests verts ; le fichier compilé existe ; sans argument, le message d'usage et `code: 1` ; la création affiche le mot de passe et `code: 0` ; le second appel affiche `Email déjà utilisé` et `code: 1`. La contrainte SQL `users_cabinet_selon_role` accepte ce compte. Si `npm run build` laisse un vieux `dist/src`, supprimer `backend/dist/src`.

Supprimer ensuite le compte de test : `docker compose -f $REPO/docker-compose.dev.yml exec -T postgres psql -U postgres -d cabinet_test -c "DELETE FROM audit_logs WHERE action='CREATE_SUPER_ADMIN'; DELETE FROM users WHERE email='super.essai@plateforme.ma';"`

- [x] **Step 6 : Commit**

```bash
cd $REPO && git add backend/src/common/guards/super-admin.guard.ts backend/src/common/guards/super-admin.guard.spec.ts backend/src/common/decorators/super-admin-seulement.decorator.ts backend/src/prisma/creer-super-admin.ts backend/src/prisma/creer-super-admin.spec.ts
git commit -m "feat: add super admin guard and server command to create a super admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Module plateforme

**Files:**
- Create: `backend/src/plateforme/dto/cabinet.dto.ts`, `plateforme.service.ts`, `plateforme.controller.ts`, `plateforme.module.ts`
- Modify: `backend/src/app.module.ts`, `backend/src/prisma/prisma-sans-filtre.spec.ts`
- Test: `backend/test/plateforme.e2e-spec.ts`

- [x] **Step 1 : Écrire le test e2e**

`backend/test/plateforme.e2e-spec.ts` :

```ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaSansFiltre } from '../src/prisma/prisma.service';
import { createApp, login, resetDb, seedCabinet } from './helpers';

const MDP = 'Medecin123!';

describe('Plateforme (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaSansFiltre;
  let tokenSA: string;
  let tokenTitulaire: string;
  let tokenMedecin: string;
  let tokenSecretaire: string;
  let atlas: { id: string; email: string; mdp: string };

  const appel = (methode: 'get' | 'post' | 'patch', url: string, token?: string, corps?: object) => {
    const r = request(app.getHttpServer())[methode](`/api${url}`);
    if (token) r.set('Authorization', `Bearer ${token}`);
    return corps ? r.send(corps) : r;
  };

  const creerCompte = async (
    id: string,
    email: string,
    role: Role,
    cabinetId: string | null,
    estTitulaire = false,
  ) =>
    prisma.user.create({
      data: {
        id,
        email,
        motDePasse: await argon2.hash(MDP),
        nom: id,
        prenom: 'Test',
        role,
        cabinetId,
        estTitulaire,
      },
    });

  const corpsCabinet = (email: string) => ({
    nom: 'Cabinet Atlas',
    adresse: '1 rue des Orangers',
    ville: 'Rabat',
    telephone: '0537000000',
    titulaire: { email, prenom: 'Amine', nom: 'Atlas' },
  });

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaSansFiltre);
    await resetDb(prisma);
    await seedCabinet(prisma, 'cab-existant');
    await seedCabinet(prisma, 'cab-vide');
    await creerCompte('ex-titulaire', 'ex.titulaire@cabinet.ma', Role.MEDECIN, 'cab-existant', true);
    await creerCompte('ex-medecin', 'ex.medecin@cabinet.ma', Role.MEDECIN, 'cab-existant');
    await creerCompte('ex-secretaire', 'ex.secretaire@cabinet.ma', Role.SECRETAIRE, 'cab-existant');
    await creerCompte('super-admin', 'super@plateforme.ma', Role.SUPER_ADMIN, null);
    tokenSA = (await login(app, 'super@plateforme.ma', MDP)).accessToken;
    tokenTitulaire = (await login(app, 'ex.titulaire@cabinet.ma', MDP)).accessToken;
    tokenMedecin = (await login(app, 'ex.medecin@cabinet.ma', MDP)).accessToken;
    tokenSecretaire = (await login(app, 'ex.secretaire@cabinet.ma', MDP)).accessToken;
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  describe('création', () => {
    it('crée le cabinet et son titulaire, qui se connecte et change son mot de passe', async () => {
      const res = await appel('post', '/plateforme/cabinets', tokenSA, corpsCabinet('Dr.Atlas@Cabinet.ma'));
      expect(res.status).toBe(201);
      expect(res.body.motDePasseInitial).toHaveLength(12);
      expect(res.body.titulaire.email).toBe('dr.atlas@cabinet.ma');
      expect(res.body.cabinet.ville).toBe('Rabat');

      const compte = await prisma.user.findUnique({ where: { email: 'dr.atlas@cabinet.ma' } });
      expect(compte).toMatchObject({
        role: Role.MEDECIN,
        estTitulaire: true,
        doitChangerMdp: true,
        cabinetId: res.body.cabinet.id,
      });

      const connexion = await login(app, 'dr.atlas@cabinet.ma', res.body.motDePasseInitial);
      expect(connexion.user.doitChangerMdp).toBe(true);
      const changement = await appel('post', '/auth/change-password', connexion.accessToken, {
        ancienMdp: res.body.motDePasseInitial,
        nouveauMdp: 'Atlas2026!',
      });
      expect(changement.status).toBe(201);
      const patients = await appel('get', '/patients', changement.body.accessToken);
      expect(patients.status).toBe(200);
      expect(patients.body.data).toEqual([]);

      atlas = { id: res.body.cabinet.id, email: 'dr.atlas@cabinet.ma', mdp: 'Atlas2026!' };
    });

    it('refuse un email déjà utilisé sans créer de cabinet', async () => {
      const avant = await prisma.cabinet.count();
      const res = await appel('post', '/plateforme/cabinets', tokenSA, corpsCabinet('ex.medecin@cabinet.ma'));
      expect(res.status).toBe(409);
      expect(await prisma.cabinet.count()).toBe(avant);
    });

    it.each([
      [{ telephone: '123' }],
      [{ nom: '' }],
      [{ pirate: 1 }],
      [{ titulaire: undefined }],
      [{ titulaire: { email: 'pas-un-email', prenom: 'A', nom: 'B' } }],
    ])('refuse des données invalides %j', async (modif) => {
      const res = await appel('post', '/plateforme/cabinets', tokenSA, {
        ...corpsCabinet('nouveau@cabinet.ma'),
        ...modif,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('liste', () => {
    it('affiche titulaire et nombre de comptes, sans aucune donnée patient', async () => {
      const res = await appel('get', '/plateforme/cabinets', tokenSA);
      expect(res.status).toBe(200);
      const existant = res.body.find((c: { id: string }) => c.id === 'cab-existant');
      expect(existant.titulaire).toEqual({
        id: 'ex-titulaire',
        prenom: 'Test',
        nom: 'ex-titulaire',
        email: 'ex.titulaire@cabinet.ma',
      });
      expect(existant.nbUtilisateurs).toBe(3);
      expect(Object.keys(existant).sort()).toEqual(
        ['actif', 'adresse', 'createdAt', 'id', 'nbUtilisateurs', 'nom', 'telephone', 'titulaire', 'ville'].sort(),
      );
      expect(res.body.find((c: { id: string }) => c.id === 'cab-vide').titulaire).toBeNull();
    });
  });

  describe('modification', () => {
    it('modifie les infos du cabinet', async () => {
      const res = await appel('patch', '/plateforme/cabinets/cab-existant', tokenSA, { ville: 'Fès' });
      expect(res.status).toBe(200);
      expect(res.body.ville).toBe('Fès');
    });

    it('répond 404 pour un cabinet inconnu', async () => {
      expect((await appel('patch', '/plateforme/cabinets/inconnu', tokenSA, { ville: 'X' })).status).toBe(404);
    });

    it("l'ordonnance porte la ville du cabinet", async () => {
      await prisma.patient.create({
        data: {
          id: 'ex-patient',
          cabinetId: 'cab-existant',
          nom: 'P',
          prenom: 'Q',
          dateNaissance: new Date('1980-01-01'),
          sexe: 'MASCULIN',
          telephone: '0671234567',
        },
      });
      await prisma.ordonnance.create({
        data: { id: 'ex-ord', cabinetId: 'cab-existant', patientId: 'ex-patient', medecinNom: 'Dr', contenu: [] },
      });
      const res = await appel('get', '/ordonnances/ex-ord', tokenTitulaire);
      expect(res.status).toBe(200);
      expect(res.body.cabinet).toEqual({ ville: 'Fès' });
      expect((await appel('get', '/ordonnances/ex-ord/pdf', tokenTitulaire)).status).toBe(200);
    });
  });

  describe('droits', () => {
    const routes: Array<['get' | 'post' | 'patch', string, object?]> = [
      ['get', '/plateforme/cabinets'],
      ['post', '/plateforme/cabinets', corpsCabinet('x@cabinet.ma')],
      ['patch', '/plateforme/cabinets/cab-existant', { ville: 'X' }],
      ['patch', '/plateforme/cabinets/cab-existant/statut', { actif: false }],
      ['post', '/plateforme/cabinets/cab-existant/titulaire/reset-password'],
    ];

    it.each(routes)('%s %s : 403 pour titulaire, médecin et secrétaire', async (methode, url, corps) => {
      for (const token of [tokenTitulaire, tokenMedecin, tokenSecretaire]) {
        expect((await appel(methode, url, token, corps)).status).toBe(403);
      }
      expect((await appel(methode, url, undefined, corps)).status).toBe(401);
    });

    it('le SUPER_ADMIN reste exclu des données des cabinets', async () => {
      expect((await appel('get', '/patients', tokenSA)).status).toBe(403);
      expect((await appel('get', '/rapports/dashboard', tokenSA)).status).toBe(403);
    });
  });

  describe('réinitialisation du titulaire', () => {
    it('donne un nouveau mot de passe et ferme les sessions du titulaire', async () => {
      const avant = await login(app, 'ex.titulaire@cabinet.ma', MDP);
      const res = await appel('post', '/plateforme/cabinets/cab-existant/titulaire/reset-password', tokenSA);
      expect(res.status).toBe(201);
      expect(res.body.motDePasseTemporaire).toHaveLength(12);

      expect((await appel('post', '/auth/login', undefined, { email: 'ex.titulaire@cabinet.ma', motDePasse: MDP })).status).toBe(401);
      const apres = await login(app, 'ex.titulaire@cabinet.ma', res.body.motDePasseTemporaire);
      expect(apres.user.doitChangerMdp).toBe(true);
      expect((await appel('post', '/auth/refresh', undefined, { refreshToken: avant.refreshToken })).status).toBe(401);
    });

    it("répond 404 pour un cabinet sans titulaire", async () => {
      const res = await appel('post', '/plateforme/cabinets/cab-vide/titulaire/reset-password', tokenSA);
      expect(res.status).toBe(404);
    });
  });

  describe('suspension', () => {
    it('bloque connexion, session et renouvellement, sans toucher les autres cabinets', async () => {
      const session = await login(app, 'ex.secretaire@cabinet.ma', MDP);

      const suspension = await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: false });
      expect(suspension.status).toBe(200);
      expect(suspension.body.actif).toBe(false);

      const connexion = await appel('post', '/auth/login', undefined, { email: 'ex.secretaire@cabinet.ma', motDePasse: MDP });
      expect(connexion.status).toBe(403);
      expect(connexion.body.code).toBe('CABINET_SUSPENDU');
      expect(connexion.body.message).toBe("Ce cabinet est suspendu. Contactez l'administrateur de la plateforme.");
      expect((await appel('get', '/patients', session.accessToken)).status).toBe(401);
      expect((await appel('post', '/auth/refresh', undefined, { refreshToken: session.refreshToken })).status).toBe(401);
      expect((await login(app, atlas.email, atlas.mdp)).accessToken).toBeDefined();

      const reactivation = await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: true });
      expect(reactivation.status).toBe(200);
      expect((await login(app, 'ex.secretaire@cabinet.ma', MDP)).accessToken).toBeDefined();
    });

    it('un état inchangé répond 200 sans effet', async () => {
      const res = await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: true });
      expect(res.status).toBe(200);
      expect(res.body.actif).toBe(true);
    });

    it('refuse un corps invalide', async () => {
      expect((await appel('patch', '/plateforme/cabinets/cab-existant/statut', tokenSA, { actif: 'non' })).status).toBe(400);
    });
  });

  describe('comptes et audit', () => {
    it('un compte désactivé ne peut pas renouveler sa session', async () => {
      const session = await login(app, 'ex.medecin@cabinet.ma', MDP);
      await prisma.user.update({ where: { id: 'ex-medecin' }, data: { actif: false } });
      try {
        expect((await appel('post', '/auth/refresh', undefined, { refreshToken: session.refreshToken })).status).toBe(401);
      } finally {
        await prisma.user.update({ where: { id: 'ex-medecin' }, data: { actif: true } });
      }
    });

    it('chaque action de la plateforme est auditée, sans cabinet ni mot de passe', async () => {
      const logs = await prisma.auditLog.findMany({ where: { userId: 'super-admin' } });
      const actions = new Set(logs.map((l) => l.action));
      for (const action of ['CREATE_CABINET', 'UPDATE_CABINET', 'SUSPEND_CABINET', 'REACTIVATE_CABINET', 'RESET_PASSWORD']) {
        expect(actions.has(action)).toBe(true);
      }
      expect(logs.every((l) => l.cabinetId === null)).toBe(true);
      expect(JSON.stringify(logs)).not.toMatch(/motDePasse/i);
    });

    it('le SUPER_ADMIN peut changer son mot de passe', async () => {
      const res = await appel('post', '/auth/change-password', tokenSA, {
        ancienMdp: MDP,
        nouveauMdp: 'Plateforme2026!',
      });
      expect(res.status).toBe(201);
    });
  });
});
```

- [x] **Step 2 : Vérifier l'échec**

Run: `cd $REPO/backend && DATABASE_URL="$TEST_DB" npx jest --config ./test/jest-e2e.json --runInBand --forceExit test/plateforme.e2e-spec.ts`
Expected : FAIL, les routes `/plateforme` répondent 404.

- [x] **Step 3 : DTOs**

`backend/src/plateforme/dto/cabinet.dto.ts` :

```ts
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { NormaliserEmail } from '../../common/transforms/normaliser-email';

const Nettoye = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const TELEPHONE = /^0[5-7][0-9]{8}$/;
const MESSAGE_TELEPHONE = 'Téléphone marocain invalide';

export class InfosCabinetDto {
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() nom: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() adresse: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() ville: string;
  @ApiProperty({ example: '0522123456' })
  @Matches(TELEPHONE, { message: MESSAGE_TELEPHONE })
  telephone: string;
}

export class TitulaireDto {
  @ApiProperty() @NormaliserEmail() @IsEmail({}, { message: 'Email invalide' }) email: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() prenom: string;
  @ApiProperty() @Nettoye() @IsString() @IsNotEmpty() nom: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(TELEPHONE, { message: MESSAGE_TELEPHONE })
  telephone?: string;
}

export class CreateCabinetDto extends InfosCabinetDto {
  @ApiProperty({ type: TitulaireDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => TitulaireDto)
  titulaire: TitulaireDto;
}

export class UpdateCabinetDto extends PartialType(InfosCabinetDto) {}

export class StatutCabinetDto {
  @ApiProperty() @IsBoolean() actif: boolean;
}
```

Le `ValidationPipe` global a `enableImplicitConversion` : vérifier par le test e2e que `{ actif: 'non' }` répond bien 400. Si la conversion implicite transforme la chaîne en booléen, ajouter sur `actif` un `@Transform(({ obj }) => obj.actif)` qui renvoie la valeur brute, puis relancer le test.

- [x] **Step 4 : Service**

`backend/src/plateforme/plateforme.service.ts` :

```ts
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaSansFiltre } from '../prisma/prisma.service';
import { genererMotDePasse } from '../auth/generer-mot-de-passe';
import { CreateCabinetDto, UpdateCabinetDto } from './dto/cabinet.dto';

// Le SUPER_ADMIN n'a pas de cabinet : ce service lit sans filtre, mais uniquement
// les cabinets, les comptes, les sessions et l'audit (garde-fou dans prisma-sans-filtre.spec.ts).
@Injectable()
export class PlateformeService {
  private readonly logger = new Logger(PlateformeService.name);

  constructor(private prismaSansFiltre: PrismaSansFiltre) {}

  async lister() {
    const cabinets = await this.prismaSansFiltre.cabinet.findMany({
      orderBy: { nom: 'asc' },
      include: {
        users: {
          where: { estTitulaire: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, prenom: true, nom: true, email: true },
        },
        _count: { select: { users: true } },
      },
    });
    return cabinets.map(({ users, _count, updatedAt: _maj, ...cabinet }) => ({
      ...cabinet,
      nbUtilisateurs: _count.users,
      titulaire: users[0] ?? null,
    }));
  }

  async creer(superAdminId: string, dto: CreateCabinetDto) {
    const { titulaire, ...infos } = dto;
    const existant = await this.prismaSansFiltre.user.findUnique({ where: { email: titulaire.email } });
    if (existant) throw new ConflictException('Email déjà utilisé');

    const motDePasseInitial = genererMotDePasse();
    const hash = await argon2.hash(motDePasseInitial);

    const resultat = await this.prismaSansFiltre
      .$transaction(async (tx) => {
        const cabinet = await tx.cabinet.create({ data: infos });
        const compte = await tx.user.create({
          data: {
            ...titulaire,
            cabinetId: cabinet.id,
            role: Role.MEDECIN,
            estTitulaire: true,
            doitChangerMdp: true,
            motDePasse: hash,
          },
          select: { id: true, email: true, nom: true, prenom: true },
        });
        return { cabinet, titulaire: compte };
      })
      .catch((e) => {
        // Deux créations simultanées : la contrainte unique l'emporte sur le pré-contrôle
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw new ConflictException('Email déjà utilisé');
        }
        throw e;
      });

    await this.auditer(superAdminId, 'CREATE_CABINET', 'Cabinet', resultat.cabinet.id);
    // Renvoyé une seule fois : seul le hash est stocké
    return { ...resultat, motDePasseInitial };
  }

  async modifier(superAdminId: string, id: string, dto: UpdateCabinetDto) {
    await this.trouver(id);
    const cabinet = await this.prismaSansFiltre.cabinet.update({ where: { id }, data: dto });
    await this.auditer(superAdminId, 'UPDATE_CABINET', 'Cabinet', id, dto);
    return cabinet;
  }

  async changerStatut(superAdminId: string, id: string, actif: boolean) {
    const actuel = await this.trouver(id);
    if (actuel.actif === actif) return actuel;

    const [cabinet] = await this.prismaSansFiltre.$transaction([
      this.prismaSansFiltre.cabinet.update({ where: { id }, data: { actif } }),
      // Suspension : toutes les sessions du cabinet sont fermées
      ...(actif ? [] : [this.prismaSansFiltre.refreshToken.deleteMany({ where: { user: { cabinetId: id } } })]),
    ]);
    await this.auditer(superAdminId, actif ? 'REACTIVATE_CABINET' : 'SUSPEND_CABINET', 'Cabinet', id);
    return cabinet;
  }

  async reinitialiserTitulaire(superAdminId: string, id: string) {
    await this.trouver(id);
    const titulaire = await this.prismaSansFiltre.user.findFirst({
      where: { cabinetId: id, estTitulaire: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!titulaire) throw new NotFoundException('Aucun titulaire pour ce cabinet');

    const motDePasseTemporaire = genererMotDePasse();
    await this.prismaSansFiltre.$transaction([
      this.prismaSansFiltre.user.update({
        where: { id: titulaire.id },
        data: { motDePasse: await argon2.hash(motDePasseTemporaire), doitChangerMdp: true },
      }),
      this.prismaSansFiltre.refreshToken.deleteMany({ where: { userId: titulaire.id } }),
    ]);
    await this.auditer(superAdminId, 'RESET_PASSWORD', 'User', titulaire.id);
    return { motDePasseTemporaire };
  }

  private async trouver(id: string) {
    const cabinet = await this.prismaSansFiltre.cabinet.findUnique({ where: { id } });
    if (!cabinet) throw new NotFoundException('Cabinet introuvable');
    return cabinet;
  }

  // Actions de la plateforme : sans cabinet. Ne jamais y mettre de mot de passe.
  private async auditer(
    userId: string,
    action: string,
    entite: string,
    entiteId: string,
    details?: object,
  ) {
    try {
      await this.prismaSansFiltre.auditLog.create({
        data: {
          userId,
          action,
          entite,
          entiteId,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Audit ${action} non enregistré : ${(err as Error).message}`);
    }
  }
}
```

Si eslint signale `_maj` inutilisé, appliquer la même solution que celle déjà employée dans le dépôt pour ce cas.

- [x] **Step 5 : Contrôleur et module**

`backend/src/plateforme/plateforme.controller.ts` :

```ts
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SuperAdminSeulement } from '../common/decorators/super-admin-seulement.decorator';
import { CreateCabinetDto, StatutCabinetDto, UpdateCabinetDto } from './dto/cabinet.dto';
import { PlateformeService } from './plateforme.service';

// :id n'est pas validé comme UUID : le premier cabinet a un identifiant fixe hors v4
@ApiTags('plateforme')
@ApiBearerAuth()
@SuperAdminSeulement()
@Controller('plateforme/cabinets')
export class PlateformeController {
  constructor(private service: PlateformeService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les cabinets (super admin)' })
  lister() {
    return this.service.lister();
  }

  @Post()
  @ApiOperation({ summary: 'Créer un cabinet et son titulaire (super admin)' })
  creer(@CurrentUser('id') superAdminId: string, @Body() dto: CreateCabinetDto) {
    return this.service.creer(superAdminId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Modifier les infos d'un cabinet (super admin)" })
  modifier(
    @CurrentUser('id') superAdminId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCabinetDto,
  ) {
    return this.service.modifier(superAdminId, id, dto);
  }

  @Patch(':id/statut')
  @ApiOperation({ summary: 'Suspendre ou réactiver un cabinet (super admin)' })
  changerStatut(
    @CurrentUser('id') superAdminId: string,
    @Param('id') id: string,
    @Body() dto: StatutCabinetDto,
  ) {
    return this.service.changerStatut(superAdminId, id, dto.actif);
  }

  @Post(':id/titulaire/reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe du titulaire (super admin)' })
  reinitialiserTitulaire(@CurrentUser('id') superAdminId: string, @Param('id') id: string) {
    return this.service.reinitialiserTitulaire(superAdminId, id);
  }
}
```

`backend/src/plateforme/plateforme.module.ts` :

```ts
import { Module } from '@nestjs/common';
import { PlateformeController } from './plateforme.controller';
import { PlateformeService } from './plateforme.service';

@Module({
  controllers: [PlateformeController],
  providers: [PlateformeService],
})
export class PlateformeModule {}
```

Dans `backend/src/app.module.ts`, importer `PlateformeModule` et l'ajouter à la liste `imports`, après `DocumentsModule`.

Vérifier dans `backend/src/common/decorators/current-user.decorator.ts` que `@CurrentUser('id')` renvoie bien l'identifiant (il est utilisé ainsi dans `consultations.controller.ts`).

- [x] **Step 6 : Garde-fous du service plateforme**

Dans `backend/src/prisma/prisma-sans-filtre.spec.ts` :

Ajouter `'plateforme/plateforme.service.ts'` à `AUTORISES`, puis ces tests :

```ts
  it("plateforme.service.ts n'atteint que les cabinets, comptes, sessions et audit", () => {
    const source = readFileSync(join(RACINE, 'plateforme/plateforme.service.ts'), 'utf8');
    const acces = [...source.matchAll(/\b(?:prismaSansFiltre|tx)\.(\$?\w+)/g)].map((m) => m[1]);
    const permis = new Set(['cabinet', 'user', 'auditLog', 'refreshToken', '$transaction']);
    expect(acces.filter((a) => !permis.has(a))).toEqual([]);
    expect(acces.length).toBeGreaterThan(0);
  });

  it('plateforme.service.ts ne cite aucune relation vers les données des patients', () => {
    const source = readFileSync(join(RACINE, 'plateforme/plateforme.service.ts'), 'utf8');
    const relations =
      /\b(patients|rendezVous|consultations|ordonnances|paiements|stockArticles|stockMouvements|documents|notifications|parametres)\s*:/;
    expect(source).not.toMatch(relations);
  });
```

Vérifier par mutation : ajouter temporairement `await this.prismaSansFiltre.patient.count();` dans `lister()`, constater l'échec du premier test ; ajouter `patients: true,` dans l'`include` de `lister()`, constater l'échec du second ; retirer les deux.

- [x] **Step 7 : Vérifier**

Run : les commandes de vérification backend, puis `cd $REPO/backend && npx eslint src/plateforme src/common src/prisma/prisma-sans-filtre.spec.ts`.
Expected : tout est vert, y compris `plateforme.e2e-spec.ts`.

- [x] **Step 8 : Commit**

```bash
cd $REPO && git add backend/src/plateforme backend/src/app.module.ts backend/src/prisma/prisma-sans-filtre.spec.ts backend/test/plateforme.e2e-spec.ts
git commit -m "feat: add platform module to create, list, edit and suspend cabinets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5 : Frontend, navigation du Super Admin

**Files:**
- Modify: `frontend/src/app/(auth)/login/page.tsx`
- Modify: `frontend/src/app/(dashboard)/layout.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [x] **Step 1 : Connexion**

Dans `frontend/src/app/(auth)/login/page.tsx`, remplacer `router.push('/dashboard');` par :

```ts
      router.push(res.data.user.role === 'SUPER_ADMIN' ? '/cabinets' : '/dashboard');
```

Le message d'un cabinet suspendu s'affiche déjà : la page montre `err.response?.data?.message`.

- [x] **Step 2 : Layout**

Dans `frontend/src/app/(dashboard)/layout.tsx`, après la ligne `const mdpAChanger = …` :

```ts
  // Le SUPER_ADMIN n'a accès qu'à la liste des cabinets et à son compte
  const pagePlateforme = pathname === '/cabinets' || pathname === '/mon-compte';
  const horsEspacePlateforme = user?.role === 'SUPER_ADMIN' && !pagePlateforme && !mdpAChanger;
```

Après le `useEffect` de `mdpAChanger` :

```ts
  useEffect(() => {
    if (_hasHydrated && token && horsEspacePlateforme) router.replace('/cabinets');
  }, [_hasHydrated, token, horsEspacePlateforme, router]);
```

Remplacer `if (!token || mdpAChanger) return null;` par :

```ts
  if (!token || mdpAChanger || horsEspacePlateforme) return null;
```

Tous les hooks doivent rester avant le premier `return`.

- [x] **Step 3 : Menu**

Dans `frontend/src/components/layout/Sidebar.tsx`, ajouter en tête de `nav` :

```ts
  { href: '/cabinets', icon: '🏥', label: 'Cabinets', roles: ['SUPER_ADMIN'] },
```

et remplacer les rôles de « Mon compte » par `['MEDECIN', 'SECRETAIRE', 'SUPER_ADMIN']`.

- [x] **Step 4 : Vérifier**

```bash
cd $REPO/frontend && npx tsc --noEmit; npm run lint
```

Expected : seulement les 4 erreurs `tsc` connues (`stock/page.tsx`, `NouveauRdvModal.tsx`) ; lint sans erreur. Pas de `next build` pendant qu'un serveur de développement tourne.

- [x] **Step 5 : Commit**

```bash
cd $REPO && git add "frontend/src/app/(auth)/login/page.tsx" "frontend/src/app/(dashboard)/layout.tsx" frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: route super admins to the cabinets space

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6 : Frontend, page Cabinets

**Files:**
- Create: `frontend/src/components/cabinets/types.ts`, `CreateCabinetModal.tsx`, `EditCabinetModal.tsx`, `StatutCabinetModal.tsx`, `ResetTitulaireModal.tsx`
- Create: `frontend/src/app/(dashboard)/cabinets/page.tsx`

- [x] **Step 1 : Types**

`frontend/src/components/cabinets/types.ts` :

```ts
export interface Cabinet {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  telephone: string;
  actif: boolean;
  createdAt: string;
  nbUtilisateurs: number;
  titulaire: { id: string; prenom: string; nom: string; email: string } | null;
}

export const TELEPHONE = /^0[5-7][0-9]{8}$/;
```

- [x] **Step 2 : Création**

`frontend/src/components/cabinets/CreateCabinetModal.tsx` :

```tsx
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { MotDePasseGenere } from '@/components/utilisateurs/MotDePasseGenere';
import { TELEPHONE } from './types';

const schema = z.object({
  nom: z.string().trim().min(1, 'Nom requis'),
  adresse: z.string().trim().min(1, 'Adresse requise'),
  ville: z.string().trim().min(1, 'Ville requise'),
  telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide'),
  titulaire: z.object({
    prenom: z.string().trim().min(1, 'Prénom requis'),
    nom: z.string().trim().min(1, 'Nom requis'),
    email: z.string().trim().email('Email invalide'),
    telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide').or(z.literal('')),
  }),
});

type FormData = z.infer<typeof schema>;

interface Reponse {
  titulaire: { email: string; nom: string; prenom: string };
  motDePasseInitial: string;
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1';
const errClass = 'text-xs text-red-600 mt-1';
const labelClass = 'text-sm font-medium text-gray-700';

export function CreateCabinetModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cree, setCree] = useState<Reponse | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient
        .post<Reponse>('/plateforme/cabinets', {
          ...data,
          titulaire: { ...data.titulaire, telephone: data.titulaire.telephone || undefined },
        })
        .then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      setCree(data);
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setError('titulaire.email', { message: 'Email déjà utilisé' });
        return;
      }
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Erreur lors de la création');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {cree ? (
          <MotDePasseGenere
            titre="Cabinet créé"
            utilisateur={cree.titulaire}
            motDePasse={cree.motDePasseInitial}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 className="font-bold text-lg mb-4">Nouveau cabinet</h2>
            <form noValidate onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-900 mb-1">Cabinet</legend>
                <div>
                  <label className={labelClass}>Nom *</label>
                  <input {...register('nom')} className={inputClass} />
                  {errors.nom && <p className={errClass}>{errors.nom.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Adresse *</label>
                  <input {...register('adresse')} className={inputClass} />
                  {errors.adresse && <p className={errClass}>{errors.adresse.message}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Ville *</label>
                    <input {...register('ville')} className={inputClass} />
                    {errors.ville && <p className={errClass}>{errors.ville.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone *</label>
                    <input {...register('telephone')} placeholder="0522123456" className={inputClass} />
                    {errors.telephone && <p className={errClass}>{errors.telephone.message}</p>}
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-900 mb-1">Médecin titulaire</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Prénom *</label>
                    <input {...register('titulaire.prenom')} className={inputClass} />
                    {errors.titulaire?.prenom && <p className={errClass}>{errors.titulaire.prenom.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Nom *</label>
                    <input {...register('titulaire.nom')} className={inputClass} />
                    {errors.titulaire?.nom && <p className={errClass}>{errors.titulaire.nom.message}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" autoComplete="off" {...register('titulaire.email')} className={inputClass} />
                  {errors.titulaire?.email && <p className={errClass}>{errors.titulaire.email.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input {...register('titulaire.telephone')} placeholder="0612345678" className={inputClass} />
                  {errors.titulaire?.telephone && <p className={errClass}>{errors.titulaire.telephone.message}</p>}
                </div>
              </fieldset>

              <p className="text-xs text-gray-500">
                Un mot de passe initial sera généré pour le titulaire et affiché une seule fois.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
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

- [x] **Step 3 : Modification**

`frontend/src/components/cabinets/EditCabinetModal.tsx` :

```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { TELEPHONE, type Cabinet } from './types';

const schema = z.object({
  nom: z.string().trim().min(1, 'Nom requis'),
  adresse: z.string().trim().min(1, 'Adresse requise'),
  ville: z.string().trim().min(1, 'Ville requise'),
  telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide'),
});

type FormData = z.infer<typeof schema>;

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1';
const errClass = 'text-xs text-red-600 mt-1';
const labelClass = 'text-sm font-medium text-gray-700';

export function EditCabinetModal({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nom: cabinet.nom,
      adresse: cabinet.adresse,
      ville: cabinet.ville,
      telephone: cabinet.telephone,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiClient.patch(`/plateforme/cabinets/${cabinet.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      toast.success('Cabinet modifié');
      onClose();
    },
    onError: (err: any) => {
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Erreur lors de la modification');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-4">Modifier {cabinet.nom}</h2>
        <form noValidate onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
          <div>
            <label className={labelClass}>Nom *</label>
            <input {...register('nom')} className={inputClass} />
            {errors.nom && <p className={errClass}>{errors.nom.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Adresse *</label>
            <input {...register('adresse')} className={inputClass} />
            {errors.adresse && <p className={errClass}>{errors.adresse.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Ville *</label>
              <input {...register('ville')} className={inputClass} />
              {errors.ville && <p className={errClass}>{errors.ville.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Téléphone *</label>
              <input {...register('telephone')} className={inputClass} />
              {errors.telephone && <p className={errClass}>{errors.telephone.message}</p>}
            </div>
          </div>
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

- [x] **Step 4 : Suspension et réactivation**

`frontend/src/components/cabinets/StatutCabinetModal.tsx` :

```tsx
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import type { Cabinet } from './types';

export function StatutCabinetModal({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const suspendre = cabinet.actif;

  const mutation = useMutation({
    mutationFn: () => apiClient.patch(`/plateforme/cabinets/${cabinet.id}/statut`, { actif: !suspendre }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      toast.success(suspendre ? 'Cabinet suspendu' : 'Cabinet réactivé');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors du changement'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg mb-3">{suspendre ? 'Suspendre le cabinet' : 'Réactiver le cabinet'}</h2>
        <p className="text-sm text-gray-600">
          {suspendre
            ? `Suspendre ${cabinet.nom} ? Ses utilisateurs seront déconnectés et ne pourront plus se connecter. Les données sont conservées.`
            : `Réactiver ${cabinet.nom} ? Ses utilisateurs pourront de nouveau se connecter.`}
        </p>
        <div className="flex justify-end gap-3 pt-5">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`px-6 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${suspendre ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {mutation.isPending ? '...' : suspendre ? 'Suspendre' : 'Réactiver'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 5 : Réinitialisation du titulaire**

`frontend/src/components/cabinets/ResetTitulaireModal.tsx` :

```tsx
'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { MotDePasseGenere } from '@/components/utilisateurs/MotDePasseGenere';
import type { Cabinet } from './types';

type Titulaire = NonNullable<Cabinet['titulaire']>;

export function ResetTitulaireModal({
  cabinet,
  titulaire,
  onClose,
}: {
  cabinet: Cabinet;
  titulaire: Titulaire;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [motDePasse, setMotDePasse] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient
        .post<{ motDePasseTemporaire: string }>(`/plateforme/cabinets/${cabinet.id}/titulaire/reset-password`)
        .then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      setMotDePasse(data.motDePasseTemporaire);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        {motDePasse ? (
          <MotDePasseGenere
            titre="Mot de passe réinitialisé"
            utilisateur={titulaire}
            motDePasse={motDePasse}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 className="font-bold text-lg mb-3">Réinitialiser le mot de passe</h2>
            <p className="text-sm text-gray-600">
              Réinitialiser le mot de passe de {titulaire.prenom} {titulaire.nom}, titulaire de {cabinet.nom} ?
              Un nouveau mot de passe temporaire sera généré et ses sessions seront fermées.
            </p>
            <div className="flex justify-end gap-3 pt-5">
              <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
                Annuler
              </button>
              <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
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

- [x] **Step 6 : Page**

`frontend/src/app/(dashboard)/cabinets/page.tsx` :

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import type { Cabinet } from '@/components/cabinets/types';
import { CreateCabinetModal } from '@/components/cabinets/CreateCabinetModal';
import { EditCabinetModal } from '@/components/cabinets/EditCabinetModal';
import { StatutCabinetModal } from '@/components/cabinets/StatutCabinetModal';
import { ResetTitulaireModal } from '@/components/cabinets/ResetTitulaireModal';

type Action = { type: 'modifier' | 'statut' | 'reset'; cabinet: Cabinet };

export default function CabinetsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const estSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [creation, setCreation] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  useEffect(() => {
    if (user && !estSuperAdmin) router.replace('/dashboard');
  }, [user, estSuperAdmin, router]);

  const { data: cabinets = [], isLoading } = useQuery<Cabinet[]>({
    queryKey: ['cabinets'],
    queryFn: () => apiClient.get('/plateforme/cabinets').then(r => r.data),
    enabled: estSuperAdmin,
  });

  if (!estSuperAdmin) return null;

  const fermer = () => setAction(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Cabinets</h1>
        <button
          onClick={() => setCreation(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + Nouveau cabinet
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Chargement...</p>
        ) : cabinets.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">Aucun cabinet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cabinet</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Titulaire</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Utilisateurs</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">État</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Créé le</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cabinets.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.nom}</p>
                      <p className="text-xs text-gray-400">{c.ville} · {c.telephone}</p>
                      <p className="text-xs text-gray-400 sm:hidden">
                        {c.titulaire ? `${c.titulaire.prenom} ${c.titulaire.nom}` : 'Aucun titulaire'} · {c.actif ? 'Actif' : 'Suspendu'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {c.titulaire ? (
                        <>
                          <p>{c.titulaire.prenom} {c.titulaire.nom}</p>
                          <p className="text-xs text-gray-400">{c.titulaire.email}</p>
                        </>
                      ) : (
                        <span className="text-gray-400">Aucun titulaire</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{c.nbUtilisateurs}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full ${c.actif ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.actif ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                      {new Date(c.createdAt).toLocaleDateString('fr-MA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <button onClick={() => setAction({ type: 'modifier', cabinet: c })} className="text-xs text-blue-600 hover:underline">
                          Modifier
                        </button>
                        <button onClick={() => setAction({ type: 'statut', cabinet: c })} className={`text-xs hover:underline ${c.actif ? 'text-red-600' : 'text-green-700'}`}>
                          {c.actif ? 'Suspendre' : 'Réactiver'}
                        </button>
                        {c.titulaire && (
                          <button onClick={() => setAction({ type: 'reset', cabinet: c })} className="text-xs text-blue-600 hover:underline">
                            Réinitialiser le titulaire
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creation && <CreateCabinetModal onClose={() => setCreation(false)} />}
      {action?.type === 'modifier' && <EditCabinetModal cabinet={action.cabinet} onClose={fermer} />}
      {action?.type === 'statut' && <StatutCabinetModal cabinet={action.cabinet} onClose={fermer} />}
      {action?.type === 'reset' && action.cabinet.titulaire && (
        <ResetTitulaireModal cabinet={action.cabinet} titulaire={action.cabinet.titulaire} onClose={fermer} />
      )}
    </div>
  );
}
```

- [x] **Step 7 : Vérifier**

```bash
cd $REPO/frontend && npx tsc --noEmit; npm run lint
```

Expected : seulement les 4 erreurs `tsc` connues ; lint sans erreur. Vérifier que `MotDePasseGenere` accepte bien `{ prenom, nom, email }` (son type est `Pick<Utilisateur, 'prenom' | 'nom' | 'email'>`).

- [x] **Step 8 : Commit**

```bash
cd $REPO && git add frontend/src/components/cabinets "frontend/src/app/(dashboard)/cabinets/page.tsx"
git commit -m "feat: add cabinets page for super admins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7 : Parcours navigateur et documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/plans/2026-11-07-multi-cabinet-super-admin.md`

- [x] **Step 1 : Parcours Playwright sur la base locale**

Démarrer Docker, puis le backend (`cd backend && npm run start:dev`) et le frontend (`cd frontend && npm run dev`) en arrière-plan. Pour les documents en local, `MINIO_ENDPOINT=http://localhost:9000`.

Créer un Super Admin local : `cd backend && npm run build && node dist/prisma/creer-super-admin.js super.local@plateforme.ma Super Local`.

Vérifier avec les outils Playwright, sur http://localhost:3000 :

1. Connexion du Super Admin : redirection vers « Mon compte » (changement forcé), changement du mot de passe, puis arrivée sur « Cabinets ». Le menu ne contient que « Cabinets » et « Mon compte ».
2. Taper `/patients` ou `/dashboard` dans l'adresse : retour sur « Cabinets ».
3. La liste affiche « Cabinet de démonstration », son titulaire `admin@cabinet.ma` et son nombre d'utilisateurs.
4. Création d'un cabinet de test : erreurs de la modale (téléphone, champs vides, email déjà utilisé), puis succès et mot de passe affiché avec « Copier ».
5. Connexion du nouveau titulaire avec ce mot de passe, changement forcé, menu complet, liste des patients vide.
6. Modification du cabinet de test : nouvelle ville visible dans la liste.
7. Le titulaire de test étant connecté dans un autre onglet, suspension du cabinet : son action suivante le renvoie à la connexion, qui affiche « Ce cabinet est suspendu. Contactez l'administrateur de la plateforme. » ; `admin@cabinet.ma` peut toujours se connecter.
8. Réactivation : le titulaire de test se reconnecte.
9. Réinitialisation du titulaire de test : nouveau mot de passe affiché, connexion possible avec lui.
10. Aucune erreur dans la console du navigateur.

Nettoyer ensuite la base locale par des requêtes ciblées sur les identifiants créés : cabinet de test, ses comptes, leurs sessions, les lignes d'audit correspondantes, le Super Admin local. Arrêter les serveurs.

- [x] **Step 2 : Vérifications complètes**

```bash
cd $REPO/backend && npx tsc --noEmit -p tsconfig.json && npx jest && DATABASE_URL="$TEST_DB" npm run test:e2e
cd $REPO/frontend && npm run build
```

Expected : tout est vert. `next build` seulement après l'arrêt du serveur de développement. Noter les nombres de tests pour la PR.

- [x] **Step 3 : `CLAUDE.md`**

Dans la section « Multi-cabinet : isolation », ajouter :

```markdown
- Le client filtré refuse aussi le modèle `Cabinet` : un service d'un cabinet n'atteint son cabinet que par une relation (ex. `ordonnance.cabinet`).
- Le module `plateforme/` (rôle `SUPER_ADMIN`, `@SuperAdminSeulement()`) utilise `PrismaSansFiltre`, limité par test aux modèles `Cabinet`, `User`, `AuditLog` et `RefreshToken` : jamais de données de patients.
- Un cabinet suspendu (`Cabinet.actif = false`) bloque la connexion (403 `CABINET_SUSPENDU`), les sessions ouvertes (`JwtStrategy`) et le renouvellement.
```

Ajouter une section après « Comptes de démo » :

~~~markdown
## Super Admin

Aucun compte n'est créé par le seed. Sur le serveur :

```bash
docker exec cabinet_backend node dist/prisma/creer-super-admin.js <email> <prénom> <nom>
```

La commande affiche un mot de passe généré, à changer à la première connexion. Le Super Admin gère les cabinets sur la page « Cabinets » : création (avec le titulaire), modification, suspension, réactivation, réinitialisation du mot de passe du titulaire.
~~~

Dans « Architecture API », ajouter la ligne :

```
/plateforme/cabinets liste, création, modification, statut, titulaire/reset-password  (SUPER_ADMIN)
```

Dans « Pièges connus », ajouter :

```markdown
| Identifiant de cabinet refusé par `@IsUUID` | Le premier cabinet a l'identifiant fixe `00000000-0000-0000-0000-000000000001` (hors v4) : ne pas valider les `:id` de cabinet comme UUID |
```

- [x] **Step 4 : Marquer le plan**

Cocher toutes les étapes de ce fichier et ajouter sous le titre : `**Statut :** réalisé le <date> sur la branche feat/multi-cabinet-super-admin, non mergé.`

- [x] **Step 5 : Commit**

```bash
cd $REPO && git add CLAUDE.md docs/superpowers/plans/2026-11-07-multi-cabinet-super-admin.md
git commit -m "docs: document the super admin space

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Après le plan

Ne pas pousser sans l'accord de l'utilisateur. Au moment de la PR, lui rappeler :

1. Le merge déclenche le déploiement (aucune migration de base).
2. Après le déploiement, il crée son compte : `docker exec cabinet_backend node dist/prisma/creer-super-admin.js <email> <prénom> <nom>` sur le serveur, puis se connecte et change le mot de passe.
3. Vérifier ensuite : `/api/plateforme/cabinets` répond 401 sans token, la page « Cabinets » liste le cabinet existant.
