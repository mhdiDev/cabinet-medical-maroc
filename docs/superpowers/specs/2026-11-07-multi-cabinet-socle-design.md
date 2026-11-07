# Spec — Multi-cabinet, étape 1 : le socle

**Date :** 2026-11-07
**Statut :** design approuvé, spec à relire

---

## Contexte

L'application gère un seul cabinet : aucune donnée n'est rattachée à un cabinet. L'objectif du chantier multi-cabinet est d'héberger plusieurs cabinets indépendants, chaque médecin ne voyant que les données du sien.

Le chantier compte trois étapes, chacune avec sa spec, son plan et sa PR :

1. **Le socle (cette spec) :** les cabinets, le rangement des données existantes, l'isolation, les documents privés.
2. **L'espace Super Admin :** compte `SUPER_ADMIN`, création, consultation et suspension des cabinets.
3. **La gestion de l'équipe :** modifier, désactiver, supprimer un compte.

## Décisions validées

| Sujet | Décision |
|-------|----------|
| Rôle au-dessus des cabinets | `SUPER_ADMIN`, sans accès aux données patients |
| Rôle `ADMIN` | Supprimé : il devient `MEDECIN` avec `estTitulaire = true` |
| Médecins par cabinet | Plusieurs possibles, dont un titulaire |
| Compte et cabinet | Un compte appartient à un seul cabinet |
| Accès à l'application | Une seule adresse ; l'email identifie le cabinet |
| Suspension d'un cabinet | Possible, données conservées (appliquée à l'étape 2) |
| Données existantes | Rangées dans un premier cabinet |
| Protection | Centrale, dans le backend, avec refus par défaut |

## Objectif

Après cette étape :

1. Toute donnée métier appartient à un cabinet.
2. Un utilisateur ne peut lire, modifier, supprimer ou référencer que les données de son cabinet.
3. Un accès sans cabinet connu est refusé, y compris pour un `SUPER_ADMIN`.
4. Les documents patients ne sont accessibles qu'à un utilisateur connecté du bon cabinet.
5. L'application fonctionne comme aujourd'hui pour le cabinet existant.

## Hors périmètre

- Compte `SUPER_ADMIN`, écrans de la plateforme, création de cabinets, blocage des cabinets suspendus, ville de l'ordonnance tirée du cabinet : étape 2. Le rôle existe dans l'enum, mais aucun compte n'est créé ici.
- Modifier, désactiver, supprimer un compte, et changer de titulaire : étape 3.
- Rôle infirmière et données sensibles : chantier séparé.
- Abonnements et paiement en ligne.
- Restreindre par rôle les routes aujourd'hui ouvertes (consultations et documents pour la secrétaire, caisse et stock pour les médecins) : les droits restent ceux d'aujourd'hui.

---

## Données

### Modèle `Cabinet` (table `cabinets`)

| Champ | Type |
|-------|------|
| `id` | `String` uuid |
| `nom` | `String` |
| `adresse` | `String` |
| `ville` | `String` |
| `telephone` | `String` |
| `actif` | `Boolean`, défaut `true` |
| `createdAt`, `updatedAt` | `DateTime` |

### `User`

- `cabinetId String?` : nul uniquement pour `SUPER_ADMIN`. Contrainte SQL `CHECK` : `(role = 'SUPER_ADMIN') = (cabinetId IS NULL)`.
- `estTitulaire Boolean @default(false)`.
- `email` reste unique sur toute la plateforme.

Enum `Role` : `SUPER_ADMIN`, `MEDECIN`, `SECRETAIRE`.

### `cabinetId` obligatoire et indexé

`Patient`, `RendezVous`, `Consultation`, `Ordonnance`, `Paiement`, `StockArticle`, `StockMouvement`, `Document`, `Notification`, `Parametre`.

`AuditLog.cabinetId` est optionnel : les actions de la plateforme de l'étape 2 n'ont pas de cabinet.

### Sans `cabinetId`

- `Medicament` : référentiel partagé. Aucun cloisonnement, y compris pour un médicament ajouté par un cabinet.
- `OrdonnanceMedicament` : atteint uniquement à travers son `Ordonnance`.
- `RefreshToken` : lié à un utilisateur.

### Contraintes d'unicité modifiées

- `StockArticle` : `@@unique([cabinetId, reference])` remplace l'unicité de `reference`.
- `Parametre` : `@@unique([cabinetId, cle])` remplace l'unicité de `cle`.

---

## Migration

Une seule migration Prisma, dans cet ordre :

1. Créer `cabinets` et y insérer le premier cabinet, avec un identifiant fixe écrit dans la migration : nom `Cabinet de démonstration`, ville `Casablanca`, adresse et téléphone `À renseigner`.
2. Ajouter `cabinetId` en nullable sur chaque table, le renseigner avec cet identifiant (`users` et `audit_logs` compris), puis passer en `NOT NULL` sauf `users` et `audit_logs`.
3. Ajouter `estTitulaire`. Passer les utilisateurs `ADMIN` à `MEDECIN` avec `estTitulaire = true`.
4. Remplacer l'enum `Role` (nouveau type, conversion de la colonne, défaut `SECRETAIRE` conservé).
5. Ajouter clés étrangères, index, contraintes d'unicité composées et contrainte `CHECK`.

