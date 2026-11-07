// Ligne « <ville>, le <date> » de l'ordonnance : la ville est celle du cabinet
export function lieuEtDate(ville: string, date: Date): string {
  return `${ville}, le ${date.toLocaleDateString('fr-MA')}`;
}
