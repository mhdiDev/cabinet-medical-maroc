// Fuseau des cabinets (le même que côté serveur). Deviendra un réglage par cabinet.
export const FUSEAU_CABINET = 'Africa/Casablanca';

// Heure HH:mm d'un instant, dans le fuseau du cabinet (pas celui du navigateur)
export function heureCabinet(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU_CABINET });
}
