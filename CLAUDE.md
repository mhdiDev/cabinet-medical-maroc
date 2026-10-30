# Cabinet Médical Maroc — Guide Claude

## Projet

Application web de gestion de cabinet médical, adaptée au Maroc (CIN, téléphone 06/07, MAD, CNOPS).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, React Hook Form, Zod |
| Backend | NestJS, TypeScript, Prisma ORM |
| Base de données | PostgreSQL 16 |
| Auth | JWT (15min) + Refresh Token (7j), Argon2, RBAC (ADMIN / MEDECIN / SECRETAIRE) |
| Export | xlsx (Excel), PDFKit (ordonnances) |
| Stockage fichiers | MinIO (S3-compatible) |

**Node 20 obligatoire.** Toujours utiliser `nvm use 20` avant toute commande npm/npx.

## Structure du dépôt

```
cabinet-medical-maroc/
├── backend/          NestJS API (port 3001)
├── frontend/         Next.js 14 (port 3000)
├── docs/
│   └── superpowers/
│       ├── specs/    Design docs
│       └── plans/    Plans d'implémentation
├── minio/        Dockerfile MinIO (compilé depuis les sources) + policy du bucket
├── nginx/        cabinet.conf (reverse proxy du VPS)
├── scripts/      backup.sh (sauvegarde nocturne)
├── docker-compose.yml      production (VPS OVH, secrets via .env)
└── docker-compose.dev.yml  infra locale (Postgres, MinIO, MailHog)
```

## Production (VPS OVH)

Tout tourne en Docker Compose sur un VPS OVH, derrière Nginx (installé sur le host).
Vercel et Render ne sont plus utilisés (la base Render a été supprimée).

| Élément | Valeur |
|---------|--------|
| Application | http://149.56.209.147 |
| API | http://149.56.209.147/api |
| Swagger | http://149.56.209.147/api/docs |
| Documents patients | http://149.56.209.147/files/ (MinIO, lecture seule) |
| Serveur | VPS-1 OVH, Canada (Beauharnois), Ubuntu 24.04, 2 vCPU / 4 Go + 2 Go swap |
| SSH | `ssh ubuntu@149.56.209.147` |
| Dossier de l'appli | `/opt/cabinet-medical-maroc` (secrets dans `.env`, jamais commité) |

```
Internet ─▶ Nginx :80 (host)
             ├─ /        ▶ frontend  (127.0.0.1:3000)
             ├─ /api     ▶ backend   (127.0.0.1:3001) ─▶ postgres (réseau Docker interne)
             └─ /files/  ▶ minio     (127.0.0.1:9000, bucket cabinet-medical)
```

Serveur temporaire : à déplacer vers un VPS en Europe dès qu'il y en a en stock.
Pas de vraies données patients d'ici là (données de santé, loi 09-08 / CNDP).

## Comptes de démo

