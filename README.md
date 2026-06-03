# Cabinet Médical Maroc — Système de Gestion

Application web complète pour la gestion d'un cabinet médical au Maroc. Inspirée de Doctolib, adaptée aux besoins locaux marocains (CIN, formats téléphone, fuseau Africa/Casablanca).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Backend | NestJS + TypeScript |
| Base de données | PostgreSQL 16 + Prisma ORM |
| Authentification | JWT + Refresh Tokens + RBAC |
| Stockage fichiers | MinIO (S3-compatible) |
| PDF | PDFKit |
| Tests | Jest + Testing Library |
| API Docs | Swagger/OpenAPI |
| Emails (dev) | MailHog |
| Containerisation | Docker + Docker Compose |

## Fonctionnalités

- **Patients** — CRUD complet, dossier médical (5 onglets), statut assuré/non assuré (`estAssure`), export CSV, recherche par CIN/nom/téléphone
- **Agenda** — Vue calendrier (jour/semaine/mois), gestion des créneaux, détection de collisions, workflow statuts
- **Consultations** — Sélecteur patient intégré avec recherche, notes médicales structurées, actes, diagnostic, traitement, liste paginée ; à la création, redirige automatiquement vers la caisse pour encaisser
- **Ordonnances** — Autocomplete sur le référentiel CNOPS (5 918 médicaments), génération PDF, historique
- **Médicaments** — Référentiel CNOPS 2014 importé (nom, DCI, dosage, forme, PPV, taux remboursement CNOPS, générique/princeps), création à la volée si absent
- **Caisse** — Encaissements liés à une consultation, pré-remplissage automatique depuis la consultation (montant, motif, patient), rapport journalier et périodique
- **Export Excel** — Export mensuel des consultations/paiements filtré par statut d'assurance (tous / assurés / non assurés)
- **Stock** — Articles consommables, entrées/sorties transactionnelles, alertes de seuil
- **Sécurité** — Argon2, RBAC (médecin/secrétaire/admin), audit trail complet

---

## Prérequis

- **Docker + Docker Compose v2**
- **Node.js 20** (obligatoire — les versions inférieures ne sont pas supportées)
- **nvm** recommandé pour gérer les versions Node

> Si tu as plusieurs versions Node via nvm, exécute `nvm use 20` avant de lancer le frontend ou le backend.
> Un fichier `.nvmrc` est présent à la racine du projet : `nvm use` suffit dans le répertoire.

---

## Démarrage rapide — Mode développement (recommandé)

C'est la méthode la plus pratique : l'infra tourne dans Docker, backend et frontend en local avec rechargement automatique.

### 1. Infrastructure (PostgreSQL, MinIO, MailHog)

```bash
cd cabinet-medical-maroc
docker compose -f docker-compose.dev.yml up -d
```

### 2. Backend

```bash
nvm use 20
cd backend
cp .env.example .env

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

Le backend est accessible sur :
- API : http://localhost:3001
- Swagger : http://localhost:3001/api/docs

### 3. Importer le référentiel médicaments CNOPS

À effectuer une seule fois après la migration initiale (le script est idempotent, on peut le relancer sans risque).

```bash
# Depuis le répertoire backend/
npm run prisma:import-medicaments
```

Le fichier source attendu : `backend/prisma/ref-des-medicaments-cnops-2014.xlsx`

La progression s'affiche dans le terminal (lots de 100, rapport final créés/mis à jour/erreurs).

### 4. Frontend

```bash
nvm use 20
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Le frontend est accessible sur http://localhost:3000.

---

## Démarrage rapide — Tout Docker (sans Node local)

```bash
cd cabinet-medical-maroc
cp backend/.env.example backend/.env
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
docker compose exec backend npm run prisma:import-medicaments
```

URLs disponibles :
- Frontend : http://localhost:3000
- Swagger : http://localhost:3001/api/docs
- MailHog : http://localhost:8025
- MinIO console : http://localhost:9001

---

