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

- **Patients** — CRUD complet, dossier médical, export CSV, recherche par CIN/nom/téléphone
- **Agenda** — Vue calendrier (jour/semaine/mois), gestion des créneaux, détection de collisions
- **Consultations** — Notes médicales structurées, actes, diagnostic, traitement
- **Ordonnances** — Génération ordonnances PDF, historique, base médicaments
- **Caisse** — Encaissements (espèces/carte/assurance), rapport journalier
- **Stock** — Articles consommables, entrées/sorties, alertes de seuil
- **Sécurité** — Argon2, RBAC (médecin/secrétaire/admin), audit trail complet

## Prérequis

- Docker + Docker Compose v2
- Node.js 20+ (pour développement local)
- npm 10+

## Démarrage rapide (Docker)

```bash
# 1. Cloner le projet
git clone <repo-url>
cd cabinet-medical-maroc

# 2. Copier les variables d'environnement
cp backend/.env.example backend/.env

# 3. Démarrer tous les services
docker compose up -d

# 4. Appliquer les migrations et seed
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed

# 5. Accéder à l'application
# Frontend:  http://localhost:3000
# Backend:   http://localhost:3001/api/docs (Swagger)
# MailHog:   http://localhost:8025
# MinIO:     http://localhost:9001
```

## Développement local

### Infrastructure uniquement (recommandé)

```bash
# Démarrer PostgreSQL, MinIO, MailHog
docker compose -f docker-compose.dev.yml up -d
```

### Backend

```bash
cd backend
cp .env.example .env
# Modifier DATABASE_URL si nécessaire

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
# → http://localhost:3001
# → http://localhost:3001/api/docs (Swagger)
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local

npm install
npm run dev
# → http://localhost:3000
```

## Comptes de démo

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@cabinet.ma | Admin123! |
| Médecin | dr.benali@cabinet.ma | Medecin123! |
| Secrétaire | secretaire@cabinet.ma | Secretaire123! |

## Tests

### Backend
```bash
cd backend
npm test                    # Tests unitaires
npm run test:cov            # Avec couverture
npm run test:watch          # Mode watch
```

### Frontend
```bash
cd frontend
npm test
```

## Variables d'environnement

### Backend (`backend/.env`)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL PostgreSQL | `postgresql://...` |
| `JWT_SECRET` | Clé secrète JWT | — (obligatoire) |
| `JWT_REFRESH_SECRET` | Clé refresh token | — (obligatoire) |
| `JWT_EXPIRES_IN` | Expiration access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Expiration refresh | `7d` |
| `MINIO_ENDPOINT` | Hôte MinIO | `localhost` |
| `MINIO_ACCESS_KEY` | Clé accès MinIO | `minioadmin` |
| `MINIO_SECRET_KEY` | Secret MinIO | `minioadmin` |
| `MINIO_BUCKET` | Bucket fichiers | `cabinet-medical` |
| `SMTP_HOST` | Serveur SMTP | `localhost` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL de l'API backend |

## Architecture API (exemples)

### Authentification
```
POST   /api/auth/login              Connexion
POST   /api/auth/refresh            Rafraîchir token
POST   /api/auth/logout             Déconnexion
GET    /api/auth/me                 Profil connecté
POST   /api/auth/users              Créer utilisateur (admin)
```

### Patients
```
POST   /api/patients                Créer patient
GET    /api/patients?q=&page=&limit= Lister/rechercher
GET    /api/patients/:id            Fiche patient complète
PATCH  /api/patients/:id            Modifier patient
DELETE /api/patients/:id            Supprimer (soft delete)
GET    /api/patients/cin/:cin       Recherche par CIN
GET    /api/patients/export/csv     Export CSV
```

### Rendez-vous
```
POST   /api/rendez-vous             Créer RDV (vérifie collisions)
GET    /api/rendez-vous/agenda      Agenda médecin (date range)
GET    /api/rendez-vous/today       RDV du jour
PATCH  /api/rendez-vous/:id/statut  Changer statut
DELETE /api/rendez-vous/:id         Annuler
```

### Ordonnances
```
POST   /api/ordonnances             Créer ordonnance
GET    /api/ordonnances/patient/:id Ordonnances patient
GET    /api/ordonnances/:id/pdf     Télécharger PDF
```

### Paiements / Caisse
```
POST   /api/paiements               Enregistrer paiement
GET    /api/paiements/caisse        Caisse journalière
GET    /api/paiements/rapport       Rapport période
```

### Stock
```
POST   /api/stock/articles          Créer article
GET    /api/stock/articles          Lister articles
GET    /api/stock/articles/alertes  Articles sous seuil
POST   /api/stock/mouvements        Entrée/sortie stock
```

## Schéma de base de données

```
users ──────────── rendez_vous ──────── patients
  │                    │                   │
  │              consultations ────────────┤
  │                    │                   │
  └── audit_logs  ordonnances ────────────┘
                        │
                 ordonnance_medicaments ── medicaments

paiements ────── rendez_vous
stock_articles ── stock_mouvements
documents ─────── patients / consultations
parametres
```

## Sauvegardes

### Backup PostgreSQL
```bash
# Créer une sauvegarde
docker compose exec postgres pg_dump -U postgres cabinet_medical > backup_$(date +%Y%m%d).sql

# Restaurer
cat backup_20241231.sql | docker compose exec -T postgres psql -U postgres cabinet_medical
```

### Automatiser avec cron (Linux/Mac)
```bash
# Ajouter dans crontab -e
0 2 * * * cd /path/to/cabinet && docker compose exec postgres pg_dump -U postgres cabinet_medical > backups/backup_$(date +%Y%m%d).sql
```

## Déploiement production

1. Modifier toutes les variables sensibles (`JWT_SECRET`, mots de passe DB, etc.)
2. Configurer un reverse proxy (Nginx) devant les ports 3000 et 3001
3. Activer HTTPS (Let's Encrypt / Certbot)
4. Configurer les backups automatiques
5. Utiliser des secrets Docker ou un vault pour les credentials

```bash
# Construire les images de production
docker compose build

# Démarrer en production
docker compose up -d

# Appliquer migrations
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npm run prisma:seed
```

## Internationalisation (FR/AR)

L'application est préparée pour le bilinguisme:
- Français par défaut (`lang="fr"`)
- Support RTL pour l'arabe (classe CSS `[dir="rtl"]` + police Noto Kufi Arabic)
- TODO: intégrer next-i18next avec fichiers de traduction `locales/fr/` et `locales/ar/`

## Sécurité

- Mots de passe hashés avec **Argon2** (résistant GPU/ASIC)
- **JWT** avec expiration courte (15min) + refresh token rotatif
- **RBAC** : médecin, secrétaire, admin avec permissions granulaires
- **Audit trail** : toutes les opérations sensibles journalisées
- **Rate limiting** : 100 req/min par défaut (ThrottlerModule)
- **Helmet** : headers de sécurité HTTP
- **Validation** : DTOs côté backend + Zod côté frontend
- Suppression **logique** des données médicales (jamais supprimées physiquement)

## Licence

Usage interne — cabinet médical privé. Ne pas distribuer sans autorisation.
