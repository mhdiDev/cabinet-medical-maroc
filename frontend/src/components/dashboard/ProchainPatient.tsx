import Link from 'next/link';
import { initiales } from '@/lib/utilisateur';
import { IconeDossier, IconeHorloge, IconeLecture } from '@/components/ui/icons';
import { BadgeStatut } from './BadgeStatut';
import { age, heure, RdvDuJour } from './donnees';

interface Props {
  rdv: RdvDuJour | null;
  estMedecin: boolean;
  chargement?: boolean;
  onMarquerArrive: (id: string) => void;
  enCours?: boolean;
}

export function ProchainPatient({ rdv, estMedecin, chargement, onMarquerArrive, enCours }: Props) {
  const ageAns = age(rdv?.patient.dateNaissance);
  const sexe = rdv?.patient.sexe === 'MASCULIN' ? 'Homme' : rdv?.patient.sexe === 'FEMININ' ? 'Femme' : null;
  const details = [ageAns !== null ? `${ageAns} ans` : null, sexe].filter(Boolean).join(' • ');

  return (
    <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="inline-flex p-1.5 bg-blue-50 text-primary-600 rounded-md">
              <IconeHorloge className="w-4 h-4" strokeWidth={2} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Prochain patient</span>
          </div>
          {rdv && <BadgeStatut statut={rdv.statut} />}
        </div>

        {chargement ? (
          <div className="mt-5 h-14 rounded-xl bg-slate-50 animate-pulse" />
        ) : !rdv ? (
          <p className="mt-5 text-sm text-slate-500">Aucun patient en attente pour le moment.</p>
        ) : (
          <div className="mt-5 flex flex-col sm:flex-row items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0">
              {initiales(rdv.patient.prenom, rdv.patient.nom)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h3 className="text-xl font-bold text-slate-900">
                  {rdv.patient.prenom} {rdv.patient.nom}
                </h3>
                {details && <span className="text-xs text-slate-500 font-medium">{details}</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                <span className="flex items-center gap-1 text-primary-700 font-semibold">
                  <IconeHorloge className="w-3.5 h-3.5 text-primary-500" strokeWidth={2} />
                  RDV prévu : {heure(rdv.dateHeure)}
                </span>
                <span className="text-slate-400">•</span>
                <span>Motif : {rdv.motif || 'Consultation'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {rdv && !chargement && (
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
          {estMedecin ? (
            <>
              <Link
                href={`/consultations/nouvelle?patientId=${rdv.patient.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              >
                <IconeLecture className="w-4 h-4" strokeWidth={2} />
                Démarrer la consultation
              </Link>
              <Link
                href={`/patients/${rdv.patient.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                <IconeDossier className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />
                Dossier médical
              </Link>
            </>
          ) : (
            <>
              {(rdv.statut === 'EN_ATTENTE' || rdv.statut === 'CONFIRME') && (
                <button
                  onClick={() => onMarquerArrive(rdv.id)}
                  disabled={enCours}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  Marquer arrivé
                </button>
              )}
              <Link
                href={`/patients/${rdv.patient.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Fiche patient
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
