// frontend/src/lib/constantes/affichage.ts
import { FUSEAU_CABINET } from '@/lib/fuseau';
import type { Prise } from './api';
import { CHAMPS, type ChampMesure, type AlerteConstante, type CleAlerte, SEUILS } from './seuils';

export const fr = (n: number) => String(n).replace('.', ',');

interface Ligne {
  cle: string;
  libelle: string;
  lire: (p: Prise) => string | null;
  alerte?: CleAlerte;
}

const ALERTES_SIMPLES: ChampMesure[] = ['pouls', 'spo2', 'temperature', 'glycemie'];

const simple = (c: ChampMesure): Ligne => ({
  cle: c,
  libelle: CHAMPS[c].libelle,
  lire: (p) => (p[c] === null || p[c] === undefined ? null : `${fr(p[c] as number)} ${CHAMPS[c].unite}`),
  alerte: ALERTES_SIMPLES.includes(c) ? (c as CleAlerte) : undefined,
});

const LIGNES: Ligne[] = [
  {
    cle: 'tension',
    libelle: 'Tension',
    lire: (p) =>
      p.tensionSystolique != null && p.tensionDiastolique != null
        ? `${p.tensionSystolique}/${p.tensionDiastolique} mmHg`
        : null,
    alerte: 'tension',
  },
  simple('pouls'),
  simple('spo2'),
  simple('temperature'),
  simple('poids'),
  simple('taille'),
  { cle: 'imc', libelle: 'IMC', lire: (p) => (p.imc == null ? null : fr(p.imc)), alerte: 'imc' },
  simple('glycemie'),
  simple('perimetreCranien'),
  simple('tourDeTaille'),
];

export interface DerniereValeur {
  cle: string;
  libelle: string;
  valeur: string;
  date: string;
  alerte?: AlerteConstante;
}

/** Valeur la plus récente de chaque constante (prises de la plus récente à la plus ancienne) */
export function dernieresValeurs(prises: Prise[]): DerniereValeur[] {
  const res: DerniereValeur[] = [];
  for (const l of LIGNES) {
    const p = prises.find((x) => l.lire(x) !== null);
    if (!p) continue;
    res.push({
      cle: l.cle,
      libelle: l.libelle,
      valeur: l.lire(p)!,
      date: p.datePrise,
      alerte: l.alerte ? p.alertes.find((a) => a.cle === l.alerte) : undefined,
    });
  }
  return res;
}

/** « Tension 120/80 mmHg · Poids 72 kg · IMC 24,9 » */
export function resumePrise(p: Prise): string {
  return LIGNES.map((l) => {
    const v = l.lire(p);
    return v === null ? null : `${l.libelle} ${v}`;
  })
    .filter(Boolean)
    .join(' · ');
}

type CleSerie = ChampMesure | 'imc';

export interface Courbe {
  cle: string;
  libelle: string;
  unite: string;
  series: { cle: CleSerie; libelle: string }[];
}

const courbeSimple = (c: ChampMesure): Courbe => ({
  cle: c,
  libelle: CHAMPS[c].libelle,
  unite: CHAMPS[c].unite,
  series: [{ cle: c, libelle: CHAMPS[c].libelle }],
});

export const COURBES: Courbe[] = [
  {
    cle: 'tension',
    libelle: 'Tension',
    unite: 'mmHg',
    series: [
      { cle: 'tensionSystolique', libelle: 'Haute' },
      { cle: 'tensionDiastolique', libelle: 'Basse' },
    ],
  },
  courbeSimple('pouls'),
  courbeSimple('spo2'),
  courbeSimple('temperature'),
  courbeSimple('poids'),
  { cle: 'imc', libelle: 'IMC', unite: 'kg/m²', series: [{ cle: 'imc', libelle: 'IMC' }] },
  courbeSimple('glycemie'),
  courbeSimple('perimetreCranien'),
  courbeSimple('tourDeTaille'),
];

export type PointCourbe = { date: string } & Partial<Record<CleSerie, number | null>>;

/** Points de la courbe, du plus ancien au plus récent (prises sans valeur ignorées) */
export function pointsCourbe(prises: Prise[], courbe: Courbe): PointCourbe[] {
  return [...prises]
    .sort((a, b) => a.datePrise.localeCompare(b.datePrise))
    .filter((p) => courbe.series.some((s) => p[s.cle] !== null && p[s.cle] !== undefined))
    .map((p) => ({
      date: new Date(p.datePrise).toLocaleDateString('fr-MA', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        timeZone: FUSEAU_CABINET,
      }),
      ...Object.fromEntries(courbe.series.map((s) => [s.cle, p[s.cle] ?? null])),
    }));
}

/** Seuils adultes dessinés en pointillés (sans doublon) */
export function reperesCourbe(courbe: Courbe): number[] {
  const valeurs = courbe.series.flatMap((s) => {
    const seuil = (SEUILS as Record<string, { basse?: number; haute?: number }>)[s.cle];
    return seuil ? [seuil.basse, seuil.haute] : [];
  });
  return Array.from(new Set(valeurs.filter((n): n is number => n !== undefined)));
}