## Comptes de démo

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@cabinet.ma | Admin123! |
| Médecin | dr.benali@cabinet.ma | Medecin123! |
| Secrétaire | secretaire@cabinet.ma | Secretaire123! |

---

## Référentiel médicaments CNOPS

Le fichier `backend/prisma/ref-des-medicaments-cnops-2014.xlsx` contient la liste officielle des médicaments agréés au Maroc (source CNOPS 2014).

### Structure des données importées

| Colonne Excel | Champ DB | Description |
|---------------|----------|-------------|
| `CODE` | `code` | Code-barres unique (identifiant upsert) |
| `NOM` | `nom` | Nom commercial |
| `DCI1` | `denomination` | Dénomination Commune Internationale |
| `DOSAGE1` + `UNITE_DOSAGE1` | `dosage` | Ex : `500 MG`, `200 ML` |
| `FORME` | `forme` | COMPRIME, SOLUTION, GELULE… |
| `PRESENTATION` | `presentation` | Conditionnement complet |
| `PPV` | `ppv` | Prix Public de Vente (MAD) |
| `PRINCEPS_GENERIQUE` | `princepsGenerique` | `P` = princeps / `G` = générique |
| `TAUX_REMBOURSEMENT` | `tauxRemboursement` | `0%`, `70%`, `100%` |

### Relancer l'import

Le script utilise un `upsert` par code-barres : relancer n'introduit pas de doublons.

```bash
cd backend
npm run prisma:import-medicaments
```

### Mettre à jour le référentiel

Remplacer le fichier `.xlsx` par une version plus récente (même format de colonnes) et relancer le script.

---

## Variables d'environnement

### Backend (`backend/.env`)

Copier depuis `backend/.env.example`. Les valeurs par défaut fonctionnent en développement.

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://postgres:password@localhost:5432/cabinet_medical` |
| `JWT_SECRET` | Clé secrète JWT | — (obligatoire) |
| `JWT_REFRESH_SECRET` | Clé refresh token | — (obligatoire) |
| `JWT_EXPIRES_IN` | Expiration access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Expiration refresh | `7d` |
| `PORT` | Port backend | `3001` |
| `CORS_ORIGIN` | Origine autorisée | `http://localhost:3000` |
| `MINIO_ENDPOINT` | Hôte MinIO | `localhost` |
| `MINIO_ACCESS_KEY` | Clé accès MinIO | `minioadmin` |
| `MINIO_SECRET_KEY` | Secret MinIO | `minioadmin` |
| `MINIO_BUCKET` | Bucket fichiers | `cabinet-medical` |
| `SMTP_HOST` | Serveur SMTP (MailHog en dev) | `localhost` |

### Frontend (`frontend/.env.local`)

Copier depuis `frontend/.env.local.example`.

| Variable | Description | Défaut |
|----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | URL de l'API backend | `http://localhost:3001/api` |

---

## Architecture API

### Authentification
```
POST   /api/auth/login              Connexion
POST   /api/auth/refresh            Rafraîchir token
POST   /api/auth/logout             Déconnexion
GET    /api/auth/me                 Profil connecté
POST   /api/auth/users              Créer utilisateur (admin)
POST   /api/auth/change-password    Changer le mot de passe
```

### Patients
```
POST   /api/patients                Créer patient
GET    /api/patients?q=&page=&limit= Lister/rechercher (nom, CIN, téléphone)
GET    /api/patients/:id            Fiche patient complète (avec RDV, consultations, ordonnances)
PATCH  /api/patients/:id            Modifier patient
DELETE /api/patients/:id            Supprimer (soft delete)
GET    /api/patients/cin/:cin       Recherche par CIN
GET    /api/patients/export/csv     Export CSV (UTF-8 BOM pour Excel)
GET    /api/patients/stats          Statistiques (total, par sexe, par ville)
```

