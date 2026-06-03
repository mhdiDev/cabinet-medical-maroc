# Déploiement Vercel + Railway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déployer le frontend Next.js sur Vercel et le backend NestJS + PostgreSQL sur Railway, avec toutes les variables d'environnement correctement configurées.

**Architecture:** Le frontend (Next.js 14) est déployé sur Vercel qui le sert via CDN. Le backend NestJS tourne en tant que service Node.js persistant sur Railway, avec une base PostgreSQL managée également sur Railway. Les deux communiquent via HTTPS avec la variable `NEXT_PUBLIC_API_URL`.

**Tech Stack:** Next.js 14, NestJS, PostgreSQL (Prisma), Vercel CLI, Railway CLI

---

## Fichiers concernés

| Fichier | Action |
|---|---|
| `frontend/next.config.js` | Vérifier/ajuster env vars |
| `frontend/.env.production` | Créer avec NEXT_PUBLIC_API_URL |
| `frontend/vercel.json` | Créer (optionnel, config Vercel) |
| `backend/.env.production` | Créer avec DATABASE_URL, JWT_SECRET, etc. |
| `backend/src/main.ts` | Vérifier port dynamique (process.env.PORT) |
| `backend/prisma/schema.prisma` | Aucun changement |

---

## Pré-requis

- Compte Vercel (vercel.com) — gratuit
- Compte Railway (railway.app) — gratuit avec $5 de crédit
- Node 20 installé localement
- `npm i -g vercel` et `npm i -g @railway/cli`

---

### Task 1 : Vérifier que le backend écoute sur `process.env.PORT`

Railway injecte le port dynamiquement. NestJS doit l'utiliser.

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Lire le fichier main.ts actuel**

```bash
cat backend/src/main.ts
```

- [ ] **Step 2: S'assurer que le port utilise process.env.PORT**

Le fichier doit contenir :

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  });
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}
bootstrap();
```

Si le port est hardcodé à `3001`, le remplacer par `process.env.PORT || 3001`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/main.ts
git commit -m "fix: use dynamic PORT env var for Railway deployment"
```

---

### Task 2 : Déployer la base de données PostgreSQL sur Railway

- [ ] **Step 1: Se connecter à Railway**

```bash
railway login
```

Suivre le lien affiché dans le terminal (authentification browser).

- [ ] **Step 2: Créer un nouveau projet Railway**

```bash
railway init
```

Choisir "Create new project", donner le nom `cabinet-medical-maroc`.

- [ ] **Step 3: Ajouter un service PostgreSQL**

Dans le dashboard Railway (railway.app) :
1. Ouvrir le projet créé
2. Cliquer "New Service" → "Database" → "PostgreSQL"
3. Attendre que la DB démarre (~30 secondes)

- [ ] **Step 4: Récupérer la DATABASE_URL**

Dans Railway, cliquer sur le service PostgreSQL → onglet "Variables" → copier la valeur de `DATABASE_URL`.

Elle ressemble à : `postgresql://postgres:motdepasse@containers-us-west-XXX.railway.app:5432/railway`

La noter — elle sera utilisée dans les étapes suivantes.

---

### Task 3 : Déployer le backend NestJS sur Railway

- [ ] **Step 1: Se positionner dans le dossier backend**

```bash
cd backend
```

- [ ] **Step 2: Lier le dossier backend au projet Railway**

```bash
railway link
```

Sélectionner le projet `cabinet-medical-maroc` créé à la Task 2.

- [ ] **Step 3: Créer un nouveau service backend dans Railway**

```bash
railway service create
```

Nommer le service `backend`.

- [ ] **Step 4: Configurer les variables d'environnement du backend**

