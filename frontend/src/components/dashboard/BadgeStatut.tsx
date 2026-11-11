import { infoStatut } from './donnees';

export function BadgeStatut({ statut }: { statut: string }) {
  const s = infoStatut(statut);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.point}`} />
      {s.libelle}
    </span>
  );
}