La migration s'exécute au démarrage du backend, suivie du seed.

### Seed

Le seed s'exécute à chaque démarrage de la production : il doit rester idempotent.

- Il crée le cabinet de démonstration s'il n'existe pas, avec le même identifiant fixe.
- `admin@cabinet.ma` devient `MEDECIN` titulaire. Son nom et son prénom ne changent pas en base.
- Toutes les données de démonstration reçoivent ce `cabinetId`.
- Les upserts sur `reference` et `cle` utilisent les clés composées.

---

## Isolation

### Contexte de requête

- Un middleware global ouvre un contexte `AsyncLocalStorage` pour chaque requête.
- `JwtAuthGuard`, une fois l'utilisateur authentifié, y écrit son `cabinetId`. `JwtStrategy` relit déjà l'utilisateur en base à chaque requête : le `cabinetId` vient de la base, jamais du token ni de la requête du client.
- Aucun DTO n'accepte de `cabinetId`.

### Client filtré

`PrismaService` fournit un client Prisma avec une extension (`$extends`, `query.$allModels.$allOperations`) qui s'applique aux modèles cloisonnés : ceux de la liste ci-dessus, `AuditLog` et `User`.

| Opération | Effet |
|-----------|-------|
| `findMany`, `findFirst`, `findUnique` et variantes `OrThrow`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany` | `cabinetId` ajouté au `where` |
| `update`, `delete` | `cabinetId` ajouté au `where` (`where` unique étendu de Prisma 5) |
| `create` | `cabinetId` ajouté à `data` |
| `createMany` | `cabinetId` ajouté à chaque ligne |
| `upsert` | `cabinetId` ajouté au `where` et à `create` |

**Refus par défaut :** sur un modèle cloisonné, si le contexte n'a pas de `cabinetId`, l'extension lève une exception. Le filtre n'est jamais simplement omis. Cette règle couvre le `SUPER_ADMIN`, dont le `cabinetId` est nul, et le code exécuté hors requête. Une exception non prévue devient une erreur 500 : c'est préférable à une fuite.

Les écritures imbriquées et les `include` ne passent pas par cette extension. Elles restent autorisées dans la mesure où elles suivent les relations d'une ligne déjà filtrée. Une écriture imbriquée vers un modèle cloisonné doit renseigner elle-même son `cabinetId` ; aucune n'existe aujourd'hui.

### Client non filtré

`PrismaSansFiltre`, service distinct au nom explicite, réservé à :

- la connexion et la recherche de l'utilisateur par email (`validateUser`) ;
- `JwtStrategy` ;
- le rafraîchissement et la révocation des tokens ;
- le contrôle d'unicité de l'email à la création d'un compte ;
- l'écriture de l'audit quand le contexte de requête n'a pas de cabinet (connexion) : `AuditService` reçoit alors le `cabinetId` en paramètre ;
- les helpers de tests.

Toute autre utilisation doit être justifiée en revue. Un test vérifie que ce service n'est injecté que dans les fichiers autorisés.

### Références croisées

Le filtre ne protège pas une écriture qui cite l'identifiant d'une donnée d'un autre cabinet. Avant toute création ou modification, le service vérifie via le client filtré chaque référence reçue :

| Donnée écrite | Références vérifiées |
|---------------|----------------------|
| `RendezVous` | `patientId`, `medecinId` (médecin actif du cabinet) |
| `Consultation` | `patientId`, `rendezVousId` |
| `Ordonnance` | `patientId`, `consultationId` |
| `Paiement` | `patientId`, `rendezVousId`, `consultationId` |
| `Document` | `patientId`, `consultationId` |
| `StockMouvement` | `articleId`, `consultationId` |

Une référence étrangère au cabinet donne le même résultat qu'une référence inexistante : 404.

### Réponses

Une ressource d'un autre cabinet répond **404**, comme une ressource inexistante, jamais 403.

---

## Rôles et droits

- `@Roles(Role.ADMIN, Role.MEDECIN)` devient `@Roles(Role.MEDECIN)`.
- Nouveau décorateur `@TitulaireSeulement()` et son contrôle (403 `Accès réservé au médecin titulaire`) pour remplacer `@Roles(Role.ADMIN)` sur `GET /auth/users`, `POST /auth/users` et `POST /auth/users/:id/reset-password`.
- `POST /auth/users` : rôle limité à `MEDECIN` ou `SECRETAIRE` (`SUPER_ADMIN` refusé avec 400). Le compte rejoint le cabinet du titulaire, avec `estTitulaire = false`.
- `GET /auth/users` ne liste que le cabinet. Réinitialiser le mot de passe d'un compte d'un autre cabinet : 404.
- `notifySecretaires` ne prévient que les secrétaires du cabinet, par le filtre sur `User`.
- `login` et `GET /auth/me` renvoient aussi `cabinetId` et `estTitulaire`.

---

## Documents

### Backend

- Nouvelle route `GET /documents/:id/fichier` (`JwtAuthGuard`) : charge le document via le client filtré, lit l'objet dans MinIO et le renvoie en flux, avec le type de contenu et `Content-Disposition: inline`. Un document d'un autre cabinet : 404.
- Les nouveaux fichiers sont rangés sous `cabinets/<cabinetId>/patients/<patientId>/`. Les fichiers existants restent à leur emplacement.
- `Document.url` reste stocké, mais n'est plus renvoyé au frontend : les réponses de l'API ne l'exposent plus.

### Accès public retiré

- `docker-compose.yml` : le conteneur d'initialisation MinIO supprime la politique du bucket (`delete-bucket-policy`) au lieu de l'appliquer, et ne monte plus le fichier. La commande ne doit pas échouer si aucune politique n'existe.
- `minio/public-read-policy.json` est supprimé.
- `nginx/cabinet.conf` : le bloc `/files/` est retiré du dépôt. Ce fichier n'est pas déployé automatiquement : sur le serveur, ce bloc reste en place mais MinIO répond 403. Le retirer du serveur est une action manuelle, facultative.
- Les anciens liens `/files/…` cessent de fonctionner.

### Frontend

Dans le dossier patient, « Ouvrir » appelle la route avec le token, crée une URL temporaire à partir du fichier reçu et l'ouvre dans un nouvel onglet. Un simple lien ne peut pas envoyer le token. En cas d'erreur : toast `Impossible d'ouvrir le document`. L'onglet est ouvert avant l'appel réseau pour ne pas être bloqué par le navigateur.