### Rendez-vous
```
POST   /api/rendez-vous             Créer RDV (vérifie les collisions)
GET    /api/rendez-vous/agenda      Agenda médecin sur une période
GET    /api/rendez-vous/today       RDV du jour par médecin
PATCH  /api/rendez-vous/:id         Modifier RDV
PATCH  /api/rendez-vous/:id/statut  Changer statut (EN_ATTENTE → CONFIRME → ARRIVE → FACTURE)
DELETE /api/rendez-vous/:id         Annuler (passe le statut à ANNULE)
```

### Consultations
```
POST   /api/consultations                        Créer consultation
GET    /api/consultations?q=&page=&limit=&date=  Lister/rechercher (patient, motif, diagnostic) — date filtre par jour
GET    /api/consultations/patient/:id            Consultations d'un patient
GET    /api/consultations/:id                    Détail avec ordonnances et documents
PATCH  /api/consultations/:id                    Modifier consultation
```

### Médicaments (référentiel CNOPS)
```
GET    /api/medicaments/search?q=&limit=  Recherche autocomplete (nom, DCI, forme)
POST   /api/medicaments/find-or-create    Retourner l'existant ou créer si absent
GET    /api/medicaments/:id               Détail d'un médicament
POST   /api/medicaments                   Créer manuellement
```

### Ordonnances
```
POST   /api/ordonnances                      Créer ordonnance (avec médicaments liés ou libres)
GET    /api/ordonnances/patient/:id          Ordonnances d'un patient
GET    /api/ordonnances/:id                  Détail
GET    /api/ordonnances/:id/pdf              Télécharger PDF (généré à la volée avec PDFKit)
```

### Paiements / Caisse
```
POST   /api/paiements                                   Enregistrer paiement (lié à une consultation et/ou un patient)
GET    /api/paiements/caisse?date=                      Caisse journalière (total, détail par mode, avec patient et consultation)
GET    /api/paiements/rapport?debut=&fin=               Rapport sur une période
GET    /api/paiements/export?debut=&fin=&assurance=     Export Excel (.xlsx) — assurance: tous | assures | non_assures
```

### Stock
```
POST   /api/stock/articles          Créer article
GET    /api/stock/articles          Lister articles (avec flag alerteStock)
GET    /api/stock/articles/alertes  Articles sous seuil d'alerte uniquement
GET    /api/stock/articles/:id      Détail avec historique des mouvements
POST   /api/stock/mouvements        Entrée ou sortie (transactionnel, vérifie stock suffisant)
```

### Rapports
```
GET    /api/rapports/dashboard      Tableau de bord (patients, RDV jour/semaine, recette, alertes stock)
```

---

## Schéma de base de données

```
users ──────────────── rendez_vous ──────────── patients (estAssure)
  │                         │                      │
  │                   consultations ───────────────┤
  │                         │                      │
  └────── audit_logs   ordonnances ───────────────┘
                             │
                  ordonnance_medicaments ─── medicaments (CNOPS)

paiements ────────── rendez_vous
paiements ────────── consultations   ← (nouveau : lien encaissement↔consultation)
paiements ────────── patients        ← (nouveau : lien direct patient)
stock_articles ───── stock_mouvements
documents ────────── patients / consultations
refresh_tokens ────── users
parametres
```

**13 modèles Prisma** — migrations versionnées dans `backend/prisma/migrations/`.

---

## Tests

### Backend
```bash
cd backend
npm test                 # Tests unitaires (auth, patients)
npm run test:cov         # Avec rapport de couverture
npm run test:watch       # Mode watch
```

Les tests unitaires utilisent des mocks Prisma (pas de DB réelle nécessaire).

### Frontend
```bash
cd frontend
npm test
```

### CI/CD

Un pipeline GitHub Actions (`.github/workflows/ci.yml`) s'exécute à chaque push sur `main` et `develop` :
1. Tests backend (avec PostgreSQL de service)
2. Linter backend + frontend
3. Build backend
4. Build frontend
5. Build Docker (sur `main` uniquement)

---

## Sauvegardes PostgreSQL

