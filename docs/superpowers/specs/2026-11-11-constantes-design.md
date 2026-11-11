# Constantes médicales — conception

Date : 2026-11-11 · Branche : `feat/constantes`

## Objectif

Enregistrer les constantes d'un patient (tension, pouls, SpO2, température, poids, taille, IMC,
glycémie, périmètre crânien, tour de taille) à chaque visite, signaler les valeurs anormales et
montrer leur évolution en courbes dans la fiche patient.

La secrétaire peut prendre les constantes à l'arrivée du patient, avant la consultation ; le médecin
les retrouve et les complète dans son formulaire de consultation, ou les saisit lui-même.

Hors périmètre : courbes de croissance OMS (pédiatrie), import depuis un appareil connecté,
seuils propres à l'enfant ou à la grossesse.

## 1. Données : modèle `Constantes`

Nouveau modèle Prisma (table `constantes`), cloisonné par cabinet (ajout à `MODELES_CLOISONNES`) :

| Champ | Type | Unité | Bornes acceptées |
|---|---|---|---|
| `id` | uuid | | |
| `cabinetId` | String | | |
| `patientId` | String | | patient du cabinet (`ReferencesService.verifier`) |
| `consultationId` | String? | | consultation du même patient |
| `priseParId` | String | | utilisateur connecté (jamais envoyé par le client) |
| `datePrise` | DateTime | | défaut `now()` ; ni dans le futur (+5 min de tolérance), ni avant 1900 |
| `tensionSystolique` | Int? | mmHg | 50 – 260 |
| `tensionDiastolique` | Int? | mmHg | 30 – 160 |
| `pouls` | Int? | bpm | 20 – 250 |
| `spo2` | Int? | % | 50 – 100 |
| `temperature` | Float? | °C | 30 – 45 |
| `poids` | Float? | kg | 0,3 – 400 |
| `taille` | Float? | cm | 20 – 250 |
| `glycemie` | Float? | g/L | 0,1 – 6 |
| `perimetreCranien` | Float? | cm | 20 – 70 |
| `tourDeTaille` | Float? | cm | 30 – 250 |
| `createdAt`, `updatedAt` | DateTime | | |

Règles :
- Au moins une valeur de mesure par prise (sinon 400 « Aucune constante saisie »).
- Tension : systolique et diastolique vont ensemble (les deux ou aucune), et systolique > diastolique.
- Une consultation a au plus une prise rattachée (`consultationId` unique).
- L'IMC n'est pas stocké : il est calculé (poids / (taille en m)²) quand poids et taille sont dans
  la même prise. Si la prise n'a que le poids, l'IMC utilise la dernière taille connue du patient,
  et seulement si le patient a 18 ans ou plus.
- Index `(cabinetId, patientId, datePrise)`.

## 2. API `/constantes`

Tous les rôles du cabinet (`MEDECIN`, `SECRETAIRE`) ; `JwtAuthGuard` comme partout.

| Route | Rôle | Effet |
|---|---|---|
| `POST /constantes` | médecin, secrétaire | crée une prise ; `priseParId` = utilisateur connecté |
| `GET /constantes/patient/:patientId` | médecin, secrétaire | prises du patient, de la plus récente à la plus ancienne, avec `prisePar { prenom, nom, role }` |
| `GET /constantes/patient/:patientId/du-jour` | médecin, secrétaire | dernière prise du jour (heure de Casablanca, `journeeEnUtc()`) **sans consultation** rattachée : `{ prise }`, `prise` à `null` s'il n'y en a pas |
| `PATCH /constantes/:id` | voir ci-dessous | modifie les valeurs (DTO `PartialType`) ; mêmes contrôles qu'à la création |
| `DELETE /constantes/:id` | voir ci-dessous | supprime la prise (suppression réelle : une constante n'a pas d'historique à garder) |

Droits de modification et suppression : un `MEDECIN` toujours ; l'auteur de la prise le jour même
(heure de Casablanca). Sinon 403. Une prise d'un autre cabinet répond 404.

Rattachement à une consultation :
- `POST /consultations` accepte un champ `constantesId` optionnel : la prise est rattachée à la
  consultation dans la même transaction (contrôle : même patient, prise pas déjà rattachée ailleurs,
  sinon 400). L'application n'a pas d'écran de modification de consultation : `PATCH /consultations/:id`
  ne change pas.
- Le formulaire du médecin peut aussi créer directement une prise avec `consultationId`.

Audit : `CREATE_CONSTANTES`, `UPDATE_CONSTANTES`, `DELETE_CONSTANTES` via `AuditService.log`, comme pour
les autres données patient.

## 3. Valeurs anormales

Un seul fichier de seuils partagé, `backend/src/constantes/seuils.ts`, recopié côté frontend
(`frontend/src/lib/constantes/seuils.ts`) avec un test qui vérifie que les deux sont identiques.

Seuils adultes (patient de 18 ans ou plus) :

| Constante | Basse | Élevée |
|---|---|---|
| Tension | systolique < 90 ou diastolique < 60 | systolique ≥ 140 ou diastolique ≥ 90 |
| Pouls | < 50 | ≥ 100 |
| SpO2 | < 95 | — |
| Température | < 35,5 | ≥ 38 |
| Glycémie | < 0,7 | ≥ 1,26 |
| IMC | < 18,5 | ≥ 30 |

