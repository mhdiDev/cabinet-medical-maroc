# Migration OVH — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer l'application cabinet médical de Vercel/Render vers un VPS OVH auto-hébergé avec déploiement automatique GitHub Actions et sauvegardes quotidiennes vers OVH Object Storage.

**Architecture:** VPS OVH Ubuntu 22.04, Docker Compose, Nginx reverse proxy sur le host. GitHub Actions se connecte en SSH au VPS et déclenche `git pull + docker compose up -d --build`. Backups PostgreSQL quotidiens vers OVH Object Storage via rclone.

**Tech Stack:** Docker Compose, Nginx, GitHub Actions (`appleboy/ssh-action`), rclone, OVH Object Storage (S3-compatible)

---

## Structure des fichiers

| Action | Fichier |
|--------|---------|
| Modifier | `docker-compose.yml` |
| Créer | `.env.production.example` |
| Créer | `nginx/cabinet.conf` |
| Créer | `scripts/backup.sh` |
| Créer | `.github/workflows/deploy.yml` |

---

## Task 1 : Externaliser les secrets dans docker-compose.yml

**Contexte :** Le `docker-compose.yml` actuel a des mots de passe codés en dur (`password`, `minioadmin`, etc.). En production, ils doivent venir d'un fichier `.env` sur le serveur. Le frontend Next.js utilise `ARG NEXT_PUBLIC_API_URL` dans son Dockerfile — il faut donc aussi le passer comme `build.args`, pas seulement comme `environment`.

Pour la sécurité réseau : les containers postgres, minio et mailhog n'ont pas besoin d'être exposés sur le réseau public — seuls backend (:3001) et frontend (:3000) doivent être accessibles par Nginx (sur le host). Les autres ports seront liés à `127.0.0.1`.

**Files:**
- Modify: `docker-compose.yml`
- Create: `.env.production.example`

- [ ] **Étape 1 : Remplacer les valeurs hardcodées dans docker-compose.yml**

