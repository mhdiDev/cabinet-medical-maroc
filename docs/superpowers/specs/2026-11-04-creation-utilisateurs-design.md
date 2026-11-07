# Spec — Création d'utilisateurs par l'admin et mots de passe générés

**Date :** 2026-11-04
**Statut :** approuvé

---

## Contexte

- `POST /api/auth/users` (ADMIN) existe côté backend, mais **aucun écran** ne l'utilise : l'admin ne peut créer un compte que par l'API (Swagger).
- Le compte créé n'est pas obligé de changer son mot de passe initial, alors qu'un compte réinitialisé l'est (`User.doitChangerMdp`, voir `2026-10-31-modification-mot-de-passe-design.md`).
- Aujourd'hui l'admin **saisit** le mot de passe : à la création (API) et à la réinitialisation (modale de `/utilisateurs`).
- Les règles de mot de passe divergent : la création exige 8 caractères + majuscule + minuscule + chiffre, le changement par l'utilisateur seulement 8 caractères.
- Les emails ne sont normalisés nulle part : `Dr.X@cabinet.ma` et `dr.x@cabinet.ma` seraient deux comptes distincts, et la connexion dépend de la casse saisie.

## Objectif

1. L'admin crée un compte depuis la page « Utilisateurs ».
2. Le mot de passe initial (création) et le mot de passe temporaire (réinitialisation) sont **générés par le serveur** et affichés une seule fois à l'admin, qui le transmet à la personne. L'admin ne choisit jamais le mot de passe d'un autre utilisateur.
3. Le nouvel utilisateur doit changer ce mot de passe à sa première connexion (mécanisme `doitChangerMdp` existant).

## Hors périmètre

- **Fonctionnalité suivante, à faire juste après :** modifier un compte (nom, rôle, téléphone), le désactiver (`User.actif` existe déjà), le supprimer.
- Envoi du mot de passe par email (l'application n'envoie pas d'emails en production pour l'instant) : l'admin le transmet lui-même.

---

## Backend

### Génération du mot de passe

Nouvelle fonction `genererMotDePasse()` (`backend/src/auth/generer-mot-de-passe.ts`) :

