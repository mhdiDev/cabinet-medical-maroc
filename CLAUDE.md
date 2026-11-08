# Cabinet Médical Maroc — Guide Claude

## Projet

Application web de gestion de cabinet médical, adaptée au Maroc (CIN, téléphone 06/07, MAD, CNOPS).

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, React Hook Form, Zod |
| Backend | NestJS, TypeScript, Prisma ORM |
| Base de données | PostgreSQL 16 |
| Auth | JWT (15min) + Refresh Token (7j), Argon2, RBAC (SUPER_ADMIN / MEDECIN / SECRETAIRE, médecin titulaire) |
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
├── minio/        Dockerfile MinIO (compilé depuis les sources)
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
| Documents patients | Privés : `GET /api/documents/:id/fichier` (MinIO n'est plus lisible publiquement) |
| Serveur | VPS-1 OVH, Canada (Beauharnois), Ubuntu 24.04, 2 vCPU / 4 Go + 2 Go swap |
| SSH | `ssh ubuntu@149.56.209.147` |
| Dossier de l'appli | `/opt/cabinet-medical-maroc` (secrets dans `.env`, jamais commité) |

```
Internet ─▶ Nginx :80 (host)
             ├─ /        ▶ frontend  (127.0.0.1:3000)
             └─ /api     ▶ backend   (127.0.0.1:3001) ─▶ postgres (réseau Docker interne)
```

Serveur temporaire : à déplacer vers un VPS en Europe dès qu'il y en a en stock.
Pas de vraies données patients d'ici là (données de santé, loi 09-08 / CNDP).

## Comptes de démo

Le seed crée ces comptes s'ils n'existent pas. Mots de passe valables en local uniquement : en production, ils doivent être changés après le premier déploiement (page « Mon compte » pour chacun, ou réinitialisation par le titulaire depuis « Utilisateurs »).

| Rôle | Email | Mot de passe (local) |
|------|-------|----------------------|
| Médecin titulaire | admin@cabinet.ma | Admin123! |
| Médecin | dr.benali@cabinet.ma | Medecin123! |
| Secrétaire | secretaire@cabinet.ma | Secretaire123! |

## Super Admin

Aucun compte n'est créé par le seed. Sur le serveur :

```bash
docker exec cabinet_backend node dist/prisma/creer-super-admin.js <email> <prénom> <nom>
```

Exactement 3 arguments : un prénom ou un nom composé se met entre guillemets (`"El Idrissi"`). Le compte et sa ligne d'audit sont créés dans une même transaction. La commande affiche un mot de passe généré, à changer à la première connexion. Le Super Admin gère les cabinets sur la page « Cabinets » : création (avec le titulaire), modification, suspension, réactivation, réinitialisation du mot de passe du titulaire (409 si le titulaire est désactivé).

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
en SSH (secrets GitHub `OVH_HOST`, `OVH_USER`, `OVH_SSH_KEY`). **Tout merge sur master part donc en production.**
Juste après un déploiement, l'API répond 502 pendant que le backend applique les migrations et le seed.

> Au démarrage, le backend exécute :
> `npx prisma migrate deploy && node prisma/seed.js && node prisma/import-medicaments.js && node dist/main`

Le premier build prend environ 10 minutes (MinIO est compilé depuis les sources, voir `minio/Dockerfile` :
MinIO ne publie plus d'image Docker).

Sauvegardes : `scripts/backup.sh` (dump Postgres + archive MinIO vers OVH Object Storage via rclone, cron à 02h00).

## Modèles Prisma (16 modèles)

`Cabinet` · `User` · `RefreshToken` · `Patient` · `RendezVous` · `Consultation` · `Ordonnance` · `Medicament` · `OrdonnanceMedicament` · `Paiement` · `StockArticle` · `StockMouvement` · `Document` · `AuditLog` · `Notification` · `Parametre`

Relations clés :
- `Paiement` → `Consultation` (consultationId, optionnel)
- `Paiement` → `Patient` (patientId, optionnel)
- `Paiement` → `RendezVous` (rendezVousId, optionnel)
- `Patient.estAssure Boolean` — statut assuré/non assuré

## Architecture API (préfixe `/api`)

```
/auth                login, refresh, logout, me, change-password
                     users (GET liste / POST création / PATCH :id modification / PATCH :id/statut)
                     + users/:id/reset-password  (titulaire)
/patients            CRUD + export CSV + stats + /cin/:cin
/rendez-vous         CRUD + agenda + today + statut
/consultations       CRUD + /patient/:id  (filtre ?date= disponible)
/ordonnances         CRUD + /patient/:id + /:id/pdf
/medicaments         search + find-or-create + CRUD
/paiements           CRUD + caisse + rapport + export Excel (?debut=&fin=&assurance=)
/stock/articles      CRUD + alertes
/stock/mouvements    entrées/sorties
/documents           upload + /patient/:id + /:id/fichier (fichier servi par l'API) + DELETE
/rapports/dashboard  tableau de bord
/health              health check (UptimeRobot)
/plateforme/cabinets liste, création, modification, statut, titulaire/reset-password  (SUPER_ADMIN)
```

## Multi-cabinet : isolation

- Chaque requête ouvre un contexte (`prisma/contexte-cabinet.ts`) ; `JwtAuthGuard` y écrit le `cabinetId` de l'utilisateur, relu en base.
- `PrismaService` est un client filtré (`prisma/client-filtre.ts`) : il ajoute le cabinet à toutes les opérations des modèles cloisonnés et répond 403 sans cabinet, y compris pour un `SUPER_ADMIN`.
- Le client filtré refuse le SQL brut (`$queryRaw`, `$executeRaw` et variantes `Unsafe`) : il lèverait le filtre.
- `PrismaSansFiltre` contourne le filtre : réservé à la connexion, à `JwtStrategy`, au contrôle d'unicité de l'email, au changement de mot de passe (un `SUPER_ADMIN` n'a pas de cabinet ; l'audit `CHANGE_PASSWORD` y est écrit dans la même transaction) et au module `plateforme/`. Un test bloque tout autre usage.
- Nouveau modèle avec `cabinetId` : l'ajouter à `MODELES_CLOISONNES` (un test le vérifie). Un `create` passe `cabinetId: cabinetCourant()`.
- Écriture citant l'identifiant d'une autre donnée : appeler `ReferencesService.verifier()`, car le filtre ne contrôle pas ces identifiants. Il contrôle aussi les chaînes vides (seuls `undefined` et `null` sont ignorés).
- Une ressource d'un autre cabinet répond 404, jamais 403.
- `MEDECIN` + `estTitulaire` gère le cabinet : `@TitulaireSeulement()` protège ses routes.
- Le client filtré refuse aussi le modèle `Cabinet` : un service d'un cabinet n'atteint son cabinet que par une relation (ex. `ordonnance.cabinet`).
- Le module `plateforme/` (rôle `SUPER_ADMIN`, `@SuperAdminSeulement()`) utilise `PrismaSansFiltre`, limité par test aux modèles `Cabinet`, `User`, `AuditLog` et `RefreshToken` : jamais de données de patients. Son client est typé `Pick<PrismaSansFiltre, 'cabinet' | 'user' | 'auditLog' | 'refreshToken' | '$transaction'>`, et le test n'y permet de l'audit que `auditLog.create` (`AuditLog.details` peut contenir des données patients).
- Le titulaire modifie (nom, prénom, téléphone, email) et désactive / réactive les comptes de son cabinet. Changer l'email ou désactiver supprime les refresh tokens dans la même transaction ; il ne peut ni changer son propre email ni désactiver son propre compte. L'unicité de l'email à la modification repose sur la contrainte de la base (`P2002` → 409), sans `PrismaSansFiltre`.
- Un autre titulaire du cabinet ne peut être ni modifié, ni désactivé, ni réinitialisé (403) ; la page masque ces actions sur sa ligne.
- Après un changement d'email, l'ancien jeton d'accès est refusé tout de suite : `JwtStrategy` compare l'email du jeton à celui en base (l'autre session revient à la connexion dès sa prochaine requête).
- Le changement de statut est atomique (`updateMany` conditionnel dans une transaction interactive) : un seul audit même pour des demandes simultanées ; redemander l'état en place répond 200 sans audit.
- Un compte désactivé ne peut pas être réinitialisé (409) ; ses données restent visibles par le cabinet.
- Frontend : les modales partagent `components/commun/useModale.ts` (Échap, focus initial sur `data-autofocus`).
- Un cabinet suspendu (`Cabinet.actif = false`) bloque la connexion (403 `CABINET_SUSPENDU`), les sessions ouvertes (`JwtStrategy`) et le renouvellement.

## Auth : changement de mot de passe forcé

- Les mots de passe initiaux (`POST /auth/users`) et temporaires (`POST /auth/users/:id/reset-password`) sont **générés par le serveur** (`auth/generer-mot-de-passe.ts`) et renvoyés une seule fois au titulaire ; le titulaire ne choisit jamais le mot de passe d'un autre. Le compte a alors `User.doitChangerMdp = true`.
- Emails normalisés (trim + minuscules) à la création et au login (`@NormaliserEmail()`).
- Seul l'utilisateur choisit son mot de passe (« Mon compte ») : 8 caractères minimum, avec majuscule, minuscule et chiffre.
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
- **DTO de modification** : une vraie classe (`PartialType`). Un type `Partial<Dto>` n'existe pas à l'exécution : le corps de la requête ne serait pas validé.
- **Erreurs métier côté formulaire** : ne pas renvoyer 401 (l'intercepteur axios le traite comme un token expiré → refresh/déconnexion) ; utiliser 400.

## Pièges connus

| Problème | Solution |
|----------|----------|
| `cin: ""` → 500 PATCH patient | Convertir en `undefined` avant envoi (`cin: data.cin?.trim() \|\| undefined`) |
| `consultations` vs `data` dans la réponse API | Le service retourne `{ consultations, meta }` (pas `{ data, meta }`) |
| Node ancien (v8) actif par défaut | `nvm use 20` ou `PATH="/Users/Mehdi/.nvm/versions/node/v20.19.5/bin:$PATH"`. Idem pour les serveurs MCP lancés via `npx` (chemin absolu de Node 20) |
| Routes manquantes en local (404) alors qu'elles existent dans le code | `nest start --watch` lance un vieux `backend/dist/src/main.js` : `rm -rf backend/dist/src` puis relancer `npm run start:dev` |
| Tests e2e qui effacent les données locales | Ils font `DELETE` sur toutes les tables : toujours `DATABASE_URL=…/cabinet_test` |
| `backend: npm run lint` reformate des dizaines de fichiers | Le script lance `eslint --fix` : pour vérifier sans modifier, `npx eslint <fichiers>` |
| `frontend: npx tsc --noEmit` en erreur | 4 erreurs déjà présentes (`stock/page.tsx`, `NouveauRdvModal.tsx`) : vérifier qu'on n'en ajoute pas. Les `*.test.ts(x)` sont exclus du `tsconfig` (pas de `@types/jest`) : `npx jest` les exécute |
| `NEXT_PUBLIC_API_URL` | Intégrée au build Next.js : la changer impose `docker compose up -d --build` |
| Upload de documents en local : 503 | `MINIO_ENDPOINT` doit avoir schéma et port (`http://localhost:9000`) et le bucket `cabinet-medical` doit exister : `docker-compose.dev.yml` ne le crée pas |
| `/api/health` | Répond « ok » sans interroger la base : ne prouve pas que la base fonctionne |
| Identifiant de cabinet refusé par `@IsUUID` | Le premier cabinet a l'identifiant fixe `00000000-0000-0000-0000-000000000001` (hors v4) : ne pas valider les `:id` de cabinet comme UUID |
| `PATCH /plateforme/cabinets/:id` répond 400 | Corps vide (`{}`) refusé (« Aucune modification ») ; un champ à `null` aussi : n'envoyer que les champs modifiés |
| Trim d'un champ texte dans un DTO | `@NettoyerTexte()` (`common/transforms/nettoyer-texte.ts`) et `@NormaliserEmail()` lisent la valeur brute (`obj[key]`) : avec `enableImplicitConversion`, `value` est déjà convertie (`123` → `'123'`) et `IsString` l'accepterait. Ne pas écrire `Transform(({ value }) => value?.trim())` |
| `read ECONNRESET` au hasard dans les e2e | `createApp()` (`test/helpers.ts`) fait `app.listen(0)` : sans serveur à l'écoute, supertest ouvre et ferme un port par requête et l'agent keep-alive de Node 20 peut réutiliser une socket coupée |
| Variable non utilisée signalée par eslint | `no-unused-vars` ignore les frères d'un rest (`const { motDePasse, ...reste } = user`) et les arguments préfixés `_` |

## Variables d'environnement production

Fichier `/opt/cabinet-medical-maroc/.env` sur le serveur (modèle : `.env.production.example`) :
`POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `MINIO_ROOT_USER`,
`MINIO_ROOT_PASSWORD`, `MINIO_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`.

## Workflow de développement recommandé

1. Nouvelle feature → brainstorming (`superpowers:brainstorming`)
2. Plan → `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`
3. Implémentation → `superpowers:subagent-driven-development`
4. Deploy → merge sur master (déploiement automatique après une CI verte)