Remplacer le service `postgres` :
```yaml
postgres:
  image: postgres:16-alpine
  container_name: cabinet_postgres
  environment:
    POSTGRES_DB: cabinet_medical
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - cabinet_net
```
(pas de `ports:` — postgres n'est accessible que via le réseau Docker interne)

Remplacer le service `minio` :
```yaml
minio:
  image: minio/minio:latest
  container_name: cabinet_minio
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_ROOT_USER}
    MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
  volumes:
    - minio_data:/data
  ports:
    - "127.0.0.1:9000:9000"
    - "127.0.0.1:9001:9001"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    timeout: 20s
    retries: 3
  networks:
    - cabinet_net
```

Remplacer le service `mailhog` :
```yaml
mailhog:
  image: mailhog/mailhog:latest
  container_name: cabinet_mailhog
  ports:
    - "127.0.0.1:1025:1025"
    - "127.0.0.1:8025:8025"
  networks:
    - cabinet_net
```

Remplacer le service `backend` :
```yaml
backend:
  build:
    context: ./backend
    dockerfile: Dockerfile
  container_name: cabinet_backend
  environment:
    DATABASE_URL: ${DATABASE_URL}
    JWT_SECRET: ${JWT_SECRET}
    JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
    JWT_EXPIRES_IN: 15m
    JWT_REFRESH_EXPIRES_IN: 7d
    NODE_ENV: production
    PORT: 3001
    CORS_ORIGIN: ${CORS_ORIGIN}
    MINIO_ENDPOINT: minio
    MINIO_PORT: 9000
    MINIO_ACCESS_KEY: ${MINIO_ROOT_USER}
    MINIO_SECRET_KEY: ${MINIO_ROOT_PASSWORD}
    MINIO_BUCKET: cabinet-medical
    MINIO_USE_SSL: "false"
    SMTP_HOST: mailhog
    SMTP_PORT: 1025
    EMAIL_FROM: cabinet@example.ma
  ports:
    - "127.0.0.1:3001:3001"
  depends_on:
    postgres:
      condition: service_healthy
    minio:
      condition: service_started
  networks:
    - cabinet_net
  restart: unless-stopped
```

Remplacer le service `frontend` (ajout de `build.args` pour NEXT_PUBLIC_API_URL) :
```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
  container_name: cabinet_frontend
  environment:
    NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
  ports:
    - "127.0.0.1:3000:3000"
  depends_on:
    - backend
  networks:
    - cabinet_net
  restart: unless-stopped
```

- [ ] **Étape 2 : Créer `.env.production.example`**

```env
# PostgreSQL
POSTGRES_PASSWORD=change_me_strong_password

# DATABASE_URL — reprend le même mot de passe que POSTGRES_PASSWORD
DATABASE_URL=postgresql://postgres:change_me_strong_password@postgres:5432/cabinet_medical

# JWT
JWT_SECRET=change_me_64_chars_minimum_secret_key_for_jwt_access_tokens_here
JWT_REFRESH_SECRET=change_me_64_chars_minimum_secret_key_for_jwt_refresh_tokens

# CORS — remplacer par l'IP publique OVH
CORS_ORIGIN=http://X.X.X.X

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=change_me_strong_minio_password

# Frontend — remplacer par l'IP publique OVH
NEXT_PUBLIC_API_URL=http://X.X.X.X/api
```

- [ ] **Étape 3 : Vérifier la substitution des variables localement**

```bash
cd /chemin/vers/cabinet-medical-maroc
cp .env.production.example .env.test
# Remplacer les placeholders par des valeurs de test dans .env.test
docker compose --env-file .env.test config
```

Attendu : le fichier YAML résultant ne contient plus aucun `${VAR}` ni `change_me`.

Supprimer `.env.test` après vérification : `rm .env.test`

- [ ] **Étape 4 : Ajouter `.env.test` et `.env` au `.gitignore` si pas déjà présents**

Vérifier : `grep "^\.env" .gitignore`

Si absent, ajouter :
```
.env
.env.test
```

- [ ] **Étape 5 : Commit**

```bash
git add docker-compose.yml .env.production.example .gitignore
git commit -m "feat: externalize secrets in docker-compose.yml for production"
```

---

## Task 2 : Créer la config Nginx

**Contexte :** Nginx tourne sur le HOST du VPS (pas dans Docker) et route le trafic vers les containers. Il écoute sur le port 80 et proxifie `/api` vers le backend container (127.0.0.1:3001) et `/` vers le frontend container (127.0.0.1:3000).

**Files:**
- Create: `nginx/cabinet.conf`

- [ ] **Étape 1 : Créer le dossier `nginx/` et le fichier de config**

```bash
mkdir -p nginx
```

Contenu de `nginx/cabinet.conf` :
```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] **Étape 2 : Commit**

```bash
git add nginx/cabinet.conf
git commit -m "feat: add nginx reverse proxy config for OVH"
```

---

## Task 3 : Créer le script de backup

**Contexte :** Ce script s'exécutera chaque nuit sur le VPS via cron. Il dump PostgreSQL dans un fichier gzippé, synchonise vers OVH Object Storage via rclone, puis supprime les anciens backups locaux.

**Files:**
- Create: `scripts/backup.sh`

- [ ] **Étape 1 : Créer le dossier `scripts/` et le fichier**

```bash
mkdir -p scripts
```

Contenu de `scripts/backup.sh` :
```bash
#!/bin/bash
set -e

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/backups
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

mkdir -p "$BACKUP_DIR"

echo "$LOG_PREFIX Début du backup PostgreSQL..."
docker exec cabinet_postgres pg_dump -U postgres cabinet_medical \
  | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"
echo "$LOG_PREFIX Backup créé : backup_$DATE.sql.gz"

echo "$LOG_PREFIX Synchronisation vers OVH Object Storage..."
rclone sync "$BACKUP_DIR" ovh-s3:cabinet-medical-backups/
echo "$LOG_PREFIX Synchronisation terminée."

echo "$LOG_PREFIX Suppression des backups locaux de plus de 7 jours..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "$LOG_PREFIX Backup terminé avec succès."
```

- [ ] **Étape 2 : Rendre le script exécutable et commiter**

```bash
chmod +x scripts/backup.sh
git add scripts/backup.sh
git commit -m "feat: add automated backup script for PostgreSQL + OVH Object Storage"
```

---

## Task 4 : Créer le workflow GitHub Actions

**Contexte :** À chaque push sur `master`, GitHub Actions se connecte en SSH au VPS OVH et exécute le déploiement. Les secrets (`OVH_HOST`, `OVH_USER`, `OVH_SSH_KEY`) sont configurés dans les Settings du repo GitHub (Task 8).

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Étape 1 : Créer le dossier et le workflow**

```bash
mkdir -p .github/workflows
```

Contenu de `.github/workflows/deploy.yml` :
```yaml
name: Deploy to OVH

on:
  push:
    branches: [master]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.OVH_HOST }}
          username: ${{ secrets.OVH_USER }}
          key: ${{ secrets.OVH_SSH_KEY }}
          script: |
            cd /opt/cabinet-medical-maroc
            git pull origin master
            docker compose up -d --build
            docker compose exec -T backend npx prisma migrate deploy
            echo "Déploiement terminé : $(date)"
