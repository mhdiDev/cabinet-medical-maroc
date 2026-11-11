# Recherche de patient sur la page d'accueil — conception

Date : 2026-11-11 · Branche : `feat/recherche-patient-accueil`

## Objectif

Dès sa connexion, le médecin retrouve un patient depuis la page d'accueil (`/dashboard`) :
par nom, prénom, téléphone ou date de consultation, puis ouvre sa fiche ou démarre une
consultation. Le chantier corrige aussi le point 4 du test UX (patient non pré-rempli dans
`/consultations/nouvelle?patientId=`), sans quoi le raccourci « + Consultation » ne servirait à rien.

Hors périmètre : raccourci « + RDV » (viendra avec la correction de l'agenda, point 2),
alerte allergie (point 1), recherche insensible aux accents (demanderait l'extension `unaccent`
et du SQL brut, interdit par le client filtré), recherche par CIN (colonne supprimée en 2026-06).

Aucune migration de base.

## 1. Backend : `GET /patients`

`SearchPatientDto` gagne un champ `date` optionnel (`@Matches(/^\d{4}-\d{2}-\d{2}$/)` + date
réelle vérifiée, sinon 400 « Date invalide »). `q` reçoit `@NettoyerTexte()` et une longueur
maximale de 100.

### Texte (`q`)

- Le texte est découpé en mots (espaces). Chaque mot doit correspondre (ET) à `nom` OU
  `prenom` (contient, insensible à la casse) OU `telephone`. « Ahmed Tazi » et « Tazi Ahmed »
  trouvent le même patient.
- Téléphone : on retire les espaces, points et tirets du texte avant de le comparer à
  `telephone` (stocké sans séparateur, ex. `0612345678`). « 06 12 34 » trouve `0612345678` :
  si le texte entier, sans séparateurs, ne contient que des chiffres, il est cherché comme un
  seul fragment de téléphone (à la place de la règle par mot, plus précise).

### Date (`date`, format `AAAA-MM-JJ`)

- Filtre `consultations: { some: { dateConsultation: { gte: debut, lt: fin } } }`, où
  `[debut, fin[` est la journée civile **dans le fuseau `Africa/Casablanca`**, convertie en UTC.
- Le calcul passe par une fonction pure `journeeEnUtc(date: string, fuseau: string)`
  (`common/dates/journee.ts`) basée sur `Intl.DateTimeFormat` (pas de décalage codé en dur :
  le Maroc passe à UTC+0 pendant le Ramadan). Le fuseau est une constante
  `FUSEAU_CABINET = 'Africa/Casablanca'`, qui deviendra un réglage du cabinet avec le point 2.
- Avec une date, chaque patient renvoyé porte `consultationsDuJour` :
  `[{ id, dateConsultation, medecin: { nom, prenom } }]`, triées par heure.
  Sans date, le champ est absent (réponse inchangée pour la page Patients).
- `q` et `date` se combinent (ET).

Le client filtré n'ajoute le cabinet qu'aux opérations de premier niveau : le filtre et la
sélection des consultations du jour portent donc explicitement `cabinetId: cabinetCourant()` ;
un test e2e le vérifie avec une consultation d'un autre cabinet rattachée à un patient du cabinet.

Le filtre `?date=` existant de `/consultations` (bornes à l'heure du serveur) n'est pas
modifié ici : il relève du point 2.

## 2. Frontend : barre de recherche de l'accueil

Nouveau composant `components/dashboard/RecherchePatient.tsx`, placé sous « Bonjour, Dr … ».
Il est affiché pour tous les rôles qui arrivent sur l'accueil (médecin et secrétaire).

### Lecture de la saisie

Fonction pure `analyserRecherche(texte)` (`components/dashboard/analyser-recherche.ts`) :

| Saisie | Résultat |
|--------|----------|
| `tazi` | `{ q: 'tazi' }` |
| `10/11/2026` (ou `10-11-2026`, `10.11.2026`) | `{ date: '2026-11-10' }` |
| `tazi 10/11/2026` | `{ q: 'tazi', date: '2026-11-10' }` |
| `10/11`, `10/11/20` (date en cours de frappe : contient `/` mais pas de date complète) | `{ aide: 'Date au format JJ/MM/AAAA' }` |
| `31/02/2026` | `{ erreur: 'Date invalide' }` |
| moins de 2 caractères en tout | rien (pas de requête) |

Un seul jeton date est reconnu (JJ/MM/AAAA, séparateurs `/`, `-` ou `.`) ; le reste du texte
forme `q`. Un téléphone saisi avec des tirets (`06-12-34`) n'est pas une date : il faut
3 parties et une année à 4 chiffres pour parler de date.

### Comportement

- Placeholder : « Nom, prénom, téléphone ou date (JJ/MM/AAAA) ».
- Requête `GET /patients?q=&date=&limit=8` après 300 ms sans frappe ; indicateur de chargement.
- Liste sous la barre, 8 résultats maximum. Chaque ligne : « Prénom Nom · âge · téléphone ».
  En recherche par date : titre « Patients vus le JJ/MM/AAAA » et, par ligne, les heures (HH:mm)
  et le médecin de chaque consultation du jour (« 09:30 · Dr Benali »).
- Clic sur la ligne → `/patients/:id`. Bouton « + Consultation » (rôle `MEDECIN` seulement)
  → `/consultations/nouvelle?patientId=:id`.
- Clavier : ↑/↓ parcourent les lignes, Entrée ouvre la fiche de la ligne active, Échap ferme
  la liste. Rôle `combobox` / `listbox` pour les lecteurs d'écran.
- Aucun résultat : « Aucun patient trouvé » + lien « Créer un patient » (`/patients/nouveau`).
- Plus de 8 résultats (`meta.total > 8`) : lien « Voir tous les résultats (N) » vers
  `/patients?q=…&date=…`. La page Patients lit ces paramètres au chargement et les passe à
  l'API ; elle affiche alors la date filtrée avec un bouton pour la retirer.
- Clic hors de la liste : elle se ferme.
- Erreur réseau : « Recherche impossible, réessayez ».

## 3. Correction du point 4 : `/consultations/nouvelle?patientId=`

**Cause** : le patient est chargé par `useQuery({ …, onSuccess })`. React Query v5 a supprimé
`onSuccess` de `useQuery` ; le cast `as any` masquait l'erreur de type. Le patient est donc
chargé mais jamais placé dans `selectedPatient`.

**Correction** :
- Lire la donnée de la requête et la placer dans `selectedPatient` via un `useEffect`
  (une seule fois, sans écraser un choix manuel ultérieur), sans `as any`.
- Pendant le chargement : la carte patient affiche « Chargement du patient… ».
- Identifiant invalide ou inconnu (404/400) : champ de recherche affiché avec le message
  discret « Patient introuvable, recherchez-le ci-dessous ».
- « ← Retour » : `router.back()` s'il y a une page précédente dans l'onglet (`history.length > 1`), sinon
  fiche du patient sélectionné, sinon `/patients`. (Les deux liens « Retour » de la page sont
  concernés.)

## 4. Tests

Backend :
- unitaires `journeeEnUtc` : jour normal (UTC+1), jour de Ramadan (UTC+0), jours de
  changement d'heure (avant / après le Ramadan) ;
- e2e `GET /patients` : « Ahmed Tazi » et « Tazi Ahmed » ; téléphone « 06 12 34 » ;
  date seule ; nom + date ; consultations à 00:30 et 23:30 heure de Casablanca rangées au
  bon jour ; jour de Ramadan ; date invalide → 400 ; patient et consultation d'un autre
  cabinet absents ; sans date, pas de `consultationsDuJour`.

Frontend (jest) :
- `analyserRecherche` : tous les cas du tableau ;
- `RecherchePatient` : affichage des résultats, navigation clavier, bouton
  « + Consultation » masqué pour la secrétaire, message « Aucun patient trouvé » ;
- page nouvelle consultation : patient pré-rempli depuis l'URL, patient introuvable.

Vérifications : tests unitaires et e2e backend (base `cabinet_test`), jest frontend,
`npx tsc --noEmit` (pas de nouvelle erreur), `next build`.
