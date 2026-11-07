# Multi-cabinet, étape 3 : gestion de l'équipe

Date : 2026-11-08. Branche : `feat/multi-cabinet-equipe`.
Étapes précédentes en production : socle (PR #7) et espace Super Admin (PR #8).

## Objectif

Le médecin titulaire gère les comptes de son cabinet depuis la page « Utilisateurs » :
- **modifier** un compte : nom, prénom, téléphone, email ;
- **désactiver / réactiver** un compte.

Hors périmètre : changer le rôle, transmettre le titulariat, supprimer définitivement un compte, choisir le médecin dans l'agenda.

## Règles fonctionnelles

### Modifier
- Champs : `nom`, `prenom`, `telephone`, `email`. Tous facultatifs dans la requête, au moins un requis (sinon 400 « Aucune modification »).
- Mêmes validations qu'à la création (`CreateUserDto`) : nom et prénom non vides après trim, téléphone marocain `^0[5-7][0-9]{8}$`, email valide et normalisé (`@NormaliserEmail()`).
- `null` refusé (400) sur `nom`, `prenom`, `email`. Pour `telephone`, `null` ou `''` efface le numéro (le champ est facultatif en base).
- Email unique sur toute la plateforme : un email déjà pris répond 409 « Email déjà utilisé ». Le contrôle repose sur la contrainte d'unicité (`P2002`), sans accès sans filtre : `PrismaSansFiltre` n'est pas élargi.
- Si l'email change réellement, les refresh tokens de la personne sont supprimés dans la même transaction que la mise à jour. Le mot de passe ne change pas.
- Le titulaire peut modifier son propre compte, sauf son email (400 « Vous ne pouvez pas modifier votre propre email »).
- Réponse : le compte modifié, avec les mêmes champs que la liste.

### Désactiver / réactiver
- `PATCH /auth/users/:id/statut` avec `{ actif: boolean }` (booléen strict, comme `StatutCabinetDto`).
- Désactiver : `actif = false` et suppression des refresh tokens, dans une transaction. La session ouverte est coupée par `JwtStrategy` (qui refuse déjà un compte inactif) et le renouvellement est refusé.
- Réactiver : `actif = true`. Le mot de passe ne change pas.
- Le titulaire ne peut pas changer son propre statut (400 « Vous ne pouvez pas désactiver votre propre compte »).
- Demander l'état déjà en place répond 200 sans écrire d'audit.
- Les données de la personne restent (consultations, ordonnances, rendez-vous, paiements) et restent visibles par le cabinet.

### Réinitialisation du mot de passe
- `POST /auth/users/:id/reset-password` sur un compte désactivé répond désormais 409 « Le compte est désactivé : réactivez-le avant de réinitialiser son mot de passe. », sans rien modifier (même règle que la plateforme).

### Communs
- Routes protégées par `@TitulaireSeulement()`.
- Un compte d'un autre cabinet, ou inexistant, répond 404 (le client filtré le rend invisible).
- Audit : `UPDATE_USER` (détails : noms des champs modifiés, et nouvel email s'il change), `DEACTIVATE_USER`, `REACTIVATE_USER`. Aucun mot de passe.

## Liste des comptes

`GET /auth/users` ajoute :
- `telephone` ;
- `rdvAVenir` : nombre de rendez-vous du compte dont `dateHeure >= maintenant` et `statut != ANNULE` (compte de relation filtré Prisma `_count`). Vaut 0 pour une secrétaire.

## Interface (page « Utilisateurs »)

- Par compte : boutons « Modifier » et « Désactiver » / « Réactiver », à côté de « Réinitialiser ». Sur la ligne du titulaire connecté : seulement « Modifier ».
- Compte désactivé : badge « Désactivé », ligne grisée ; le bouton « Réinitialiser » est masqué.
- Modale « Modifier » : pré-remplie, validations Zod identiques au backend, erreur 409 affichée sous l'email, champ email désactivé pour son propre compte. N'envoie que les champs modifiés ; si rien n'a changé, la modale se ferme sans appel.
- Modale de statut : confirmation ; pour la désactivation d'un compte qui a des rendez-vous à venir, avertissement « N rendez-vous à venir restent dans l'agenda ».
- Modales accessibles comme celles de la page « Cabinets » (hook `useModale`, `role="dialog"`, Échap, focus).
- Après succès : toast, invalidation de la requête `['users']`.

## Technique

- `backend/src/auth/dto/update-user.dto.ts` (`UpdateUserDto`, écrit à la main avec `@ValidateIf` comme `UpdateCabinetDto`) et `statut-user.dto.ts`.
- `AuthService.modifierUser(titulaireId, id, dto)` et `AuthService.changerStatutUser(titulaireId, id, actif)` utilisent le client filtré `this.prisma`.
- `auth.controller.ts` : `PATCH users/:id` et `PATCH users/:id/statut`, `@TitulaireSeulement()`, `ParseUUIDPipe` comme les routes existantes si elles l'utilisent.
- Le garde-fou `prisma-sans-filtre.spec.ts` ne change pas : les nouvelles méthodes ne doivent pas utiliser `prismaSansFiltre`.
- Frontend : `components/utilisateurs/EditUserModal.tsx`, `StatutUserModal.tsx`, types mis à jour.

## Tests

- E2E (`test/auth.e2e-spec.ts` ou nouveau `test/equipe.e2e-spec.ts`) :
  - modification de chaque champ, `{}` → 400, `null` → 400, téléphone effacé, email invalide → 400, email pris → 409, email normalisé ;
  - changement d'email : ancien refresh token refusé, connexion avec le nouvel email et l'ancien mot de passe ;
  - titulaire : modification de son nom OK, de son email → 400, de son statut → 400 ;
  - désactivation : connexion refusée, token d'accès en cours → 401, refresh refusé ; réactivation : connexion OK ;
  - reset d'un compte désactivé → 409 ;
  - médecin non titulaire et secrétaire → 403 ; compte d'un autre cabinet → 404 ;
  - `rdvAVenir` compte les rendez-vous futurs non annulés seulement ;
  - audit écrit avec les bonnes actions, sans mot de passe.
- Unitaires si utiles (service).
- Parcours Playwright sur la base locale, nettoyé ensuite.