---

## Frontend

- Types `Role` et store `auth` : `SUPER_ADMIN | MEDECIN | SECRETAIRE`, plus `cabinetId` et `estTitulaire`.
- `Sidebar` : une entrée peut être réservée au titulaire. `Utilisateurs` : titulaire seul. `Caisse` et `Stock` : titulaire et secrétaire. Les autres entrées restent celles de `MEDECIN` et `SECRETAIRE`.
- `NotificationBell` : secrétaire et titulaire, comme aujourd'hui pour secrétaire et admin.
- Page `/utilisateurs` : réservée au titulaire, mention « Titulaire » à côté du rôle.
- `CreateUserModal` : choix du rôle limité à `MEDECIN` et `SECRETAIRE`.
- Session déjà ouverte au moment du déploiement : le store local contient encore `role: 'ADMIN'`. Le layout `(dashboard)` appelle `GET /auth/me` à l'ouverture et met le store à jour.
- Un utilisateur `SUPER_ADMIN` n'existe pas encore dans cette étape : aucun écran dédié.

---

## Tests

### Unitaires

- Extension Prisma : ajout du `cabinetId` pour chaque opération du tableau ; exception sans contexte ; modèles non cloisonnés (`Medicament`) non modifiés.
- `AuthService`, `RendezVousService` et autres services dont le comportement change.

### E2E (base `cabinet_test`)

Nouveau fichier `backend/test/isolation.e2e-spec.ts`, avec deux cabinets A et B, chacun avec un titulaire, une secrétaire et des données de chaque type. Connecté sur A :

- la liste, le détail, la modification et la suppression d'une donnée de B répondent 404 ou n'affichent rien, pour chaque type de donnée ;
- les exports, le dashboard, les rapports, la caisse et les alertes de stock ne contiennent rien de B ;
- chaque référence croisée du tableau répond 404 ;
- la même référence de stock existe dans A et dans B ;
- `GET /auth/users` n'affiche que A, et réinitialiser un compte de B répond 404 ;
- une notification de fin de consultation ne prévient pas les secrétaires de B ;
- un `cabinetId` envoyé dans une requête répond 400 ;
- un `SUPER_ADMIN` créé par le test n'obtient aucune donnée patient.

Documents : sans token 401, depuis B 404, depuis A 200 avec le bon contenu.

Droits : un médecin non titulaire reçoit 403 sur la gestion des comptes, le titulaire y accède.

Les tests existants sont adaptés au nouveau rôle et restent tous verts.

### Migration

Sur une copie de la base locale de développement : la migration passe, aucune ligne n'a de `cabinetId` nul (hors exceptions prévues), l'ancien `ADMIN` est titulaire, le nombre de lignes de chaque table ne change pas, et le seed relancé deux fois ne crée rien de plus.

### Navigateur (Playwright)

Connexion du titulaire, entrées du menu, création d'un compte, ouverture d'un document, connexion d'une secrétaire, session ouverte avant la migration.

Puis `next build`, aucune nouvelle erreur `tsc` (4 erreurs déjà présentes), lint sans erreur.

---

## Mise en production

- Merger sur `master` déclenche le déploiement : le merge exige l'accord de l'utilisateur.
- Avant le merge, l'utilisateur lance une sauvegarde de la production (`scripts/backup.sh`) : la migration est difficile à annuler.
- Après le déploiement, vérifier : connexion du titulaire, liste des patients, ouverture d'un document, et un ancien lien `/files/…` qui ne répond plus.
- `CLAUDE.md` est mis à jour : rôles, isolation, règle du client non filtré, documents privés.
