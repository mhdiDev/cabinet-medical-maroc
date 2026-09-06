# Migration OVH — Design Spec

> **For agentic workers:** Use `superpowers:writing-plans` to create the implementation plan from this spec.

**Goal:** Migrer l'application cabinet médical de Vercel/Render vers un VPS OVH auto-hébergé avec déploiement automatique via GitHub Actions et sauvegardes quotidiennes vers OVH Object Storage.

---

## Architecture cible

```
Internet
    │
    ▼
[OVH VPS Ubuntu 22.04 — VPS Starter ~€6/mois]
    │
[Nginx :80] ← reverse proxy
    ├── /          → Frontend Next.js (container :3000)
    └── /api       → Backend NestJS  (container :3001)

[PostgreSQL 16 container :5432]  ← données patients
[MinIO container :9000/:9001]    ← fichiers/ordonnances PDF
```

Tout tourne dans Docker Compose sur un seul VPS. Nginx est le seul point d'entrée public.

**HTTPS :** non configuré pour l'instant (IP publique + HTTP). Peut être ajouté avec Let's Encrypt dès qu'un domaine est associé.

---

## Composants

### 1. VPS OVH

- Plan : VPS Starter (2 vCPU, 2 GB RAM, 20 GB SSD)
- OS : Ubuntu 22.04 LTS
- Packages installés : `docker`, `docker-compose-plugin`, `nginx`, `git`, `rclone`
- Utilisateur non-root `deploy` avec accès Docker et sudo limité

### 2. Docker Compose production

Le `docker-compose.yml` existant est utilisé tel quel, avec les ajustements suivants :
- Variables d'environnement via fichier `.env` sur le serveur (jamais commité)
- `CORS_ORIGIN` pointe vers l'IP publique OVH
- `NEXT_PUBLIC_API_URL` pointe vers `http://<IP>/api`
- `restart: unless-stopped` sur tous les services

### 3. Nginx reverse proxy

Fichier `/etc/nginx/sites-available/cabinet` :
```nginx
server {
    listen 80;
    server_name _;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. GitHub Actions — deploy automatique

Fichier `.github/workflows/deploy.yml` :

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
```

**Secrets GitHub à configurer :**
| Secret | Valeur |
|--------|--------|
| `OVH_HOST` | IP publique du VPS |
| `OVH_USER` | `deploy` |
| `OVH_SSH_KEY` | Clé privée SSH (Ed25519) |

### 5. Sauvegardes automatiques

Script `/opt/backup.sh` exécuté par cron chaque nuit à 02h00 :

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
BACKUP_DIR=/opt/backups

# Dump PostgreSQL
docker exec cabinet_postgres pg_dump -U postgres cabinet_medical \
  | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Sync vers OVH Object Storage via rclone
rclone sync $BACKUP_DIR ovh-s3:cabinet-medical-backups/

# Supprimer les backups locaux > 7 jours
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
```

Cron entry (`crontab -e` pour l'utilisateur `deploy`) :
```
0 2 * * * /opt/backup.sh >> /var/log/cabinet-backup.log 2>&1
```

**Rétention :**
- Local : 7 jours
- OVH Object Storage : 30 jours (lifecycle policy)

### 6. Variables d'environnement production

Fichier `/opt/cabinet-medical-maroc/.env` sur le serveur (non commité) :

```env
# PostgreSQL
POSTGRES_PASSWORD=<mot-de-passe-fort>
DATABASE_URL=postgresql://postgres:<mot-de-passe-fort>@postgres:5432/cabinet_medical

# JWT
JWT_SECRET=<secret-fort-64-chars>
JWT_REFRESH_SECRET=<secret-fort-64-chars>

# CORS — IP publique OVH
CORS_ORIGIN=http://<IP-OVH>

# MinIO
MINIO_ROOT_USER=<user>
MINIO_ROOT_PASSWORD=<mot-de-passe-fort>
MINIO_ACCESS_KEY=<user>
MINIO_SECRET_KEY=<mot-de-passe-fort>

# Frontend
NEXT_PUBLIC_API_URL=http://<IP-OVH>/api
```

---

## Plan de migration

1. **Provisionner le VPS OVH** — commande, accès SSH initial
2. **Configurer le serveur** — Docker, Nginx, utilisateur `deploy`, clé SSH
3. **Cloner le repo** — `/opt/cabinet-medical-maroc`, fichier `.env`
4. **Premier déploiement manuel** — `docker compose up -d`, migrations, seed
5. **Configurer GitHub Actions** — workflow + secrets
6. **Configurer les sauvegardes** — rclone, Object Storage, cron
7. **Vérifier le déploiement auto** — push test sur master
8. **Couper Vercel et Render** — désactiver après validation

---

## Modifications minimales au docker-compose.yml

Le `docker-compose.yml` actuel a des secrets codés en dur. Il faut les remplacer par des références à `.env` :

```yaml
# Avant (hardcodé)
POSTGRES_PASSWORD: password

# Après (via .env)
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

Variables à externaliser : `POSTGRES_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MINIO_ROOT_PASSWORD`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`.

---

## Ce qui ne change pas

- Code source applicatif : aucune modification
- Workflow git : `git push origin master` déclenche toujours le deploy
- Prisma migrations : toujours appliquées automatiquement au démarrage

---

## Hors scope

- HTTPS / Let's Encrypt (nécessite un domaine — prévu ultérieurement)
- Monitoring / alertes (UptimeRobot peut continuer à pinger l'IP)
- Multi-serveur / load balancing
