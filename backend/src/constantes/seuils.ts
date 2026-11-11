// backend/src/constantes/seuils.ts
// Constantes médicales : champs, bornes de saisie et seuils d'alerte.
// Fichier identique dans backend/src/constantes/seuils.ts et frontend/src/lib/constantes/seuils.ts :
// un test du backend vérifie que les deux copies ne divergent pas. Aucun import.

export const CHAMPS = {
  tensionSystolique: {
    libelle: 'Tension haute (systolique)',
    unite: 'mmHg',
    min: 50,
    max: 260,
    entier: true,
  },
  tensionDiastolique: {
    libelle: 'Tension basse (diastolique)',
    unite: 'mmHg',
    min: 30,
    max: 160,
    entier: true,
  },
  pouls: { libelle: 'Pouls', unite: 'bpm', min: 20, max: 250, entier: true },
  spo2: { libelle: 'SpO2', unite: '%', min: 50, max: 100, entier: true },
  temperature: { libelle: 'Température', unite: '°C', min: 30, max: 45, entier: false },
  poids: { libelle: 'Poids', unite: 'kg', min: 0.3, max: 400, entier: false },
  taille: { libelle: 'Taille', unite: 'cm', min: 20, max: 250, entier: false },
  glycemie: { libelle: 'Glycémie', unite: 'g/L', min: 0.1, max: 6, entier: false },
  perimetreCranien: { libelle: 'Périmètre crânien', unite: 'cm', min: 20, max: 70, entier: false },
  tourDeTaille: { libelle: 'Tour de taille', unite: 'cm', min: 30, max: 250, entier: false },
} as const;

export type ChampMesure = keyof typeof CHAMPS;
export const CHAMPS_MESURE = Object.keys(CHAMPS) as ChampMesure[];
export type ValeursConstantes = Partial<Record<ChampMesure, number | null>>;

// « haute » et « critiqueHaute » : alerte dès le seuil (≥) ; « basse » et « critiqueBasse » : sous le seuil (<)
export interface Seuil {
  basse?: number;
  critiqueBasse?: number;
  haute?: number;
  critiqueHaute?: number;
}

export type CleSeuil =
  | 'tensionSystolique'
  | 'tensionDiastolique'
  | 'pouls'
  | 'spo2'
  | 'temperature'
  | 'glycemie'
  | 'imc';

// Seuils adultes
export const SEUILS: Record<CleSeuil, Seuil> = {
  tensionSystolique: { basse: 90, haute: 140, critiqueHaute: 180 },
  tensionDiastolique: { basse: 60, haute: 90, critiqueHaute: 110 },
  pouls: { basse: 50, haute: 100, critiqueBasse: 40, critiqueHaute: 130 },
  spo2: { basse: 95, critiqueBasse: 90 },
  temperature: { basse: 35.5, haute: 38, critiqueBasse: 35, critiqueHaute: 40 },
  glycemie: { basse: 0.7, haute: 1.26, critiqueBasse: 0.5, critiqueHaute: 3 },
  imc: { basse: 18.5, haute: 30 },
};

// Seuils valables à tout âge ; les autres ne s'appliquent qu'à partir de 18 ans
const TOUT_AGE: CleSeuil[] = ['spo2', 'temperature', 'glycemie'];

export type CleAlerte = 'tension' | 'pouls' | 'spo2' | 'temperature' | 'glycemie' | 'imc';
export type Sens = 'basse' | 'elevee';
export type Niveau = 'attention' | 'critique';

export interface AlerteConstante {
  cle: CleAlerte;
  sens: Sens;
  niveau: Niveau;
  etat: string; // « élevée », « bas »…
  texte: string; // « tension 160/100 mmHg élevée »
}

interface Classement {
  sens: Sens;
  niveau: Niveau;
}

