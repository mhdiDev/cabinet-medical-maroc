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

Le seed crée ces comptes s'ils n'existent pas. Mots de passe valables en local uniquement : en production, ils doivent être changés après le premier déploiement (page « Mon compte » pour chacun, ou réinitialisation par l'admin depuis « Utilisateurs »).

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

### Tests backend

```bash
# Unitaires
cd backend && npx jest

# E2E : ils VIDENT la base → toujours sur la base dédiée cabinet_test, jamais sur cabinet_medical
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -c "CREATE DATABASE cabinet_test"  # une fois
cd backend
DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:password@localhost:5432/cabinet_test" npm run test:e2e
```

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
/auth                login, refresh, logout, me, change-password
                     users (GET liste / POST création) + users/:id/reset-password  (ADMIN)
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

## Auth : changement de mot de passe forcé

- `User.doitChangerMdp` passe à `true` quand l'admin réinitialise un mot de passe (`POST /auth/users/:id/reset-password`).
- Tant qu'il est vrai, `JwtAuthGuard` répond 403 `{ code: 'MUST_CHANGE_PASSWORD' }` sur toute route qui n'a pas le décorateur `@AutoriseSiMdpAChanger()` (aujourd'hui : `me`, `change-password`, `logout`).
- Côté frontend, le layout `(dashboard)` et l'intercepteur axios redirigent vers `/mon-compte`.
- Changer ou réinitialiser un mot de passe révoque tous les refresh tokens de l'utilisateur (dans une transaction Prisma).

## Conventions de code

- **Commits** : préfixe `feat:` / `fix:` / `chore:` / `docs:` / `refactor:`
- **Validation backend** : DTOs class-validator + `whitelist: true, forbidNonWhitelisted: true, transform: true`
- **Validation frontend** : Zod + React Hook Form
- **Champs optionnels** : toujours envoyer `undefined` (pas `""`) pour les champs avec contrainte UNIQUE (ex: `cin`)
- **Dates** : format ISO string côté DTO, `fr-MA` locale pour l'affichage
- **Responsive** : Tailwind breakpoints `sm:` (640px) / `lg:` (1024px)
- **Routes protégées** : tout contrôleur utilise `JwtAuthGuard` (c'est lui qui applique le changement forcé). Une route qui doit rester accessible pendant un changement forcé prend `@AutoriseSiMdpAChanger()`.
- **Erreurs métier côté formulaire** : ne pas renvoyer 401 (l'intercepteur axios le traite comme un token expiré → refresh/déconnexion) ; utiliser 400.

## Pièges connus

| Problème | Solution |
|----------|----------|
| `cin: ""` → 500 PATCH patient | Convertir en `undefined` avant envoi (`cin: data.cin?.trim() \|\| undefined`) |
| `consultations` vs `data` dans la réponse API | Le service retourne `{ consultations, meta }` (pas `{ data, meta }`) |
| Node ancien (v8) actif par défaut | `nvm use 20` ou `PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"`. Idem pour les serveurs MCP lancés via `npx` (chemin absolu de Node 20) |
| Routes manquantes en local (404) alors qu'elles existent dans le code | `nest start --watch` lance un vieux `backend/dist/src/main.js` : `rm -rf backend/dist/src` puis relancer `npm run start:dev` |
| Tests e2e qui effacent les données locales | Ils font `DELETE` sur toutes les tables : toujours `DATABASE_URL=…/cabinet_test` |
| `frontend: npx tsc --noEmit` en erreur | 4 erreurs déjà présentes (`stock/page.tsx`, `NouveauRdvModal.tsx`) : vérifier qu'on n'en ajoute pas |
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
