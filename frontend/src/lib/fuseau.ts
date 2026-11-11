// Fuseau des cabinets (le même que côté serveur). Deviendra un réglage par cabinet.
export const FUSEAU_CABINET = 'Africa/Casablanca';

// Heure HH:mm d'un instant, dans le fuseau du cabinet (pas celui du navigateur)
export function heureCabinet(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU_CABINET });
}

// Date AAAA-MM-JJ d'un instant dans le fuseau du cabinet
export function jourCabinet(instant: string | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSEAU_CABINET,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}