```

- [ ] **Étape 2 : Commit et push**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add GitHub Actions deploy workflow for OVH"
git push origin master
```

---

## Task 5 : Provisionner le VPS OVH (étapes manuelles)

**Contexte :** Ces étapes se font dans l'espace client OVH et en SSH depuis ton Mac. Aucun fichier de code modifié — c'est la configuration du serveur.

- [ ] **Étape 1 : Commander le VPS OVH**

Sur https://www.ovhcloud.com/fr/vps/ :
- Choisir **VPS Starter** (2 vCPU, 2 GB RAM, 20 GB SSD NVMe)
- OS : **Ubuntu 22.04**
- Région : Gravelines (France) ou Roubaix
- Note l'IP publique reçue par email (ex: `51.XX.XX.XX`)

- [ ] **Étape 2 : Premier accès SSH et sécurisation root**

```bash
ssh root@<IP-OVH>
# Changer le mot de passe root
passwd
```

- [ ] **Étape 3 : Créer l'utilisateur `deploy`**

```bash
adduser deploy
# Entrer un mot de passe fort
usermod -aG sudo deploy
usermod -aG docker deploy 2>/dev/null || true  # sera ajouté après install Docker
```

- [ ] **Étape 4 : Installer Docker**

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Vérifier : `docker --version` et `docker compose version`

- [ ] **Étape 5 : Ajouter `deploy` au groupe Docker**

```bash
usermod -aG docker deploy
```

- [ ] **Étape 6 : Installer Nginx, Git et rclone**

```bash
apt-get install -y nginx git

# rclone
curl https://rclone.org/install.sh | bash
```

Vérifier : `nginx -v`, `git --version`, `rclone --version`

- [ ] **Étape 7 : Configurer la clé SSH pour l'utilisateur `deploy`**

Sur **ton Mac** (pas sur le serveur), générer une clé Ed25519 dédiée au déploiement :
```bash
ssh-keygen -t ed25519 -C "deploy@ovh" -f ~/.ssh/ovh_deploy
# Ne pas mettre de passphrase (GitHub Actions en a besoin)
```

Copier la clé publique sur le serveur :
```bash
ssh-copy-id -i ~/.ssh/ovh_deploy.pub deploy@<IP-OVH>
```

Tester la connexion :
```bash
ssh -i ~/.ssh/ovh_deploy deploy@<IP-OVH>
```

Attendu : connexion sans mot de passe.

- [ ] **Étape 8 : Configurer UFW (firewall)**

Sur le serveur :
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS (futur)
ufw --force enable
ufw status
```

Attendu : `Status: active`, 22/80/443 en `ALLOW`.

---

## Task 6 : Premier déploiement sur OVH

**Contexte :** Cloner le repo, créer le `.env` de production, lancer les containers, appliquer les migrations et le seed initial.

- [ ] **Étape 1 : Se connecter en tant que `deploy` et cloner le repo**

```bash
ssh deploy@<IP-OVH>
sudo mkdir -p /opt/cabinet-medical-maroc
sudo chown deploy:deploy /opt/cabinet-medical-maroc
git clone https://github.com/<ton-compte>/cabinet-medical-maroc.git /opt/cabinet-medical-maroc
cd /opt/cabinet-medical-maroc
```

- [ ] **Étape 2 : Créer le fichier `.env` de production**

```bash
cp .env.production.example .env
nano .env
```

Remplir toutes les valeurs :
- `POSTGRES_PASSWORD` : mot de passe fort (ex: générer avec `openssl rand -base64 32`)
- `DATABASE_URL` : reprendre le même mot de passe
- `JWT_SECRET` : `openssl rand -base64 48`
- `JWT_REFRESH_SECRET` : `openssl rand -base64 48`
- `CORS_ORIGIN` : `http://<IP-OVH>`
- `MINIO_ROOT_USER` : `minioadmin` (ou personnalisé)
- `MINIO_ROOT_PASSWORD` : mot de passe fort
- `NEXT_PUBLIC_API_URL` : `http://<IP-OVH>/api`

