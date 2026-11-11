import { FUSEAU_CABINET, journeeEnUtc } from '../common/dates/journee';

// Jour civil AAAA-MM-JJ d'un instant, dans le fuseau du cabinet
export function jourLocal(instant: Date, fuseau: string = FUSEAU_CABINET): string {
  // en-CA formate en AAAA-MM-JJ
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

// 0 = lundi … 6 = dimanche, pour un jour AAAA-MM-JJ
function indexJour(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number);
  return (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7;
}

function decalerJour(jour: string, nbJours: number): string {
  const [a, m, j] = jour.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + nbJours)).toISOString().slice(0, 10);
}

// Journée en cours dans le fuseau du cabinet, en instants UTC : [debut, fin[
export function aujourdhui(reference: Date = new Date(), fuseau: string = FUSEAU_CABINET) {
  return journeeEnUtc(jourLocal(reference, fuseau), fuseau);
}

// Semaine en cours (lundi 00:00 → lundi suivant 00:00, heure du cabinet), en instants UTC : [debut, fin[
export function bornesSemaine(reference: Date = new Date(), fuseau: string = FUSEAU_CABINET) {
  const jour = jourLocal(reference, fuseau);
  const lundi = decalerJour(jour, -indexJour(jour));
  return {
    lundi,
    debut: journeeEnUtc(lundi, fuseau).debut,
    fin: journeeEnUtc(decalerJour(lundi, 6), fuseau).fin,
  };
}

// Nombre de RDV par jour, du lundi (index 0) au dimanche (index 6), heure du cabinet
export function compterParJour(dates: Date[], fuseau: string = FUSEAU_CABINET): number[] {
  const compte = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dates) compte[indexJour(jourLocal(d, fuseau))] += 1;
  return compte;
}
