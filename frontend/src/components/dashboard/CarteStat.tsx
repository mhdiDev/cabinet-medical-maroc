import type { ComponentType, ReactNode } from 'react';

const teintes = {
  bleu: 'bg-blue-50 border-blue-100 text-primary-600',
  indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
  violet: 'bg-purple-50 border-purple-100 text-purple-600',
  ambre: 'bg-amber-50 border-amber-100 text-amber-600',
};

interface Props {
  titre: string;
  valeur: ReactNode;
  icone: ComponentType<{ className?: string }>;
  teinte: keyof typeof teintes;
  chargement?: boolean;
}

export function CarteStat({ titre, valeur, icone: Icone, teinte, chargement }: Props) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{titre}</p>
        {chargement ? (
          <div className="mt-3 h-7 w-16 rounded bg-slate-100 animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-slate-900 mt-2">{valeur}</p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${teintes[teinte]}`}>
        <Icone className="w-6 h-6" />
      </div>
    </div>
  );
}
