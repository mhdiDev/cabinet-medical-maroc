// frontend/src/lib/constantes/saisie.ts
import { CHAMPS, CHAMPS_MESURE, type ChampMesure, type ValeursConstantes } from './seuils';

/** Ce que l'utilisateur a tapé, champ par champ (texte, virgule ou point) */
export type SaisieConstantes = Record<ChampMesure, string>;
export type ErreursSaisie = Partial<Record<ChampMesure, string>>;

export const SAISIE_VIDE = Object.fromEntries(CHAMPS_MESURE.map((c) => [c, ''])) as SaisieConstantes;

const fr = (n: number) => String(n).replace('.', ',');
const normaliser = (texte: string) => texte.trim().replace(',', '.');

/** Texte → nombre : undefined si vide, NaN si illisible */
export function lireNombre(texte: string): number | undefined {
  const t = normaliser(texte);
  if (!t) return undefined;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export function erreursSaisie(s: SaisieConstantes): ErreursSaisie {
  const erreurs: ErreursSaisie = {};
  for (const c of CHAMPS_MESURE) {
    const n = lireNombre(s[c]);
    if (n === undefined) continue;
    const { min, max, unite, entier } = CHAMPS[c];
    const bornes = `Entre ${fr(min)} et ${fr(max)} ${unite}`;
    const decimales = normaliser(s[c]).split('.')[1]?.length ?? 0;
    if (Number.isNaN(n) || n < min || n > max) erreurs[c] = bornes;
    else if (entier && decimales > 0) erreurs[c] = `${bornes}, nombre entier`;
    else if (decimales > 2) erreurs[c] = `${bornes}, 2 décimales au plus`;
  }
  if (!erreurs.tensionSystolique && !erreurs.tensionDiastolique) {
    const haute = lireNombre(s.tensionSystolique);
    const basse = lireNombre(s.tensionDiastolique);
    if ((haute === undefined) !== (basse === undefined)) {
      erreurs[haute === undefined ? 'tensionSystolique' : 'tensionDiastolique'] = 'Saisir les deux valeurs de la tension';
    } else if (haute !== undefined && basse !== undefined && haute <= basse) {
      erreurs.tensionSystolique = 'La tension haute doit dépasser la basse';
    }
  }
  return erreurs;
}

/** Valeurs remplies seulement (création) */
export function versValeurs(s: SaisieConstantes): ValeursConstantes {
  const v: ValeursConstantes = {};
  for (const c of CHAMPS_MESURE) {
    const n = lireNombre(s[c]);
    if (n !== undefined && !Number.isNaN(n)) v[c] = n;
  }
  return v;
}

/** Tous les champs, null pour un champ vide (modification : vider un champ efface la valeur) */
export function versValeursCompletes(s: SaisieConstantes): Record<ChampMesure, number | null> {
  const v = versValeurs(s);
  return Object.fromEntries(CHAMPS_MESURE.map((c) => [c, v[c] ?? null])) as Record<ChampMesure, number | null>;
}

export function versSaisie(v: ValeursConstantes): SaisieConstantes {
  return Object.fromEntries(
    CHAMPS_MESURE.map((c) => [c, v[c] === undefined || v[c] === null ? '' : fr(v[c] as number)]),
  ) as SaisieConstantes;
}

export const saisieVide = (s: SaisieConstantes) => CHAMPS_MESURE.every((c) => !s[c].trim());
export const memeSaisie = (a: SaisieConstantes, b: SaisieConstantes) =>
  CHAMPS_MESURE.every((c) => a[c].trim() === b[c].trim());