```bash
# Créer une sauvegarde
docker compose exec postgres pg_dump -U postgres cabinet_medical > backup_$(date +%Y%m%d).sql

# Restaurer
cat backup_20241231.sql | docker compose exec -T postgres psql -U postgres cabinet_medical
```

Automatiser avec cron :
```bash
# crontab -e
0 2 * * * cd /path/to/cabinet-medical-maroc && docker compose exec postgres pg_dump -U postgres cabinet_medical > backups/backup_$(date +%Y%m%d).sql
```

---

## Déploiement production (actuel)

L'application est déployée sur l'infrastructure suivante :

| Composant | Plateforme | URL |
|-----------|------------|-----|
| Frontend | Vercel (free tier) | https://cabinet-medical-maroc.vercel.app |
| Backend | Render (free tier, Docker) | https://cabinet-medical-maroc.onrender.com |
| Base de données | Render PostgreSQL | Interne Render |

### Architecture de déploiement

```
GitHub master ──push──► Render (auto-deploy Docker) ──migrate deploy + seed──► PostgreSQL Render
                   └───► Vercel (auto-deploy) ──► cabinet-medical-maroc.vercel.app
```

### Redéployer le frontend (Vercel)

Le frontend se redéploie automatiquement à chaque push sur `master` via l'intégration GitHub de Vercel.  
Pour forcer un déploiement manuel :

```bash
nvm use 20
npx vercel --prod   # depuis la racine du repo
```

### Redéployer le backend (Render)

Render reconstruit automatiquement l'image Docker à chaque push sur `master`.  
La migration de base de données s'exécute automatiquement au démarrage du conteneur :
```
npx prisma migrate deploy && node prisma/seed.js && node prisma/import-medicaments.js && node dist/main
```

Pour forcer un redéploiement manuel : Render Dashboard → service backend → **Manual Deploy** → **Deploy latest commit**.

### Appliquer une migration en urgence sur la DB de production

```bash
cd backend
DATABASE_URL="<url_render_postgres>" npx prisma migrate deploy
```

### Maintien en activité (free tier)

Le free tier Render met le service en veille après 15 min d'inactivité.  
**UptimeRobot** est configuré pour pinguer `https://cabinet-medical-maroc.onrender.com/api/health` toutes les 5 minutes et maintenir le service éveillé.

### Variables d'environnement en production

**Render (backend)** — à configurer dans Environment :

| Variable | Valeur |
|----------|--------|
| `DATABASE_URL` | URL interne PostgreSQL Render |
| `JWT_SECRET` | Secret fort généré |
| `JWT_REFRESH_SECRET` | Secret fort généré |
| `CORS_ORIGIN` | `https://cabinet-medical-maroc.vercel.app` |
| `PORT` | `3001` (géré automatiquement par Render) |

**Vercel (frontend)** — à configurer dans Project Settings → Environment Variables :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_API_URL` | `https://cabinet-medical-maroc.onrender.com/api` |

### Auto-hébergement (Docker Compose)

Pour déployer sur un VPS :

```bash
docker compose build
docker compose up -d
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
docker compose exec backend npm run prisma:import-medicaments
```

Configurer ensuite un reverse proxy Nginx + HTTPS via Let's Encrypt.

---

## Sécurité

- Mots de passe hashés avec **Argon2** (résistant GPU/ASIC)
- **JWT** avec expiration courte (15min) + refresh token rotatif stocké en base
- **RBAC** : médecin, secrétaire, admin avec permissions granulaires par route
- **Audit trail** : toutes les opérations sensibles journalisées dans `audit_logs`
- **Rate limiting** : 100 req/min par défaut (ThrottlerModule NestJS)
- **Helmet** : headers de sécurité HTTP
- **Validation** : DTOs class-validator côté backend + Zod côté frontend
- Suppression **logique** des patients (champ `actif`, données jamais effacées physiquement)
- Réhydratation auth **côté client** via Zustand persist — pas de flash de redirection

---

## Licence

Usage interne — cabinet médical privé. Ne pas distribuer sans autorisation.