- [ ] **Étape 3 : Lancer les containers**

```bash
docker compose up -d --build
```

Attendu : tous les containers démarrent (`docker compose ps` → état `Up` ou `healthy`).

Surveiller les logs en cas de problème :
```bash
docker compose logs -f backend
```

- [ ] **Étape 4 : Appliquer les migrations et le seed**

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend node prisma/seed.js
```

Attendu : migrations appliquées, seed terminé sans erreur.

- [ ] **Étape 5 : Vérifier que le backend répond**

```bash
curl http://localhost:3001/api/health
```

Attendu : `{"status":"ok"}` (ou similaire).

---

## Task 7 : Configurer Nginx sur le VPS

**Contexte :** Nginx tourne sur le host, proxifie le trafic vers les containers Docker sur 127.0.0.1:3000 et 127.0.0.1:3001.

- [ ] **Étape 1 : Copier la config Nginx depuis le repo**

```bash
sudo cp /opt/cabinet-medical-maroc/nginx/cabinet.conf /etc/nginx/sites-available/cabinet
sudo ln -s /etc/nginx/sites-available/cabinet /etc/nginx/sites-enabled/cabinet
sudo rm -f /etc/nginx/sites-enabled/default
```

- [ ] **Étape 2 : Tester et recharger Nginx**

```bash
sudo nginx -t
```

Attendu : `syntax is ok` et `test is successful`

```bash
sudo systemctl reload nginx
```

- [ ] **Étape 3 : Vérifier depuis ton Mac**

```bash
curl http://<IP-OVH>/api/health
```

Attendu : `{"status":"ok"}`

```bash
curl -I http://<IP-OVH>/
```

Attendu : HTTP 200 (page frontend).

---

## Task 8 : Configurer les secrets GitHub Actions

**Contexte :** GitHub Actions a besoin des credentials SSH pour se connecter au VPS. Ces secrets sont ajoutés dans les Settings du repo GitHub et ne sont jamais exposés dans le code.

- [ ] **Étape 1 : Récupérer la clé privée SSH**

Sur ton Mac :
```bash
cat ~/.ssh/ovh_deploy
```

Copier tout le contenu (de `-----BEGIN OPENSSH PRIVATE KEY-----` à `-----END OPENSSH PRIVATE KEY-----` inclus).

- [ ] **Étape 2 : Ajouter les secrets dans GitHub**

Sur https://github.com/<ton-compte>/cabinet-medical-maroc/settings/secrets/actions :

Cliquer **New repository secret** pour chacun :

| Nom | Valeur |
|-----|--------|
| `OVH_HOST` | IP publique du VPS (ex: `51.XX.XX.XX`) |
| `OVH_USER` | `deploy` |
| `OVH_SSH_KEY` | Contenu complet de `~/.ssh/ovh_deploy` |

- [ ] **Étape 3 : Tester le workflow manuellement**

Sur https://github.com/<ton-compte>/cabinet-medical-maroc/actions :
- Vérifier que le dernier workflow (déclenché par le push de la Task 4) est **vert** ✅
- Si rouge, consulter les logs pour diagnostiquer

---

## Task 9 : Configurer les sauvegardes

**Contexte :** OVH propose un service Object Storage S3-compatible. Rclone est configuré avec les credentials OVH pour synchroniser les backups PostgreSQL quotidiennement.

- [ ] **Étape 1 : Créer un bucket Object Storage OVH**

Dans l'espace client OVH → Public Cloud → Object Storage :
- Créer un container (bucket) nommé `cabinet-medical-backups`
- Région : GRA (Gravelines) — même datacenter que le VPS
- Type : Standard

Récupérer les credentials S3 :
- Aller dans "Utilisateurs & Rôles" → créer un utilisateur S3
- Télécharger les credentials (Access Key + Secret Key)
- Récupérer aussi le endpoint S3 (ex: `s3.gra.cloud.ovh.net`)

- [ ] **Étape 2 : Configurer rclone sur le VPS**

Sur le VPS (en tant que `deploy`) :
```bash
rclone config
```

Choisir :
- `n` — New remote
- Nom : `ovh-s3`
- Type : `s3` (Amazon S3 Compliant)
- Provider : `Other`
- Access Key : (depuis les credentials OVH)
- Secret Key : (depuis les credentials OVH)
- Endpoint : `s3.gra.cloud.ovh.net` (ou selon la région choisie)
- Region : laisser vide
- Tout le reste : entrée (valeur par défaut)

Tester la connexion :
```bash
rclone ls ovh-s3:cabinet-medical-backups/
```

Attendu : aucune erreur (liste vide si bucket neuf).

- [ ] **Étape 3 : Installer le script de backup sur le VPS**

```bash
sudo cp /opt/cabinet-medical-maroc/scripts/backup.sh /opt/backup.sh
sudo chmod +x /opt/backup.sh
mkdir -p /opt/backups
```

- [ ] **Étape 4 : Tester le script manuellement**

```bash
/opt/backup.sh
```

Attendu : messages de log, fichier créé dans `/opt/backups/`, fichier visible dans le bucket OVH :
```bash
rclone ls ovh-s3:cabinet-medical-backups/
```

- [ ] **Étape 5 : Configurer le cron**

```bash
crontab -e
```

Ajouter la ligne :
```
0 2 * * * /opt/backup.sh >> /var/log/cabinet-backup.log 2>&1
```

Vérifier :
```bash
crontab -l
```

Attendu : la ligne `0 2 * * *` est présente.

---

## Task 10 : Valider le déploiement automatique end-to-end

**Contexte :** Vérifier que le pipeline complet fonctionne — un push sur master déclenche GitHub Actions qui redéploie sur OVH.

- [ ] **Étape 1 : Faire un push de test**

Sur ton Mac :
```bash
# Modifier un fichier mineur (ex: ajouter un commentaire dans CLAUDE.md)
echo "" >> CLAUDE.md
git add CLAUDE.md
git commit -m "chore: test auto-deploy pipeline"
git push origin master
```

- [ ] **Étape 2 : Vérifier l'exécution GitHub Actions**

Sur https://github.com/<ton-compte>/cabinet-medical-maroc/actions :
- Le workflow `Deploy to OVH` doit apparaître et passer au vert ✅
- Durée attendue : 2-4 minutes

- [ ] **Étape 3 : Vérifier que l'application est accessible**

```bash
curl http://<IP-OVH>/api/health
curl -I http://<IP-OVH>/
```

Les deux doivent répondre sans erreur.

- [ ] **Étape 4 : Annuler le commit de test**

```bash
git revert HEAD --no-edit
git push origin master
```

---

## Task 11 : Couper Vercel et Render

**Contexte :** Une fois le VPS OVH validé, désactiver les anciens services pour éviter de payer inutilement.

- [ ] **Étape 1 : Désactiver l'auto-deploy Vercel**

Sur https://vercel.com → Settings du projet → Git :
- Désactiver les déploiements automatiques
- (Optionnel) Supprimer le projet Vercel

- [ ] **Étape 2 : Désactiver le service Render**

Sur https://render.com → Dashboard :
- Suspendre (Suspend) le service backend
- Suspendre la base de données PostgreSQL
- (Optionnel) Supprimer les services après 7 jours de validation

- [ ] **Étape 3 : Mettre à jour CLAUDE.md avec les nouvelles URLs**

Dans `CLAUDE.md`, mettre à jour la section URLs :
```markdown
| Service | URL |
|---------|-----|
| Application | http://<IP-OVH> |
| API | http://<IP-OVH>/api |
| Swagger | http://<IP-OVH>/api/docs |
| Health check | http://<IP-OVH>/api/health |
```

```bash
git add CLAUDE.md
git commit -m "docs: update URLs after OVH migration"
git push origin master
```
