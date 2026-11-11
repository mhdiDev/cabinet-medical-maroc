// backend/src/constantes/regles.ts
import { BadRequestException } from '@nestjs/common';
import { jourCabinet } from '../common/dates/journee';
import {
  ageEnAnnees,
  type AlerteConstante,
  calculerImc,
  CHAMPS_MESURE,
  evaluerConstantes,
  type ValeursConstantes,
} from './seuils';

const present = (n: number | null | undefined): n is number => n !== undefined && n !== null;

/** Une prise contient au moins une valeur ; la tension va par paire, haute > basse */
export function verifierMesures(m: ValeursConstantes): void {
  if (!CHAMPS_MESURE.some((c) => present(m[c])))
    throw new BadRequestException('Aucune constante saisie');
  const haute = m.tensionSystolique;
  const basse = m.tensionDiastolique;
  if (present(haute) !== present(basse)) {
    throw new BadRequestException('Tension : saisir les deux valeurs (haute et basse)');
  }
  if (present(haute) && present(basse) && haute <= basse) {
    throw new BadRequestException('Tension : la valeur haute doit dépasser la valeur basse');
  }
}

/** Date de prise : ni dans le futur (5 min de tolérance), ni avant 1900 */
export function verifierDatePrise(iso: string | undefined, maintenant: Date = new Date()): void {
  if (!iso) return;
  const t = new Date(iso).getTime();
  if (t > maintenant.getTime() + 5 * 60_000) {
    throw new BadRequestException('La date de prise ne peut pas être dans le futur');
  }
  if (t < Date.UTC(1900, 0, 1)) throw new BadRequestException('Date de prise invalide');
}

/** Un médecin modifie toujours ; l'auteur de la prise, le jour même (heure du cabinet) */
export function peutModifier(
  prise: { priseParId: string; createdAt: Date },
  user: { id: string; role: string },
  maintenant: Date = new Date(),
): boolean {
  if (user.role === 'MEDECIN') return true;
  return prise.priseParId === user.id && jourCabinet(prise.createdAt) === jourCabinet(maintenant);
}

/** Les valeurs de mesure d'une ligne, sans les autres champs */
export function valeursDe(prise: ValeursConstantes): ValeursConstantes {
  return Object.fromEntries(CHAMPS_MESURE.map((c) => [c, prise[c] ?? null])) as ValeursConstantes;
}

export type PriseBrute = { id: string; datePrise: Date } & ValeursConstantes;
export type PriseEnrichie<T> = T & { imc: number | null; alertes: AlerteConstante[] };

/**
 * Ajoute l'IMC et les alertes à chaque prise (ordre d'origine conservé).
 * Sans taille dans la prise, l'IMC d'un adulte utilise la dernière taille mesurée avant elle.
 */
export function enrichirPrises<T extends PriseBrute>(
  prises: T[],
  dateNaissance: Date,
): PriseEnrichie<T>[] {
  const chronologique = [...prises].sort((a, b) => a.datePrise.getTime() - b.datePrise.getTime());
  const calculs = new Map<string, { imc: number | null; alertes: AlerteConstante[] }>();
  let derniereTaille: number | null = null;
  for (const p of chronologique) {
    if (present(p.taille)) derniereTaille = p.taille;
    const age = ageEnAnnees(dateNaissance, p.datePrise);
    const taille = present(p.taille) ? p.taille : age >= 18 ? derniereTaille : null;
    const imc = calculerImc(p.poids, taille);
    calculs.set(p.id, { imc, alertes: evaluerConstantes({ ...valeursDe(p), imc }, age) });
  }
  return prises.map((p) => ({ ...p, ...calculs.get(p.id)! }));
}
