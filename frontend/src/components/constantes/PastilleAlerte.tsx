// frontend/src/components/constantes/PastilleAlerte.tsx
import type { AlerteConstante } from '@/lib/constantes/seuils';

/** « élevée » en orange, « élevée (critique) » en rouge */
export function PastilleAlerte({ alerte, className = '' }: { alerte: AlerteConstante; className?: string }) {
  const couleur = alerte.niveau === 'critique' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800';
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${couleur} ${className}`}>
      {alerte.etat}
      {alerte.niveau === 'critique' ? ' (critique)' : ''}
    </span>
  );
}