Le seed crée ces comptes s'ils n'existent pas. Mots de passe valables en local uniquement : en production, ils doivent être changés après le premier déploiement (pas d'écran pour ça, passer par `POST /api/auth/change-password`).

| Rôle | Email | Mot de passe (local) |
|------|-------|----------------------|
| Admin | admin@cabinet.ma | Admin123! |
| Médecin | dr.benali@cabinet.ma | Medecin123! |
| Secrétaire | secretaire@cabinet.ma | Secretaire123! |

## Commandes courantes

### Développement local

```bash
# Infrastructure (PostgreSQL, MinIO, MailHog)
docker compose -f docker-compose.dev.yml up -d

# Backend
cd backend && npm run start:dev

# Frontend
cd frontend && npm run dev
```

### Base de données

```bash
# Nouvelle migration locale
cd backend && npx prisma migrate dev --name <nom>

# Prisma Studio (UI base de données locale)
cd backend && npx prisma studio
```

En production, les migrations sont appliquées automatiquement au démarrage du backend.

### Déploiement (VPS OVH)

```bash
# Manuel, sur le serveur
ssh ubuntu@149.56.209.147
cd /opt/cabinet-medical-maroc && git pull && docker compose up -d --build
```

Automatique : `.github/workflows/deploy.yml` se lance après une CI verte sur master et fait la même chose
en SSH. Il est ignoré tant que les secrets GitHub `OVH_HOST`, `OVH_USER` (`ubuntu`) et `OVH_SSH_KEY`
ne sont pas configurés.

> Au démarrage, le backend exécute :
> `npx prisma migrate deploy && node prisma/seed.js && node prisma/import-medicaments.js && node dist/main`

Le premier build prend environ 10 minutes (MinIO est compilé depuis les sources, voir `minio/Dockerfile` :
MinIO ne publie plus d'image Docker).

Sauvegardes : `scripts/backup.sh` (dump Postgres + archive MinIO vers OVH Object Storage via rclone, cron à 02h00).

## Modèles Prisma (14 modèles)

`User` · `RefreshToken` · `Patient` · `RendezVous` · `Consultation` · `Ordonnance` · `Medicament` · `OrdonnanceMedicament` · `Paiement` · `StockArticle` · `StockMouvement` · `Document` · `AuditLog` · `Parametre`

Relations clés :
- `Paiement` → `Consultation` (consultationId, optionnel)
- `Paiement` → `Patient` (patientId, optionnel)
- `Paiement` → `RendezVous` (rendezVousId, optionnel)
- `Patient.estAssure Boolean` — statut assuré/non assuré

## Architecture API (préfixe `/api`)

```
/auth                login, refresh, logout, me, users, change-password
/patients            CRUD + export CSV + stats + /cin/:cin
/rendez-vous         CRUD + agenda + today + statut
/consultations       CRUD + /patient/:id  (filtre ?date= disponible)
/ordonnances         CRUD + /patient/:id + /:id/pdf
/medicaments         search + find-or-create + CRUD
/paiements           CRUD + caisse + rapport + export Excel (?debut=&fin=&assurance=)
/stock/articles      CRUD + alertes
/stock/mouvements    entrées/sorties
/rapports/dashboard  tableau de bord
/health              health check (UptimeRobot)
```

## Conventions de code

- **Commits** : préfixe `feat:` / `fix:` / `chore:` / `docs:` / `refactor:`
- **Validation backend** : DTOs class-validator + `whitelist: true, forbidNonWhitelisted: true, transform: true`
- **Validation frontend** : Zod + React Hook Form
- **Champs optionnels** : toujours envoyer `undefined` (pas `""`) pour les champs avec contrainte UNIQUE (ex: `cin`)
- **Dates** : format ISO string côté DTO, `fr-MA` locale pour l'affichage
- **Responsive** : Tailwind breakpoints `sm:` (640px) / `lg:` (1024px)

## Pièges connus

| Problème | Solution |
|----------|----------|
| `cin: ""` → 500 PATCH patient | Convertir en `undefined` avant envoi (`cin: data.cin?.trim() \|\| undefined`) |
| `consultations` vs `data` dans la réponse API | Le service retourne `{ consultations, meta }` (pas `{ data, meta }`) |
| Node 10 actif par défaut | `nvm use 20` ou `PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"` |
| `NEXT_PUBLIC_API_URL` | Intégrée au build Next.js : la changer impose `docker compose up -d --build` |
| `/api/health` | Répond « ok » sans interroger la base : ne prouve pas que la base fonctionne |

## Variables d'environnement production

Fichier `/opt/cabinet-medical-maroc/.env` sur le serveur (modèle : `.env.production.example`) :
`POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `MINIO_ROOT_USER`,
`MINIO_ROOT_PASSWORD`, `MINIO_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`.

## Workflow de développement recommandé

1. Nouvelle feature → brainstorming (`superpowers:brainstorming`)
2. Plan → `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`
3. Implémentation → `superpowers:subagent-driven-development`
4. Deploy → merge sur master (déploiement auto une fois l'étape 7 faite, sinon manuel sur le VPS)