function classer(valeur: number, s: Seuil): Classement | null {
  if (s.critiqueHaute !== undefined && valeur >= s.critiqueHaute)
    return { sens: 'elevee', niveau: 'critique' };
  if (s.critiqueBasse !== undefined && valeur < s.critiqueBasse)
    return { sens: 'basse', niveau: 'critique' };
  if (s.haute !== undefined && valeur >= s.haute) return { sens: 'elevee', niveau: 'attention' };
  if (s.basse !== undefined && valeur < s.basse) return { sens: 'basse', niveau: 'attention' };
  return null;
}

function plusGrave(a: Classement | null, b: Classement | null): Classement | null {
  if (!a) return b;
  if (!b) return a;
  if (a.niveau !== b.niveau) return a.niveau === 'critique' ? a : b;
  return a.sens === 'elevee' ? a : b;
}

const fr = (n: number) => String(n).replace('.', ',');

type ValeursEvaluees = ValeursConstantes & { imc?: number | null };

const PRESENTATION: Record<CleAlerte, { feminin: boolean; texte: (v: ValeursEvaluees) => string }> =
  {
    tension: {
      feminin: true,
      texte: (v) => `tension ${v.tensionSystolique}/${v.tensionDiastolique} mmHg`,
    },
    pouls: { feminin: false, texte: (v) => `pouls ${v.pouls} bpm` },
    spo2: { feminin: true, texte: (v) => `SpO2 ${v.spo2} %` },
    temperature: { feminin: true, texte: (v) => `température ${fr(v.temperature as number)} °C` },
    glycemie: { feminin: true, texte: (v) => `glycémie ${fr(v.glycemie as number)} g/L` },
    imc: { feminin: false, texte: (v) => `IMC ${fr(v.imc as number)}` },
  };

const estNombre = (n: number | null | undefined): n is number => typeof n === 'number';

/** Valeurs anormales d'une prise, pour un patient de l'âge donné (en années) */
export function evaluerConstantes(v: ValeursEvaluees, age: number): AlerteConstante[] {
  const applicable = (c: CleSeuil) => age >= 18 || TOUT_AGE.includes(c);
  const resultats: [CleAlerte, Classement | null][] = [];

  if (
    estNombre(v.tensionSystolique) &&
    estNombre(v.tensionDiastolique) &&
    applicable('tensionSystolique')
  ) {
    resultats.push([
      'tension',
      plusGrave(
        classer(v.tensionSystolique, SEUILS.tensionSystolique),
        classer(v.tensionDiastolique, SEUILS.tensionDiastolique),
      ),
    ]);
  }
  for (const c of ['pouls', 'spo2', 'temperature', 'glycemie', 'imc'] as const) {
    const valeur = v[c];
    if (estNombre(valeur) && applicable(c)) resultats.push([c, classer(valeur, SEUILS[c])]);
  }

  const alertes: AlerteConstante[] = [];
  for (const [cle, r] of resultats) {
    if (!r) continue;
    const p = PRESENTATION[cle];
    const etat =
      r.sens === 'elevee' ? (p.feminin ? 'élevée' : 'élevé') : p.feminin ? 'basse' : 'bas';
    alertes.push({ cle, sens: r.sens, niveau: r.niveau, etat, texte: `${p.texte(v)} ${etat}` });
  }
  return alertes;
}

/** IMC arrondi au dixième, ou null s'il manque le poids ou la taille (en cm) */
export function calculerImc(poids?: number | null, tailleCm?: number | null): number | null {
  if (!poids || !tailleCm) return null;
  const m = tailleCm / 100;
  return Math.round((poids / (m * m)) * 10) / 10;
}

/** Âge en années révolues à une date donnée */
export function ageEnAnnees(dateNaissance: string | Date, le: Date = new Date()): number {
  const n = new Date(dateNaissance);
  let age = le.getUTCFullYear() - n.getUTCFullYear();
  const mois = le.getUTCMonth() - n.getUTCMonth();
  if (mois < 0 || (mois === 0 && le.getUTCDate() < n.getUTCDate())) age--;
  return age;
}
