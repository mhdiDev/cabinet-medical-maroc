#!/bin/bash
# Backup quotidien : dump PostgreSQL + documents MinIO, copiés vers OVH Object Storage.
# Installé sur le VPS dans /opt/backup.sh, lancé par cron à 02h00 (utilisateur deploy).
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/backups
REMOTE=ovh-s3:cabinet-medical-backups/

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

mkdir -p "$BACKUP_DIR"

log "Début du backup PostgreSQL..."
docker exec cabinet_postgres pg_dump -U postgres cabinet_medical \
  | gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"
log "Backup créé : backup_$DATE.sql.gz"

log "Archive des documents MinIO..."
docker run --rm --volumes-from cabinet_minio alpine tar czf - -C /data . \
  > "$BACKUP_DIR/minio_$DATE.tar.gz"
log "Archive créée : minio_$DATE.tar.gz"

# copy (et non sync) : la purge locale à 7 jours ne doit pas supprimer les copies distantes,
# dont la rétention (30 jours) est gérée par la lifecycle policy du bucket.
log "Copie vers OVH Object Storage..."
rclone copy "$BACKUP_DIR" "$REMOTE" --include "*.gz"
log "Copie terminée."

log "Suppression des backups locaux de plus de 7 jours..."
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
log "Backup terminé avec succès."
