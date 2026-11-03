# Spec — Création d'utilisateurs par l'admin

**Date :** 2026-11-04
**Statut :** approuvé

---

## Contexte

- `POST /api/auth/users` (ADMIN) existe côté backend, mais **aucun écran** ne l'utilise : l'admin ne peut créer un compte que par l'API (Swagger).
- Le compte créé n'est pas obligé de changer son mot de passe initial, alors qu'un compte réinitialisé l'est (`User.doitChangerMdp`, voir `2026-10-31-modification-mot-de-passe-design.md`).
- Les règles de mot de passe divergent : la création exige 8 caractères + majuscule + minuscule + chiffre, la réinitialisation et le changement seulement 8 caractères.
- Les emails ne sont normalisés nulle part : `Dr.X@cabinet.ma` et `dr.x@cabinet.ma` seraient deux comptes distincts, et la connexion dépend de la casse saisie.

## Objectif

L'admin crée un compte depuis la page « Utilisateurs » en saisissant le mot de passe initial ; le nouvel utilisateur doit le changer à sa première connexion.

## Hors périmètre

- Modification d'un compte (nom, rôle, téléphone), activation/désactivation, suppression.
- Génération automatique du mot de passe initial, envoi par email.

---

## Backend

### Règle de mot de passe commune

Nouveau décorateur `@MotDePasseFort()` (`backend/src/common/validators/mot-de-passe-fort.decorator.ts`), composé avec `applyDecorators` :

- `IsString()`
- `MinLength(8)`
- `Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)`, message : `Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule et un chiffre`

Appliqué à :

- `CreateUserDto.motDePasse` (remplace les décorateurs actuels)
- `ResetPasswordDto.nouveauMdp`
- `ChangePasswordDto.nouveauMdp`

`ChangePasswordDto.ancienMdp` reste un simple `IsString()` (mot de passe actuel, quel qu'il soit). Les mots de passe déjà en base ne sont pas revérifiés.

### Normalisation de l'email

`@Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))` sur l'email de `CreateUserDto` et de `LoginDto` (le `ValidationPipe` global a `transform: true`). Conséquences : connexion insensible à la casse, et le contrôle de doublon existant (409 `Email déjà utilisé`) l'est aussi. Les emails existants sont déjà en minuscules.

### Téléphone

`CreateUserDto.telephone` reste optionnel, validé par `Matches(/^0[5-7][0-9]{8}$/, { message: 'Téléphone marocain invalide' })` (même règle que les patients côté frontend).

### `POST /auth/users` (existant, ADMIN)

- Le contrôleur passe l'id de l'admin connecté : `createUser(adminId, dto)`.
- Création avec `doitChangerMdp: true`.
- `select` de la réponse : `id, email, nom, prenom, role, telephone, actif, doitChangerMdp, createdAt` (jamais `motDePasse`).
- Audit `CREATE_USER` : `userId` = admin, `entite` = `User`, `entiteId` = nouveau compte.
- Erreurs : 409 email déjà utilisé, 400 validation (mot de passe faible, téléphone invalide, email invalide, rôle inconnu), 403 non-admin.

---

## Frontend

### Règle de mot de passe commune

Nouveau fichier `frontend/src/lib/validation.ts` :

```ts
export const motDePasseFort = z
  .string()
  .min(8, '8 caractères minimum')
  .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Au moins une majuscule, une minuscule et un chiffre');

export const AIDE_MOT_DE_PASSE = '8 caractères minimum, avec une majuscule, une minuscule et un chiffre';
```

Utilisé pour : « Nouveau mot de passe » de `/mon-compte`, la modale de réinitialisation et la modale de création. Le texte `AIDE_MOT_DE_PASSE` s'affiche en gris sous chacun de ces champs.

### Page `/utilisateurs`

- Bouton **« + Nouvel utilisateur »** dans l'en-tête de page (même style que « + Nouvel article » de Stock), qui ouvre `CreateUserModal` (dans le même fichier que `ResetModal`).
- Champs (React Hook Form + Zod) :
  - Prénom, Nom (deux colonnes, requis)
  - Email (requis, format email)
  - Rôle (`select` sans présélection : option vide « Choisir un rôle… », puis ADMIN / MEDECIN / SECRETAIRE ; requis, message `Choisissez un rôle` si rien n'est choisi)
  - Téléphone (optionnel, `^0[5-7][0-9]{8}$`, placeholder `0612345678`)
  - Mot de passe initial (`motDePasseFort`) + Confirmation (identique)
- Envoi : téléphone vide → `undefined` (pas `""`), la confirmation n'est pas envoyée.
- Succès : fermeture, invalidation de `['users']`, toast : « Utilisateur créé. Communiquez-lui son mot de passe initial : il devra le changer à sa première connexion. »
- 409 → message `Email déjà utilisé` sous le champ email. Autres erreurs → toast avec le message de l'API.

### Page `/mon-compte`

Bandeau du changement forcé, nouveau texte (valable pour une création comme pour une réinitialisation) : « Votre mot de passe a été défini par l'administrateur. Choisissez un nouveau mot de passe pour continuer. »

---

## Tests

### Unitaires (`backend/src/auth/auth.service.spec.ts`)

`createUser` :
- email déjà utilisé → `ConflictException`
- succès → `create` appelé avec `doitChangerMdp: true` et un hash argon2 valide, `select` sans `motDePasse`, audit `(adminId, 'CREATE_USER', 'User', <id créé>)`

### E2E (`backend/test/auth.e2e-spec.ts`, base `cabinet_test`)

- Admin crée un compte → 201, `doitChangerMdp: true`, pas de `motDePasse`
- Secrétaire → 403
- Scénario : création de `Nouveau.Medecin@Cabinet.ma` → login avec `nouveau.medecin@cabinet.ma` → `user.doitChangerMdp === true` → `GET /patients` 403 `MUST_CHANGE_PASSWORD`
- Même email avec une autre casse → 409
- Mot de passe sans majuscule ou sans chiffre → 400 à la création, à la réinitialisation et au changement
- Téléphone `12345` → 400 ; sans téléphone → 201

### Frontend

Parcours navigateur Playwright : création par l'admin (erreurs de la modale : mot de passe faible, confirmation différente, téléphone invalide, email déjà utilisé), badge « Changement requis », première connexion → `/mon-compte` avec le nouveau bandeau, changement → accès rétabli. Puis `next build`, aucune nouvelle erreur `tsc` (4 erreurs déjà présentes), lint sans erreur.
