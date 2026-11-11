import { getISOWeek } from 'date-fns';
import { dateDepuisJour, indexAujourdhui } from './donnees';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

interface Props {
  rdvParJour?: number[];
  semaineDebut?: string;
  total?: number;
  chargement?: boolean;
}

export function ActiviteSemaine({ rdvParJour, semaineDebut, total, chargement }: Props) {
  const compte = rdvParJour?.length === 7 ? rdvParJour : [0, 0, 0, 0, 0, 0, 0];
  // Le dimanche n'apparaît que s'il a des RDV
  const jours = compte[6] > 0 ? 7 : 6;
  const max = Math.max(1, ...compte);
  const aujourdhui = indexAujourdhui();
  const numeroSemaine = getISOWeek(dateDepuisJour(semaineDebut));

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Activité hebdomadaire</span>
        <span className="text-xs text-primary-600 font-semibold">Semaine {numeroSemaine}</span>
      </div>

      <div className="py-4">
        {chargement ? (
          <div className="h-28 rounded bg-slate-50 animate-pulse" />
        ) : (
          <div className="flex items-end justify-between h-28 gap-2 px-1" role="img"
            aria-label={`Rendez-vous par jour : ${compte.slice(0, jours).map((n, i) => `${JOURS[i]} ${n}`).join(', ')}`}>
            {compte.slice(0, jours).map((n, i) => {
              const estAujourdhui = i === aujourdhui;
              // Barre minimale visible pour un jour à 0 ; sinon proportionnelle au jour le plus chargé
              const hauteur = n === 0 ? '4px' : `${Math.max(8, Math.round((n / max) * 64))}px`;
              return (
                <div key={JOURS[i]} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className={`text-[11px] mb-1 ${
                    estAujourdhui ? 'font-bold text-primary-700' : n > 0 ? 'font-semibold text-slate-600' : 'font-semibold text-slate-400'
                  }`}>
                    {n}
                  </span>
                  <div
                    className={`w-full rounded-t-sm ${estAujourdhui ? 'bg-primary-600' : n > 0 ? 'bg-slate-300' : 'bg-slate-200'}`}
                    style={{ height: hauteur }}
                  />
                  {estAujourdhui ? (
                    <div className="flex flex-col items-center mt-1">
                      <span className="text-[11px] font-bold text-primary-700">{JOURS[i]}</span>
                      <span className="text-[9px] font-bold text-primary-600 bg-blue-50 px-1 rounded leading-tight">Auj</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 mt-2">{JOURS[i]}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>
          Total de la semaine : <strong>{total ?? 0} rendez-vous</strong>
        </span>
      </div>
    </div>
  );
}