- 12 caractères tirés avec `crypto.randomInt` (Node `crypto`, jamais `Math.random`).
- Alphabet sans caractères ambigus : majuscules sans `I` ni `O`, minuscules sans `l`, chiffres `2`–`9`.
- Garantit au moins une majuscule, une minuscule et un chiffre (un caractère de chaque classe placé puis le reste tiré dans l'alphabet complet, ordre mélangé avec `crypto.randomInt`).
- Le mot de passe en clair n'est jamais stocké, journalisé, ni écrit dans l'audit : seul son hash argon2 est enregistré.

### `POST /auth/users` (existant, ADMIN)

- `CreateUserDto` : `email`, `nom`, `prenom`, `role`, `telephone?`. **Plus de champ `motDePasse`** (le `ValidationPipe` le refuse désormais avec 400 s'il est envoyé).
- Email normalisé : `@Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))`.
- Téléphone optionnel validé : `Matches(/^0[5-7][0-9]{8}$/, { message: 'Téléphone marocain invalide' })`.
- Le contrôleur passe l'id de l'admin : `createUser(adminId, dto)`.
- Création avec le hash du mot de passe généré et `doitChangerMdp: true`.
- Réponse 201 : `{ user: { id, email, nom, prenom, role, telephone, actif, doitChangerMdp, createdAt }, motDePasseInitial }` (jamais le hash).
- Audit `CREATE_USER` : `userId` = admin, `entite` = `User`, `entiteId` = nouveau compte.
- Erreurs : 409 `Email déjà utilisé` (insensible à la casse grâce à la normalisation), 400 validation, 403 non-admin.

### `POST /auth/users/:id/reset-password` (existant, ADMIN)

- **Plus de corps de requête** (suppression de `ResetPasswordDto`).
- Le serveur génère le mot de passe temporaire, puis comportement inchangé : hash, `doitChangerMdp: true`, révocation des refresh tokens (transaction), audit `RESET_PASSWORD`, 400 si l'admin vise son propre compte, 404 si inconnu.
- Réponse 201 : `{ motDePasseTemporaire }` (remplace `{ success: true }`).

### Login

`LoginDto.email` reçoit la même normalisation (`trim` + minuscules) : connexion insensible à la casse. Les emails existants sont déjà en minuscules.

### Changement par l'utilisateur (`POST /auth/change-password`)

`ChangePasswordDto.nouveauMdp` adopte la règle de la création : `MinLength(8)` + `Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'Le mot de passe doit contenir au moins 8 caractères, dont une majuscule, une minuscule et un chiffre' })`. `ancienMdp` reste un simple `IsString()`. Les mots de passe déjà en base ne sont pas revérifiés. C'est désormais le seul endroit où un humain choisit un mot de passe.

---

## Frontend

### Composant partagé `MotDePasseGenere`

`frontend/src/components/utilisateurs/MotDePasseGenere.tsx`, affiché dans les deux modales après succès :

- Titre (« Compte créé » / « Mot de passe réinitialisé ») et nom + email de l'utilisateur.
- Le mot de passe en police monospace, grande taille, sélectionnable.
- Bouton **« Copier »** (`navigator.clipboard.writeText`, toast « Mot de passe copié » ; en cas d'échec, toast « Copie impossible : sélectionnez le mot de passe »).
- Avertissement : « Notez-le maintenant : il ne sera plus affiché. L'utilisateur devra le changer à sa première connexion. »
- Un seul bouton de fermeture : « J'ai noté le mot de passe ». Pas de fermeture par clic à l'extérieur.

### Page `/utilisateurs`

- Bouton **« + Nouvel utilisateur »** dans l'en-tête de page (même style que « + Nouvel article » de Stock), qui ouvre `CreateUserModal`.
- `CreateUserModal` (React Hook Form + Zod) :
  - Prénom, Nom (deux colonnes, requis)
  - Email (requis, format email)
  - Rôle (`select` sans présélection : option vide « Choisir un rôle… », puis ADMIN / MEDECIN / SECRETAIRE ; requis, message `Choisissez un rôle`)
  - Téléphone (optionnel, `^0[5-7][0-9]{8}$`, placeholder `0612345678`) ; vide → envoyé `undefined` (pas `""`)
  - Succès : invalidation de `['users']`, puis la modale affiche `MotDePasseGenere` avec `motDePasseInitial`.
  - 409 → `Email déjà utilisé` sous le champ email ; autres erreurs → toast avec le message de l'API.
- `ResetModal` devient une confirmation : « Réinitialiser le mot de passe de Prénom Nom ? Un nouveau mot de passe temporaire sera généré et ses sessions seront fermées. » + boutons Annuler / Réinitialiser. Succès : invalidation de `['users']`, puis `MotDePasseGenere` avec `motDePasseTemporaire`.

### Page `/mon-compte`

- Nouveau texte du bandeau de changement forcé (valable pour une création comme pour une réinitialisation) : « Votre mot de passe a été défini par l'administrateur. Choisissez un nouveau mot de passe pour continuer. »
- Le schéma Zod de `nouveauMdp` adopte la règle du backend (8 caractères minimum + `regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Au moins une majuscule, une minuscule et un chiffre')`), avec l'aide en gris sous le champ : « 8 caractères minimum, avec une majuscule, une minuscule et un chiffre ».

---

## Tests

### Unitaires

- `generer-mot-de-passe.spec.ts` : sur 200 tirages, longueur 12, au moins une majuscule / minuscule / chiffre, aucun caractère hors alphabet (`0`, `O`, `1`, `l`, `I` absents), tirages distincts.
- `auth.service.spec.ts` :
  - `createUser` : email déjà utilisé → `ConflictException` ; succès → `create` avec `doitChangerMdp: true` et un hash argon2 qui vérifie le `motDePasseInitial` renvoyé, `select` sans `motDePasse`, audit `(adminId, 'CREATE_USER', 'User', <id>)`.
  - `resetPassword` (adaptation) : signature `(adminId, userId)`, renvoie `{ motDePasseTemporaire }` qui vérifie le hash écrit ; autres assertions inchangées.

### E2E (`backend/test/auth.e2e-spec.ts`, base `cabinet_test`)

- Création par l'admin → 201, `user.doitChangerMdp === true`, `motDePasseInitial` de 12 caractères, pas de hash.
- Secrétaire → 403 (création).
- Scénario : création de `Nouveau.Medecin@Cabinet.ma` → login avec `nouveau.medecin@cabinet.ma` + `motDePasseInitial` → `user.doitChangerMdp === true` → `GET /patients` 403 `MUST_CHANGE_PASSWORD` → change-password → accès rétabli.
- Même email avec une autre casse → 409.
- `motDePasse` envoyé à la création → 400 ; téléphone `12345` → 400 ; sans téléphone → 201.
- Réinitialisation : le scénario existant utilise `motDePasseTemporaire` de la réponse ; un corps `{ nouveauMdp }` → 400.
- Change-password avec un nouveau mot de passe sans majuscule ou sans chiffre → 400.

### Frontend

Parcours navigateur Playwright :
- admin : erreurs de la modale (rôle non choisi, téléphone invalide, email déjà utilisé), création → écran « Compte créé » avec le mot de passe et « Copier », badge « Changement requis » ;
- première connexion du nouveau compte avec ce mot de passe → `/mon-compte` avec le nouveau bandeau ; mot de passe faible refusé ; changement → accès rétabli ;
- réinitialisation → confirmation → écran « Mot de passe réinitialisé » → connexion avec le mot de passe temporaire.

Puis `next build`, aucune nouvelle erreur `tsc` (4 erreurs déjà présentes), lint sans erreur.
