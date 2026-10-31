# Spec — Modification du mot de passe des utilisateurs

**Date :** 2026-10-31
**Statut :** approuvé

---

## Contexte

- `POST /api/auth/change-password` existe côté backend (ancien + nouveau mot de passe, min 8) mais **aucun écran frontend** ne l'utilise.
- Le changement ne révoque pas les sessions existantes (refresh tokens).
- Aucun moyen pour un admin de réinitialiser le mot de passe d'un utilisateur : un utilisateur qui oublie son mot de passe est bloqué (pas d'email de récupération).
- Aucun endpoint de liste des utilisateurs, aucune page d'administration des comptes.

## Objectif

1. **Self-service** : chaque utilisateur (ADMIN / MEDECIN / SECRETAIRE) change son propre mot de passe depuis une page « Mon compte ».
2. **Réinitialisation admin** : l'admin définit un mot de passe temporaire pour un autre utilisateur, qui **doit** le changer à sa prochaine connexion.

## Hors périmètre

- Création, modification de rôle, activation/désactivation de comptes depuis l'UI (feature séparée).
- Récupération de mot de passe par email.
- Règles de complexité au-delà de 8 caractères minimum.

---

## Backend

### Schéma Prisma

```prisma
model User {
  // ...
  doitChangerMdp Boolean @default(false)
}
```

Migration : `add_doit_changer_mdp`. Les comptes existants ont `false`.

### Application du changement forcé

- `JwtStrategy.validate` sélectionne aussi `doitChangerMdp` (renvoyé dans `req.user`).
- Nouveau décorateur `@AutoriseSiMdpAChanger()` (`common/decorators/autorise-si-mdp-a-changer.decorator.ts`) qui pose une métadonnée.
- `JwtAuthGuard` : après l'authentification passport, si `req.user.doitChangerMdp === true` et que la route (handler ou classe) ne porte pas la métadonnée, lève `ForbiddenException({ code: 'MUST_CHANGE_PASSWORD', message: 'Vous devez changer votre mot de passe' })`.
- Routes décorées : `GET /auth/me`, `POST /auth/change-password`, `POST /auth/logout`.
- Tous les contrôleurs utilisent déjà `JwtAuthGuard` → toute l'API est couverte sans modification par contrôleur.

### `POST /auth/change-password` (existant, enrichi)

Body inchangé : `{ ancienMdp, nouveauMdp }` (`nouveauMdp` min 8).

1. Utilisateur introuvable → 404.
2. `ancienMdp` incorrect → **400** `Ancien mot de passe incorrect` (et non 401 comme aujourd'hui : un 401 déclencherait le refresh/déconnexion de l'intercepteur axios).
3. `nouveauMdp === ancienMdp` → 400 `Le nouveau mot de passe doit être différent de l'ancien`.
4. Succès : hash argon2, `doitChangerMdp = false`, suppression de **tous** les refresh tokens de l'utilisateur, audit `CHANGE_PASSWORD` (entité `User`), puis génération et retour d'une nouvelle paire `{ accessToken, refreshToken }`.

### `GET /auth/users` (nouveau, `@Roles(ADMIN)`)

Retourne la liste des utilisateurs triée par nom puis prénom :
`id, nom, prenom, email, role, actif, doitChangerMdp, createdAt`. Jamais `motDePasse`.

### `POST /auth/users/:id/reset-password` (nouveau, `@Roles(ADMIN)`)

Body : `ResetPasswordDto { nouveauMdp }` (`@IsString() @MinLength(8)`). Pas de `ParseUUIDPipe` (les ids de test ne sont pas des UUID) : un id inconnu donne 404.

1. `:id` égal à l'id de l'admin connecté → 400 `Utilisez « Mon compte » pour changer votre propre mot de passe`.
2. Utilisateur introuvable → 404.
3. Succès : hash argon2, `doitChangerMdp = true`, suppression de tous ses refresh tokens, audit `RESET_PASSWORD` (userId = admin, entiteId = utilisateur cible). Réponse : `{ success: true }`.

### Limite connue

Un access token déjà émis reste valide jusqu'à 15 min après une réinitialisation (JWT stateless). Le flag étant relu en base à chaque requête par `JwtStrategy`, l'API est néanmoins bloquée immédiatement (403 `MUST_CHANGE_PASSWORD`).

---

## Frontend

### Store d'auth (`store/auth.ts`)