Niveau d'alerte : `attention` (orange) dès le seuil ; `critique` (rouge) pour tension systolique
≥ 180 ou diastolique ≥ 110, SpO2 < 90, température ≥ 40 ou < 35, glycémie < 0,5 ou ≥ 3, pouls < 40
ou ≥ 130. Une valeur « élevée » l'est dès le seuil (≥), une valeur « basse » sous le seuil (<).

Enfant (moins de 18 ans) : seules la température, la SpO2 et la glycémie sont évaluées (leurs seuils
ne dépendent pas de l'âge) ; tension, pouls et IMC sont affichés sans couleur.

Poids, taille, périmètre crânien et tour de taille : jamais d'alerte.

Notification au médecin :
- Quand une `SECRETAIRE` crée ou modifie une prise et qu'au moins une valeur est anormale, une
  `Notification` de type `CONSTANTES_ANORMALES` est créée, avec `patientId`, et le message
  « Constantes anormales — Prénom Nom : tension 160/100 mmHg élevée, température 39,5 °C élevée ».
- Destinataire : le médecin du rendez-vous du patient aujourd'hui (heure de Casablanca, statut non
  annulé) ; s'il n'y en a pas, tous les médecins actifs du cabinet.
- Une prise saisie par un médecin ne crée pas de notification.
- La cloche de notifications existante l'affiche ; un clic ouvre la fiche patient, onglet Constantes.

## 4. Frontend : saisie

Composant commun `components/constantes/FormulaireConstantes.tsx` :
- Champs numériques (`inputMode="decimal"`, pavé de chiffres sur mobile), groupés : Tension
  (deux champs « / »), Pouls, SpO2, Température, Poids, Taille, IMC (calculé, lecture seule),
  Glycémie, Périmètre crânien, Tour de taille. Unité affichée à droite de chaque champ.
- Virgule ou point acceptés comme séparateur décimal.
- Validation reprenant les bornes du §1 (fonctions pures de `lib/constantes/saisie.ts`, sans Zod :
  le formulaire est un composant contrôlé partagé) ; message en français sous le champ.
- À côté de chaque valeur saisie : pastille « élevée » / « basse » orange ou rouge, en direct.
- Grille `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, labels reliés aux champs (`htmlFor` / `id`),
  zones cliquables d'au moins 44 px sur mobile.

Deux points d'entrée :
1. **Fiche patient** : bouton « Prendre les constantes » (médecin et secrétaire) qui ouvre une
   modale (`useModale`) avec le formulaire ; enregistrement → prise sans consultation.
2. **Nouvelle consultation** : bloc « Constantes » au-dessus de
   « Examen clinique ». À l'ouverture, `GET …/du-jour` : si la secrétaire a déjà pris les constantes,
   elles sont pré-remplies avec la mention « prises à 9 h 12 par Fatima » ; le médecin peut les
   compléter. À l'enregistrement de la consultation :
   - prise du jour existante → `PATCH /constantes/:id` si modifiée, puis `constantesId` envoyé ;
   - sinon, si au moins une valeur est saisie → `POST /constantes` puis `constantesId` envoyé ;
   - bloc vide → rien.
   Le champ texte « Examen clinique » ne change pas.

## 5. Frontend : onglet « Constantes » de la fiche patient

Nouvel onglet entre « Consultations » et « Ordonnances » :
- **Dernières valeurs** : une carte par constante (valeur, date, couleur si anormale).
- **Courbe** : sélecteur de constante (Tension, Pouls, SpO2, Température, Poids, IMC, Glycémie,
  Périmètre crânien, Tour de taille) ; tension en deux lignes (systolique, diastolique) ; seuils
  dessinés en pointillés. Bibliothèque **Recharts** (nouvelle dépendance du frontend). Il faut au
  moins 2 mesures pour tracer ; sinon le message « Pas encore assez de mesures pour une courbe ».
- **Historique** : tableau (cartes empilées sur mobile) de toutes les prises : date, valeurs, prise
  par (prénom, rôle), lien vers la consultation si rattachée, actions Modifier / Supprimer selon
  les droits du §2.

Le détail d'une consultation (`/consultations/[id]`) affiche aussi la prise rattachée.

## 6. Erreurs

- Valeur hors bornes, tension incomplète ou incohérente, prise vide : 400 avec message français.
- Patient, consultation ou prise d'un autre cabinet : 404.
- Modification ou suppression non autorisée : 403 « Seul un médecin ou l'auteur de la prise, le jour
  même, peut la modifier ».
- L'échec de la création de la notification n'empêche pas l'enregistrement de la prise (journalisé).

## 7. Tests

Backend (`cabinet_test` uniquement) :
- unitaires : `seuils.ts` (chaque seuil, enfant / adulte, niveaux), calcul de l'IMC ;
- service : bornes, tension, prise vide, droits de modification (médecin, auteur le jour même,
  auteur le lendemain → 403), notification (secrétaire + anormal → médecin du RDV, sinon tous les
  médecins ; médecin → aucune) ;
- e2e : routes, isolation entre cabinets (404), rattachement à une consultation ;
- le test des modèles cloisonnés couvre `Constantes`.

Frontend (Jest + Testing Library) : formulaire (virgule, bornes, IMC calculé, pastilles), pré-remplissage
dans la consultation, onglet (dernières valeurs, message « pas assez de mesures »).

Tests de nuit (`e2e/`) : étape « Constantes » dans le parcours 3 (modale depuis la fiche patient,
contrôle de l'écran) et dans le parcours 5 (bloc constantes de la consultation), plus une capture de
l'onglet Constantes ; `FICHIERS` du rapport complété.
