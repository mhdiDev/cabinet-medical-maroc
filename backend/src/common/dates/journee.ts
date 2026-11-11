// backend/src/common/dates/journee.ts

// Fuseau des cabinets. Deviendra un réglage par cabinet (correction de l'agenda).
// Pas de décalage codé en dur : le Maroc passe à UTC+0 pendant le Ramadan.
export const FUSEAU_CABINET = 'Africa/Casablanca';

// Décalage (en ms) entre l'heure locale du fuseau et UTC à un instant donné
function decalage(instant: number, fuseau: string): number {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone: fuseau,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const v = (type: string) => Number(parties.find((p) => p.type === type)!.value);
  const commeUtc = Date.UTC(
    v('year'),
    v('month') - 1,
    v('day'),
    v('hour'),
    v('minute'),
    v('second'),
  );
  return commeUtc - Math.floor(instant / 1000) * 1000;
}

// Instant UTC de minuit, heure locale du fuseau, pour une date (a, m, j).
// Suppose qu'aucun changement d'heure ne tombe à minuit (vrai pour Africa/Casablanca) : à revoir quand le fuseau deviendra un réglage par cabinet.
function minuitLocal(a: number, m: number, j: number, fuseau: string): Date {
  const naif = Date.UTC(a, m - 1, j);
  // Deux passes : le décalage peut différer entre minuit UTC et minuit local
  let t = naif - decalage(naif, fuseau);
  t = naif - decalage(t, fuseau);
  return new Date(t);
}

// Journée civile AAAA-MM-JJ dans le fuseau, en instants UTC : [debut, fin[
export function journeeEnUtc(
  date: string,
  fuseau: string = FUSEAU_CABINET,
): { debut: Date; fin: Date } {
  const [a, m, j] = date.split('-').map(Number);
  const lendemain = new Date(Date.UTC(a, m - 1, j + 1));
  return {
    debut: minuitLocal(a, m, j, fuseau),
    fin: minuitLocal(
      lendemain.getUTCFullYear(),
      lendemain.getUTCMonth() + 1,
      lendemain.getUTCDate(),
      fuseau,
    ),
  };
}