- `User` : ajout `doitChangerMdp?: boolean` (alimenté par la réponse de `/auth/login`).
- Nouvelles actions : `setTokens(token, refreshToken)`, `setDoitChangerMdp(value)`.

### Intercepteur axios (`lib/api.ts`)

- 403 avec `response.data.code === 'MUST_CHANGE_PASSWORD'` → `setDoitChangerMdp(true)` + redirection `/mon-compte`.

### Layout `(dashboard)`

- Si `user.doitChangerMdp` et `pathname !== '/mon-compte'` → `router.replace('/mon-compte')`.
- Sidebar : tant que le flag est actif, seul l'item « Mon compte » est affiché.

### Sidebar

- Nouvel item `{ href: '/mon-compte', icon: '🔑', label: 'Mon compte', roles: [tous] }`.
- Nouvel item `{ href: '/utilisateurs', icon: '👤', label: 'Utilisateurs', roles: ['ADMIN'] }`.
- Le bloc utilisateur en bas de la sidebar devient un lien vers `/mon-compte`.

### Page `/mon-compte` (tous rôles)

- Infos en lecture seule : prénom nom, email, rôle.
- Bandeau orange si `doitChangerMdp` : « Votre mot de passe a été réinitialisé par l'administrateur. Choisissez un nouveau mot de passe pour continuer. »
- Si changement forcé, le premier champ est libellé « Mot de passe temporaire (communiqué par l'administrateur) ».
- Formulaire React Hook Form + Zod : `ancienMdp`, `nouveauMdp` (min 8), `confirmation` (= `nouveauMdp`), `nouveauMdp !== ancienMdp`.
- Succès : `setTokens(...)`, `setDoitChangerMdp(false)`, toast « Mot de passe modifié », reset du formulaire ; si le changement était forcé → `router.replace('/dashboard')`.
- Erreur 400 `Ancien mot de passe incorrect` → message sous le champ « Ancien mot de passe incorrect ». Autres erreurs → toast avec le message API.

### Page `/utilisateurs` (ADMIN)

- Accès non-admin → redirection `/dashboard`.
- React Query `['users']` sur `GET /auth/users`.
- Tableau (même modèle que la page Stock : colonnes secondaires `hidden sm:table-cell`, email et rôle repliés sous le nom en mobile) : nom, email, rôle, actif/inactif, badge « Changement requis » si `doitChangerMdp`.
- Bouton « Réinitialiser le mot de passe » sur chaque ligne sauf celle de l'admin connecté → modale : `nouveauMdp` (min 8) + `confirmation` (Zod).
- Succès : fermeture de la modale, toast « Mot de passe réinitialisé. Communiquez-le à l'utilisateur : il devra le changer à sa prochaine connexion. », invalidation de `['users']`.

---

## Tests

### Unitaires (`backend/src/auth/auth.service.spec.ts`, Prisma mocké)

`changePassword` :
- ancien mot de passe incorrect → `BadRequestException`
- nouveau identique à l'ancien → `BadRequestException`
- succès → `doitChangerMdp: false` dans l'update, `refreshToken.deleteMany` appelé, tokens retournés

`resetPassword` :
- utilisateur inexistant → `NotFoundException`
- admin cible son propre compte → `BadRequestException`
- succès → `doitChangerMdp: true` dans l'update, `refreshToken.deleteMany` appelé

### E2E (`backend/test/auth.e2e-spec.ts`)

- `GET /auth/users` : admin → 200 sans `motDePasse` ; secrétaire → 403
- `POST /auth/users/:id/reset-password` : secrétaire → 403 ; `nouveauMdp` < 8 caractères → 400
- Scénario complet :
  1. admin réinitialise le mot de passe de la secrétaire
  2. login secrétaire avec le mot de passe temporaire → `user.doitChangerMdp === true`
  3. `GET /patients` → 403 `MUST_CHANGE_PASSWORD` ; `GET /auth/me` → 200
  4. `POST /auth/change-password` → nouveaux tokens
  5. `GET /patients` avec le nouveau token → 200
  6. refresh avec l'ancien refresh token → 401

### Frontend

Pas de tests automatisés (aucun existant). Vérification manuelle en local du parcours admin → reset → connexion secrétaire → redirection forcée → changement → accès rétabli, plus erreurs du formulaire. `next lint` et `tsc --noEmit` doivent passer.
