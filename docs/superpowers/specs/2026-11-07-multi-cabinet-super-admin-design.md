# Spec — Multi-cabinet, étape 2 : l'espace Super Admin

**Date :** 2026-11-07
**Statut :** design approuvé, spec à relire

---

## Contexte

L'étape 1 (`2026-11-07-multi-cabinet-socle-design.md`, en production depuis la PR #7) a rattaché toutes les données à un cabinet et isolé les cabinets entre eux. Le rôle `SUPER_ADMIN` existe, mais :

- aucun compte `SUPER_ADMIN` n'existe, et rien ne permet d'en créer ;
- le client filtré lui refuse tout accès (il n'a pas de cabinet), y compris `POST /auth/change-password` ;
- il n'existe aucun écran pour créer, consulter ou suspendre un cabinet ;
- `Cabinet.actif` existe mais n'a aucun effet ;
- le renouvellement de session (`POST /auth/refresh`) ne vérifie pas que le compte est actif ;
- le PDF d'ordonnance écrit « Casablanca » en dur ;
- le client filtré laisse passer le modèle `Cabinet` : n'importe quel service pourrait lister tous les cabinets.

## Décisions validées

| Sujet | Décision |
|-------|----------|
| Création du compte Super Admin | Commande lancée sur le serveur, mot de passe généré affiché une fois, changement forcé |
| Ce que voit le Super Admin | Page « Cabinets » et « Mon compte » ; aucune donnée patient, pas même leur nombre |
| Liste des cabinets | Nom, ville, téléphone, titulaire, nombre d'utilisateurs, état, date de création |
| Création d'un cabinet | Cabinet (nom, adresse, ville, téléphone) + titulaire (prénom, nom, email, téléphone facultatif), mot de passe généré |
| Modification des infos du cabinet | Super Admin seulement dans cette étape |
| Mot de passe du titulaire | Le Super Admin peut le réinitialiser |
| Suspension | Déconnexion à la prochaine action, connexion refusée avec un message, données conservées, réactivation immédiate |
| Suppression d'un cabinet | Impossible |
| Accès aux données | Module plateforme avec client non filtré limité aux cabinets, comptes, sessions et audit |

## Hors périmètre

- Changer de titulaire, ajouter ou retirer des comptes d'un cabinet depuis l'espace Super Admin, et modifier, désactiver ou supprimer un compte : étape 3.
- Page « Mon cabinet » pour le titulaire.
- Abonnements, facturation.
- Choix du médecin dans l'agenda.
- Sauvegarde automatique du serveur.

---

## Compte Super Admin

Script `backend/src/prisma/creer-super-admin.ts`, compilé par `nest build` en `dist/prisma/creer-super-admin.js`. Sur le serveur :

```bash
docker exec cabinet_backend node dist/prisma/creer-super-admin.js <email> <prénom> <nom>
```

- Arguments obligatoires. Email normalisé (`trim` + minuscules) et validé ; prénom et nom non vides. Sinon : message d'usage, code de sortie 1, rien n'est créé.
- Email déjà utilisé, quel que soit le rôle : message clair, code 1.
- Crée `role: SUPER_ADMIN`, `cabinetId: null`, `estTitulaire: false`, `doitChangerMdp: true`, avec un mot de passe produit par `genererMotDePasse()`.
- Affiche le mot de passe une seule fois, jamais journalisé ailleurs.
- Écrit l'audit `CREATE_SUPER_ADMIN` (`userId` nul, `entite` `User`, `entiteId` = nouveau compte, `cabinetId` nul).
- Le script vit dans `src/prisma/`, seul dossier où un `PrismaClient` peut être créé (garde-fou de l'étape 1).

## Accès des Super Admins

- `SuperAdminGuard` et le décorateur `@SuperAdminSeulement()` (`JwtAuthGuard` + `SuperAdminGuard`) : 403 `Accès réservé à l'administrateur de la plateforme` pour tout autre rôle.
- `POST /auth/change-password` : `changePassword` lit et modifie le compte de l'appelant (identifiant tiré du token) avec `PrismaSansFiltre`, pour fonctionner aussi sans cabinet. La révocation des sessions reste dans la même transaction.
- Le garde-fou de `prisma-sans-filtre.spec.ts` autorise dans `auth.service.ts` : `user.findUnique`, `user.update`, `refreshToken.deleteMany` et `$transaction`.

## Module plateforme

Dossier `backend/src/plateforme/` : `plateforme.module.ts`, `plateforme.controller.ts`, `plateforme.service.ts`, DTOs.

### Accès aux données

`PlateformeService` utilise `PrismaSansFiltre` (le Super Admin n'a pas de cabinet). Pour que ce service ne touche jamais aux données des patients, `prisma-sans-filtre.spec.ts` est complété :

- `plateforme/plateforme.service.ts` rejoint la liste des fichiers autorisés ;
- dans ce fichier, tout accès `prismaSansFiltre.<x>` (ou `tx.<x>` dans une transaction) doit avoir `<x>` parmi `cabinet`, `user`, `auditLog`, `refreshToken`, `$transaction` ;
- les `include` et `select` de ce fichier ne peuvent citer aucune relation vers un modèle patient (`patients`, `rendezVous`, `consultations`, `ordonnances`, `paiements`, `stockArticles`, `stockMouvements`, `documents`, `notifications`, `parametres`).

### Routes (toutes `@SuperAdminSeulement()`, préfixe `/plateforme/cabinets`)

| Route | Effet |
|-------|-------|
| `GET /` | Liste triée par nom |
| `POST /` | Crée le cabinet et son titulaire |
| `PATCH /:id` | Modifie nom, adresse, ville, téléphone |
| `PATCH /:id/statut` | `{ actif: boolean }` : suspend ou réactive |
| `POST /:id/titulaire/reset-password` | Nouveau mot de passe temporaire du titulaire |

`:id` n'est pas validé comme UUID : le premier cabinet a l'identifiant fixe `00000000-0000-0000-0000-000000000001`, que `IsUUID` refuse. Cabinet inconnu : 404.

### Liste

Chaque élément : `id`, `nom`, `adresse`, `ville`, `telephone`, `actif`, `createdAt`, `nbUtilisateurs` (comptes du cabinet, actifs ou non), `titulaire` (`{ id, prenom, nom, email }` ou `null`).

Le titulaire affiché est le compte `estTitulaire = true` le plus ancien (`createdAt`) ; c'est aussi lui que vise la réinitialisation.

### Création

`CreateCabinetDto` :

- `nom`, `adresse`, `ville` : chaînes non vides, nettoyées (`trim`) ;
- `telephone` : `^0[5-7][0-9]{8}$` ;
- `titulaire` (objet validé) : `email` (`@NormaliserEmail()`, `IsEmail`), `prenom`, `nom` non vides, `telephone?` au même format.

Dans une seule transaction : création du cabinet, puis du titulaire (`role: MEDECIN`, `estTitulaire: true`, `doitChangerMdp: true`, mot de passe généré). Email déjà utilisé : 409 `Email déjà utilisé` (contrôle préalable, et `P2002` converti en 409), rien n'est créé.

Réponse 201 : `{ cabinet, titulaire: { id, email, nom, prenom }, motDePasseInitial }`.

### Modification

`UpdateCabinetDto` : mêmes règles que les champs du cabinet, tous optionnels. Réponse : le cabinet.

### Suspension et réactivation

- `{ actif: false }` : dans une transaction, `Cabinet.actif = false` et suppression des refresh tokens de tous les comptes du cabinet.
- `{ actif: true }` : `Cabinet.actif = true`.
- Même état que l'actuel : sans effet, 200.

### Réinitialisation du mot de passe du titulaire

Comme `resetPassword` : nouveau mot de passe généré, `doitChangerMdp = true`, sessions du titulaire révoquées, dans une transaction. Pas de titulaire : 404 `Aucun titulaire pour ce cabinet`. Réponse : `{ motDePasseTemporaire }`.

### Audit

Écrit par `PlateformeService` via `prismaSansFiltre.auditLog`, avec `userId` = Super Admin et `cabinetId` nul : `CREATE_CABINET`, `UPDATE_CABINET`, `SUSPEND_CABINET`, `REACTIVATE_CABINET` (`entite` `Cabinet`) et `RESET_PASSWORD` (`entite` `User`). Jamais de mot de passe dans `details`.

---

## Suspension d'un cabinet : effets

Message unique, constante partagée : `Ce cabinet est suspendu. Contactez l'administrateur de la plateforme.`

- **Connexion** : `validateUser` charge aussi `cabinet.actif`. Mot de passe correct et cabinet suspendu : 403 `{ code: 'CABINET_SUSPENDU', message }`. Le mot de passe est vérifié d'abord, pour ne rien révéler à qui ne le connaît pas.
- **Requêtes** : `JwtStrategy` lit `cabinet.actif` ; cabinet suspendu : 401 avec le message. L'intercepteur tente un renouvellement, qui échoue, puis renvoie à `/login`.
- **Renouvellement** (`POST /auth/refresh`) : refusé (401, token supprimé) si le compte est inactif ou si son cabinet est suspendu.
- Un `SUPER_ADMIN` n'a pas de cabinet : ces contrôles ne le concernent pas.

## Le modèle Cabinet et le client filtré

- Le client filtré refuse toute opération directe sur `Cabinet` (même erreur explicite que le SQL brut). Un service de cabinet ne peut donc pas lister les cabinets.
- Les relations restent permises : une ligne déjà filtrée peut inclure son propre cabinet.
- **Ordonnance** : la génération du PDF charge `cabinet: { select: { ville: true } }` avec l'ordonnance et écrit `<ville>, le <date>` au lieu de `Casablanca, le <date>`.

---

## Frontend

- Store : `role` accepte déjà `SUPER_ADMIN`.
- **Connexion** : un `SUPER_ADMIN` est envoyé vers `/cabinets`, les autres vers `/dashboard`. Le message `CABINET_SUSPENDU` s'affiche tel quel (la page affiche déjà `message`).
- **Layout `(dashboard)`** : un `SUPER_ADMIN` sur une autre page que `/cabinets` ou `/mon-compte` est redirigé vers `/cabinets`. Le changement de mot de passe forcé garde la priorité.
- **Menu** : nouvelle entrée « Cabinets » (`/cabinets`) pour `SUPER_ADMIN` ; « Mon compte » ouvert aussi à `SUPER_ADMIN` ; aucune autre entrée pour lui.
- **Page `/cabinets`** (`SUPER_ADMIN` seulement, sinon redirection vers `/dashboard`) : en-tête « Cabinets » et bouton « + Nouveau cabinet » ; tableau avec les colonnes de la liste, l'état en badge (« Actif » vert, « Suspendu » gris) ; actions « Modifier », « Suspendre » ou « Réactiver », « Réinitialiser le titulaire ». Sur mobile, les colonnes secondaires sont masquées comme sur `/utilisateurs`.
- **Composants** (`frontend/src/components/cabinets/`) :
  - `CreateCabinetModal` : deux blocs (« Cabinet », « Titulaire »), React Hook Form + Zod avec les règles du backend, 409 affiché sous l'email du titulaire ; succès : `MotDePasseGenere` avec le titre « Cabinet créé ».
  - `EditCabinetModal` : nom, adresse, ville, téléphone.
  - `StatutCabinetModal` : confirmation. Suspension : « Suspendre <nom> ? Ses utilisateurs seront déconnectés et ne pourront plus se connecter. Les données sont conservées. » Réactivation : « Réactiver <nom> ? Ses utilisateurs pourront de nouveau se connecter. »
  - `ResetTitulaireModal` : confirmation, puis `MotDePasseGenere` avec le titre « Mot de passe réinitialisé ».
- `MotDePasseGenere` est réutilisé depuis `components/utilisateurs/`.
- Toute mutation réussie invalide la requête `['cabinets']`.

---

## Tests

### Unitaires

- Guard Super Admin : 403 pour `MEDECIN`, titulaire, `SECRETAIRE`.
- Client filtré : opération directe sur `Cabinet` refusée.
- `prisma-sans-filtre.spec.ts` : garde-fous du service plateforme, vérifiés par mutation.
- Script de création : arguments manquants ou email invalide refusés, email existant refusé.

### E2E (base `cabinet_test`)

Nouveau fichier `backend/test/plateforme.e2e-spec.ts` :

- un `SUPER_ADMIN` crée un cabinet : 201, mot de passe de 12 caractères, titulaire `MEDECIN` + `estTitulaire` + `doitChangerMdp`, rattaché au nouveau cabinet ; le titulaire se connecte, change son mot de passe et voit son cabinet vide ;
- email du titulaire déjà utilisé : 409, aucun cabinet créé ;
- données invalides (téléphone, champs vides, champ inconnu) : 400 ;
- liste : bons titulaire et nombre d'utilisateurs, aucun champ patient ;
- modification : 200, puis valeurs visibles dans la liste ; cabinet inconnu : 404 ;
- réinitialisation du titulaire : nouveau mot de passe valable, ancien refusé, sessions du titulaire révoquées ; cabinet sans titulaire : 404 ;
- suspension : connexion refusée avec `CABINET_SUSPENDU`, session ouverte refusée (401), renouvellement refusé ; autre cabinet non affecté ; réactivation : connexion de nouveau possible ;
- `MEDECIN`, titulaire, `SECRETAIRE` : 403 sur chaque route plateforme ;
- `SUPER_ADMIN` : toujours 403 sur `/patients` et `/rapports/dashboard` ; peut changer son mot de passe ;
- audit : une ligne par action, `cabinetId` nul, sans mot de passe ;
- PDF d'ordonnance : contient la ville du cabinet ;
- renouvellement refusé pour un compte désactivé.

### Navigateur (Playwright)

Création d'un Super Admin par le script, première connexion et changement de mot de passe, arrivée sur « Cabinets », création d'un cabinet, connexion de son titulaire, modification, suspension (le titulaire connecté est déconnecté et voit le message à la reconnexion), réactivation, réinitialisation, et redirection du Super Admin s'il tape une autre adresse.

Puis `next build`, aucune nouvelle erreur `tsc` (4 erreurs connues), lint sans erreur.

---

## Mise en production

- Aucune migration de base.
- Merger sur `master` déclenche le déploiement : le merge exige l'accord de l'utilisateur.
- Après le déploiement, l'utilisateur crée son compte Super Admin avec la commande `docker exec cabinet_backend node dist/prisma/creer-super-admin.js …` sur le serveur, puis se connecte et change le mot de passe.
- `CLAUDE.md` est mis à jour : espace Super Admin, commande de création, règle du module plateforme, refus du modèle `Cabinet` sur le client filtré.