Dans Railway dashboard → service `backend` → onglet "Variables", ajouter :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | (copiée à la Task 2) |
| `JWT_SECRET` | (générer : `openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | (générer : `openssl rand -hex 32`) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://<votre-projet>.vercel.app` (à mettre à jour après Task 4) |

Pour générer les secrets JWT :
```bash
openssl rand -hex 32
openssl rand -hex 32
```

- [ ] **Step 5: Créer un fichier railway.json pour le build**

```bash
cat > railway.json << 'EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build && npx prisma generate"
  },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && npm run start:prod",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
EOF
```

- [ ] **Step 6: Ajouter un endpoint /api/health dans NestJS**

Dans `backend/src/app.controller.ts`, ajouter :

```typescript
@Get('health')
health() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}
```

- [ ] **Step 7: Déployer le backend**

```bash
railway up
```

Railway va détecter Node.js, builder avec Nixpacks, et déployer.

- [ ] **Step 8: Vérifier le déploiement**

```bash
railway logs
```

Attendre le message `Application running on port XXXX`.

- [ ] **Step 9: Récupérer l'URL du backend**

Dans Railway dashboard → service `backend` → onglet "Settings" → "Public Networking" → cliquer "Generate Domain".

L'URL ressemblera à `https://backend-production-XXXX.up.railway.app`.

- [ ] **Step 10: Tester l'API en production**

```bash
curl https://backend-production-XXXX.up.railway.app/api/health
# Attendu: {"status":"ok","timestamp":"..."}
```

- [ ] **Step 11: Commit**

```bash
cd ..
git add backend/railway.json backend/src/app.controller.ts
git commit -m "feat: add Railway deployment config and health endpoint"
```

---

### Task 4 : Déployer le frontend Next.js sur Vercel

- [ ] **Step 1: Se connecter à Vercel**

```bash
cd frontend
vercel login
```

Choisir "Continue with Email" ou GitHub.

- [ ] **Step 2: Initialiser le projet Vercel**

```bash
vercel
```

Répondre aux questions :
- "Set up and deploy?" → **Y**
- "Which scope?" → sélectionner votre compte
- "Link to existing project?" → **N**
- "Project name?" → `cabinet-medical-maroc`
- "In which directory is your code located?" → `./` (on est déjà dans `frontend/`)
- "Want to override the settings?" → **N**

- [ ] **Step 3: Configurer la variable d'environnement NEXT_PUBLIC_API_URL**

```bash
vercel env add NEXT_PUBLIC_API_URL production
```

Entrer la valeur : `https://backend-production-XXXX.up.railway.app/api`
(l'URL Railway récupérée à la Task 3, Step 9, avec `/api` à la fin)

- [ ] **Step 4: Déployer en production**

```bash
vercel --prod
```

Attendre la fin du build (~2-3 minutes).

- [ ] **Step 5: Récupérer l'URL Vercel**

La commande affiche l'URL de production, ex : `https://cabinet-medical-maroc.vercel.app`

- [ ] **Step 6: Mettre à jour FRONTEND_URL dans Railway**

Dans Railway dashboard → service `backend` → Variables, mettre à jour :

```
FRONTEND_URL = https://cabinet-medical-maroc.vercel.app
```

Puis redéployer le backend pour prendre en compte le CORS :
```bash
cd ../backend && railway up
```

---

### Task 5 : Vérification end-to-end

- [ ] **Step 1: Ouvrir l'URL Vercel dans le browser**

```
https://cabinet-medical-maroc.vercel.app
```

Vérifier que la page de login s'affiche.

- [ ] **Step 2: Tester la connexion API**

Ouvrir les DevTools (F12) → onglet Network. Se connecter avec un compte de test. Vérifier que les requêtes vers `backend-production-XXXX.up.railway.app` retournent 200.

- [ ] **Step 3: Vérifier la base de données**

```bash
cd backend
railway run npx prisma studio
```

Cela ouvre Prisma Studio connecté à la DB de production — vérifier que les tables existent.

- [ ] **Step 4: (Optionnel) Connecter le repo GitHub pour le déploiement automatique**

Dans Vercel dashboard → Settings → Git → Connect Git Repository → sélectionner `cabinet-medical-maroc`. Désormais chaque push sur `master` déclenchera un déploiement automatique.

Dans Railway dashboard → service `backend` → Settings → "Connect Repo" → faire de même.

---

## Résumé des URLs finales

| Service | URL |
|---|---|
| Frontend (Vercel) | `https://cabinet-medical-maroc.vercel.app` |
| Backend API (Railway) | `https://backend-production-XXXX.up.railway.app/api` |
| Base de données | Interne Railway (pas d'accès public nécessaire) |

## Variables d'environnement à conserver en sécurité

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DATABASE_URL`

Ne jamais les committer dans git. Utiliser `.gitignore` pour exclure les fichiers `.env.production`.
