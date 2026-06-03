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
└── docker-compose.yml
```

## URLs production

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://cabinet-medical-maroc.vercel.app |
| Backend (Render) | https://cabinet-medical-maroc.onrender.com |
| Swagger | https://cabinet-medical-maroc.onrender.com/api/docs |
| Health check | https://cabinet-medical-maroc.onrender.com/api/health |

## Comptes de démo

| Rôle | Email | Mot de passe |
|------|-------|--------------|
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

# Appliquer migrations en production
cd backend
DATABASE_URL="postgresql://cabinet_medical_db_rtqm_user:teIeFYR58t36JySyjkYPAAnrXv6x6k5p@dpg-d8f0hk4m0tmc73eec5jg-a.frankfurt-postgres.render.com/cabinet_medical_db_rtqm" \
  npx prisma migrate deploy

# Prisma Studio (UI base de données locale)
cd backend && npx prisma studio
```

### Déploiement

```bash
# Frontend → Vercel (depuis la racine du repo)
npx vercel --prod

# Backend → Render : push sur master déclenche l'auto-deploy Docker
git push origin master
```

> Le backend Render exécute automatiquement au démarrage :
> `npx prisma migrate deploy && node prisma/seed.js && node prisma/import-medicaments.js && node dist/main`

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
| Render free tier en veille | UptimeRobot pinge `/api/health` toutes les 5 min |
| Vercel déploie depuis la racine | Root Directory configuré sur `frontend` dans Vercel Settings |

## Variables d'environnement production

### Render (backend)
- `DATABASE_URL` — PostgreSQL Render interne
- `JWT_SECRET` / `JWT_REFRESH_SECRET`
- `CORS_ORIGIN=https://cabinet-medical-maroc.vercel.app`

### Vercel (frontend)
- `NEXT_PUBLIC_API_URL=https://cabinet-medical-maroc.onrender.com/api`

## Workflow de développement recommandé

1. Nouvelle feature → brainstorming (`superpowers:brainstorming`)
2. Plan → `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`
3. Implémentation → `superpowers:subagent-driven-development`
4. Deploy → `git push origin master` + `npx vercel --prod`
