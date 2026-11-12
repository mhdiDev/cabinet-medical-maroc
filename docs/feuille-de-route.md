# Feuille de route — fonctions manquantes

Bilan du 2026-11-11 : comparaison avec les logiciels de cabinet courants (Doctolib en France, DabaDoc au Maroc,
logiciels de dossier médical). Classé du plus utile au moins urgent. Établi d'après la connaissance de ces
logiciels, sans nouvelle recherche sur internet.

## Ce que l'application a déjà

Patients, agenda, consultations, ordonnances en PDF avec la base des médicaments CNOPS, caisse avec rapports
et export Excel, stock, documents, notifications, plusieurs cabinets et plusieurs rôles, journal des actions.

## Ce qui manque

### 1. Indispensable au Maroc

- [ ] **Feuille de soins AMO pré-remplie (CNOPS, CNSS)** : ce que les patients assurés demandent à chaque
  visite. Aujourd'hui, on enregistre seulement si le patient est assuré.
- [ ] **Rappels de rendez-vous par SMS ou WhatsApp**, la veille ou le jour même : le moyen le plus efficace
  contre les patients qui ne viennent pas.
- [ ] **Sauvegardes automatiques vérifiées** : le script existe (`scripts/backup.sh`), mais il ne tourne pas
  encore en production. Aucune donnée réelle ne doit entrer sans ça.

### 2. Les papiers du quotidien (seule l'ordonnance existe)

- [ ] Certificat médical, arrêt de travail, lettre à un confrère, compte rendu de consultation.
- [ ] Reçu ou note d'honoraires en PDF pour le patient.
- [ ] Modèles d'ordonnance et favoris (« mon traitement angine habituel »), pour prescrire en un clic.

### 3. Un dossier médical plus riche

- [ ] **Constantes à chaque visite** (tension, poids, taille, IMC, température, glycémie), avec des courbes
  d'évolution — *réalisé le 2026-11-12, branche `feat/constantes` (à fusionner)*.
- [ ] Antécédents rangés par catégorie (médicaux, chirurgicaux, familiaux, traitements en cours) au lieu d'un
  seul texte libre.
- [ ] Vaccinations, et suivi propre à chaque spécialité (grossesse, croissance des enfants…).
- [ ] Résultats d'analyses et d'imagerie rattachés à la consultation.
- [ ] Alerte allergie à la prescription, et si possible les interactions entre médicaments (déjà prévue).

### 4. Le fonctionnement du cabinet

- [ ] **Salle d'attente du jour** : patient arrivé, en consultation, parti. La secrétaire et le médecin voient
  la même liste.
- [ ] Agenda pour plusieurs médecins, avec le choix du médecin (déjà prévu), plus les congés, les créneaux
  bloqués et les rendez-vous qui se répètent.
- [ ] Statistiques : patients nouveaux ou revenus, motifs fréquents, recettes par acte et par médecin.

### 5. Plus tard, pour se démarquer

- [ ] Prise de rendez-vous en ligne par le patient (le cœur de DabaDoc).
- [ ] Espace patient : ordonnances et rendez-vous sur son téléphone.
- [ ] Interface en arabe, au moins pour les documents remis au patient.
- [ ] Téléconsultation.

## Ordre conseillé

Commencer par les constantes, les certificats et la salle d'attente : ce sont les manques que le médecin et
la secrétaire remarquent tous les jours, et ils ne dépendent d'aucun service extérieur. Les rappels SMS et la
feuille AMO viennent juste après, mais demandent un prestataire SMS et le formulaire officiel de la caisse.
