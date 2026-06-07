# Gestion des rôles & Upload de fichiers

> Notes à implémenter en local.

## 1. Restrictions rôle Secrétaire

- La secrétaire **ne peut pas** créer de consultation
- La secrétaire **ne peut pas** créer d'ordonnance
- Ces actions restent réservées au rôle MEDECIN (et ADMIN)

### Où implémenter
- Backend : ajouter `@Roles(Role.ADMIN, Role.MEDECIN)` sur les endpoints `POST /consultations` et `POST /ordonnances`
- Frontend : masquer les boutons "Nouvelle consultation" et "Nouvelle ordonnance" si `user.role === 'SECRETAIRE'`

---

## 2. Notification secrétaire après consultation finalisée

- Quand un médecin **finalise** une consultation (statut → `TERMINEE` ou équivalent), la secrétaire reçoit une notification pour encaisser le patient
- La notification doit indiquer : nom du patient + montant à encaisser si disponible

### Où implémenter
- Backend : dans le service `ConsultationsService.update()`, émettre un événement (ex: via `EventEmitter2`) quand le statut passe à `TERMINEE`
- Créer un module `NotificationsModule` (WebSocket avec `@nestjs/websockets` ou polling)
- Frontend : ajouter un badge/cloche de notification dans le layout pour le rôle SECRETAIRE, avec lien vers la caisse (`/paiements/nouveau?patientId=...`)

---

## 3. Upload de fichiers dans les dossiers patients

- Possibilité d'uploader des **images** (JPG, PNG) et **PDF** dans le dossier d'un patient
- Les fichiers sont stockés dans **MinIO** (déjà configuré)
- Modèle `Document` déjà présent dans le schéma Prisma

### Où implémenter
- Backend :
  - Endpoint `POST /documents/upload` avec `Multer` + `MinioService`
  - Endpoint `GET /documents/patient/:patientId`
  - Endpoint `DELETE /documents/:id`
  - Lier chaque `Document` à un `patientId` + stocker l'URL MinIO + le type MIME
- Frontend :
  - Onglet "Documents" dans la fiche patient (`/patients/[id]`)
  - Composant drag-and-drop ou bouton upload
  - Visionneuse inline pour les images, lien de téléchargement pour les PDF

---

## Ordre d'implémentation suggéré

1. Restrictions rôles (le plus rapide, ~1h)
2. Upload fichiers (MinIO déjà prêt, ~3-4h)
3. Notifications (le plus complexe, ~1 jour)
