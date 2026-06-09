# Spec — Tests unitaires & API : Cabinet Médical Maroc

**Date :** 2026-06-10
**Statut :** approuvé

---

## Contexte

Le projet dispose déjà de Jest configuré (backend + frontend) et d'un workflow GitHub Actions, mais :
- Le workflow cible la branche `main` alors que le projet utilise `master` → les tests ne s'exécutent jamais en CI
- Deux spec files existent (`auth.service.spec.ts`, `patients.service.spec.ts`) avec des références obsolètes au champ `cin` supprimé
- Aucun test frontend, aucun test API (Supertest)

## Objectif

Mettre en place une suite de tests fiable qui :
1. Tourne à chaque push sur `master` via GitHub Actions
2. Bloque le déploiement Render en cas d'échec
3. Est maintenue à chaque nouveau développement

## Périmètre

Modules critiques : `auth`, `patients`, `consultations`, `paiements`, `ordonnances`

---

## Architecture des tests

### Double couche

| Couche | Outil | Base de données | Vitesse |
|--------|-------|-----------------|---------|
| Tests unitaires | Jest + mocks Prisma | Aucune | ~30s |
| Tests API | Supertest + NestJS réel | PostgreSQL `cabinet_test` | ~2min |

### Structure des fichiers

```
backend/
├── src/
│   ├── auth/auth.service.spec.ts                  (unit — corrigé)
│   ├── patients/patients.service.spec.ts           (unit — corrigé)
│   ├── consultations/consultations.service.spec.ts (unit — nouveau)
│   ├── paiements/paiements.service.spec.ts         (unit — nouveau)
│   └── ordonnances/ordonnances.service.spec.ts     (unit — nouveau)
└── test/
    ├── setup.ts                                    (reset DB + token JWT)
    ├── auth.e2e-spec.ts
    ├── patients.e2e-spec.ts
    ├── consultations.e2e-spec.ts
    ├── paiements.e2e-spec.ts
    └── ordonnances.e2e-spec.ts
```

---

## Tests unitaires — cas couverts par module

### auth.service.spec.ts
- `validateUser` : identifiants corrects → retourne user sans motDePasse
- `validateUser` : mauvais mot de passe → retourne null
- `validateUser` : utilisateur inactif → retourne null
- `login` : identifiants invalides → lève `UnauthorizedException`

### patients.service.spec.ts
- `create` : succès → appelle prisma.create + audit.log
- `create` : téléphone déjà existant → lève `ConflictException`
- `findOne` : patient existant → retourne objet complet
- `findOne` : patient inexistant → lève `NotFoundException`
- `exportCsv` : génère un CSV avec les bons champs (sans `cin`)

### consultations.service.spec.ts
- `create` : succès → retourne consultation créée
- `findByPatient` : retourne la liste des consultations du patient
- `findOne` : consultation inexistante → lève `NotFoundException`

### paiements.service.spec.ts
- `create` : succès → retourne paiement créé
- `caisse` : retourne les paiements du jour avec total et parType
- `rapport` : retourne les paiements sur une période avec total
- `exportExcel` : retourne un buffer (pas d'erreur de type)

### ordonnances.service.spec.ts
- `create` : succès → retourne ordonnance créée
- `findByPatient` : retourne la liste des ordonnances du patient
- `findOne` : ordonnance inexistante → lève `NotFoundException`

---

## Tests API — cas couverts par module

### Stratégie commune
- Un token JWT admin est généré une fois par fichier via `POST /auth/login`
- La DB est remise à zéro (truncate + seed minimal) avant chaque fichier de test
- Chaque test vérifie : status HTTP + structure JSON + cas d'erreur

### auth.e2e-spec.ts
| Route | Cas |
|-------|-----|
| `POST /auth/login` | 200 avec accessToken + refreshToken |
| `POST /auth/login` | 401 si mauvais mot de passe |
| `GET /auth/me` | 200 avec token valide |
| `GET /auth/me` | 401 sans token |
| `POST /auth/refresh` | 200 avec nouveau accessToken |

### patients.e2e-spec.ts
| Route | Cas |
|-------|-----|
| `POST /patients` | 201 avec body valide |
| `POST /patients` | 400 si champ obligatoire manquant |
| `POST /patients` | 401 sans token |
| `GET /patients` | 200 avec pagination (page, limit) |
| `GET /patients/:id` | 200 avec patient existant |
| `GET /patients/:id` | 404 si patient inexistant |
| `PATCH /patients/:id` | 200 mise à jour partielle |
| `DELETE /patients/:id` | 200 ou 204 |

### consultations.e2e-spec.ts
| Route | Cas |
|-------|-----|
| `POST /consultations` | 201 avec patientId valide |
| `POST /consultations` | 400 si patientId manquant |
| `GET /consultations/patient/:id` | 200 liste des consultations |
| `GET /consultations?date=YYYY-MM-DD` | 200 filtrée par date |
| `GET /consultations/:id` | 404 si inexistant |

### paiements.e2e-spec.ts
| Route | Cas |
|-------|-----|
| `POST /paiements` | 201 avec montant valide |
| `GET /paiements/caisse` | 200 avec total et parType |
| `GET /paiements/caisse?date=YYYY-MM-DD` | 200 pour une date spécifique |
| `GET /paiements/rapport?debut=&fin=` | 200 avec total et count |
| `GET /paiements/export?debut=&fin=&assurance=tous` | 200 buffer Excel |

### ordonnances.e2e-spec.ts
| Route | Cas |
|-------|-----|
| `POST /ordonnances` | 201 avec patientId valide |
| `GET /ordonnances/patient/:id` | 200 liste des ordonnances |
| `GET /ordonnances/:id` | 200 avec ordonnance existante |
| `GET /ordonnances/:id/pdf` | 200 buffer PDF |
| `GET /ordonnances/:id` | 404 si inexistant |

---

## CI/CD — GitHub Actions

### Corrections apportées
- Branche `main` → `master` dans tous les triggers
- Ajout du job `api-tests` avec PostgreSQL en service

### Workflow final

```
push/PR sur master
  ├── unit-tests      Jest mocks, pas de DB (~30s)
  ├── api-tests       Supertest + PostgreSQL (~2min)
  ├── frontend-lint   ESLint + build Next.js
  └── docker-build    Vérification image Docker (master seulement)
```

`api-tests` dépend de `unit-tests` (séquentiel pour fail-fast).
`docker-build` dépend de `api-tests` + `frontend-lint`.

---

## Règle de maintenance

À chaque nouveau développement, appliquer la règle suivante :

| Action | Fichier(s) à mettre à jour |
|--------|---------------------------|
| Nouveau champ sur un modèle | Mettre à jour les mocks dans `<module>.service.spec.ts` |
| Nouvelle route | Ajouter un cas dans `test/<module>.e2e-spec.ts` |
| Champ supprimé | Supprimer les références dans les deux types de tests |
| Nouveau module critique | Créer `<module>.service.spec.ts` + `test/<module>.e2e-spec.ts` |
| Changement de validation DTO | Ajouter un cas 400 dans le test API |
| Nouveau guard/rôle | Ajouter un cas 403 dans le test API concerné |

---

## Hors périmètre

- Tests E2E navigateur (Playwright/Cypress) — non requis
- Tests des modules secondaires (`stock`, `rapports`, `notifications`, `medicaments`) — à ajouter ultérieurement
- Tests de performance/charge
- Tests frontend (composants React)
