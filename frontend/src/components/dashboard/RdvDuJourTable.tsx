'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { initiales } from '@/lib/utilisateur';
import { IconePlusActions } from '@/components/ui/icons';
import { BadgeStatut } from './BadgeStatut';
import { heure, RdvDuJour, STATUTS, StatutRdv, statutSuivant } from './donnees';

interface Props {
  rdvs: RdvDuJour[];
  estMedecin: boolean;
  // La secrétaire voit les RDV de tous les médecins : on affiche la colonne Médecin
  afficherMedecin: boolean;
  chargement?: boolean;
  erreur?: boolean;
  onChangerStatut: (id: string, statut: StatutRdv) => void;
}

// L'API ne renvoie pas les RDV annulés pour aujourd'hui : pas de filtre « Annulé »
const FILTRES = STATUTS.filter(s => s.valeur !== 'ANNULE');

export function RdvDuJourTable({ rdvs, estMedecin, afficherMedecin, chargement, erreur, onChangerStatut }: Props) {
  const [filtre, setFiltre] = useState<StatutRdv | 'TOUS'>('TOUS');
  const visibles = filtre === 'TOUS' ? rdvs : rdvs.filter(r => r.statut === filtre);
  const dateJour = new Date().toLocaleDateString('fr-MA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const colonnes = afficherMedecin ? 6 : 5;

  return (
    <section className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Rendez-vous du jour</h2>
          <p className="text-xs text-slate-500 mt-0.5">Planning du {dateJour}</p>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-medium overflow-x-auto" role="group" aria-label="Filtrer par statut">
          {[{ valeur: 'TOUS' as const, libelle: 'Tous' }, ...FILTRES].map(f => {
            const n = f.valeur === 'TOUS' ? rdvs.length : rdvs.filter(r => r.statut === f.valeur).length;
            const actif = filtre === f.valeur;
            return (
              <button
                key={f.valeur}
                onClick={() => setFiltre(f.valeur)}
                aria-pressed={actif}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap ${
                  actif ? 'bg-white text-slate-900 font-semibold shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.libelle} ({n})
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-6" scope="col">Heure</th>
              <th className="py-3.5 px-6" scope="col">Patient</th>
              <th className="py-3.5 px-6" scope="col">Motif</th>
              {afficherMedecin && <th className="py-3.5 px-6" scope="col">Médecin</th>}
              <th className="py-3.5 px-6" scope="col">Statut</th>
              <th className="py-3.5 px-6 text-right" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {chargement ? (
              <tr><td colSpan={colonnes} className="py-10 text-center text-slate-400">Chargement…</td></tr>
            ) : erreur ? (
              <tr><td colSpan={colonnes} className="py-10 text-center text-rose-600">Impossible de charger les rendez-vous.</td></tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={colonnes} className="py-10 text-center text-slate-500">
                  {rdvs.length === 0 ? "Aucun rendez-vous aujourd'hui" : 'Aucun rendez-vous avec ce statut'}
                </td>
              </tr>
            ) : (
              visibles.map(rdv => (
                <tr key={rdv.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span className="font-bold text-primary-700 text-sm">{heure(rdv.dateHeure)}</span>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {initiales(rdv.patient.prenom, rdv.patient.nom)}
                      </div>
                      <div>
                        <Link href={`/patients/${rdv.patient.id}`} className="font-semibold text-slate-900 hover:text-primary-600">
                          {rdv.patient.prenom} {rdv.patient.nom}
                        </Link>
                        <p className="text-[11px] text-slate-400 font-mono">{rdv.patient.telephone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span className="font-medium text-slate-700">{rdv.motif || 'Consultation'}</span>
                    <span className="block text-[11px] text-slate-400">{rdv.dureeMinutes} min</span>
                  </td>
                  {afficherMedecin && (
                    <td className="py-4 px-6 whitespace-nowrap text-slate-600">
                      {rdv.medecin ? `Dr ${rdv.medecin.prenom} ${rdv.medecin.nom}` : '—'}
                    </td>
                  )}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <BadgeStatut statut={rdv.statut} />
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-2">
                      {estMedecin && rdv.statut !== 'FACTURE' && (
                        <Link
                          href={`/consultations/nouvelle?patientId=${rdv.patient.id}`}
                          className="px-2.5 py-1 bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold rounded text-xs transition-colors"
                        >
                          Consulter
                        </Link>
                      )}
                      <MenuActions rdv={rdv} onChangerStatut={onChangerStatut} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
        <span>
          Affichage de {visibles.length} sur {rdvs.length} rendez-vous
        </span>
      </div>
    </section>
  );
}

function MenuActions({ rdv, onChangerStatut }: { rdv: RdvDuJour; onChangerStatut: Props['onChangerStatut'] }) {
  const [ouvert, setOuvert] = useState(false);
  // Menu en position fixe : le tableau défile horizontalement et couperait un menu absolu
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const suivant = statutSuivant(rdv.statut);
  const annulable = rdv.statut !== 'FACTURE' && rdv.statut !== 'ANNULE';

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    const fermer = () => setOuvert(false);
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche);
    window.addEventListener('resize', fermer);
    document.addEventListener('scroll', fermer, true);
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche);
      window.removeEventListener('resize', fermer);
      document.removeEventListener('scroll', fermer, true);
    };
  }, [ouvert]);

  const basculer = () => {
    if (!ouvert && bouton.current) {
      const r = bouton.current.getBoundingClientRect();
      const largeur = 176;
      const hauteurMenu = 120;
      const enHaut = r.bottom + hauteurMenu > window.innerHeight;
      setPosition({
        top: enHaut ? r.top - hauteurMenu - 4 : r.bottom + 4,
        left: Math.max(8, r.right - largeur),
      });
    }
    setOuvert(o => !o);
  };

  const choisir = (statut: StatutRdv) => {
    setOuvert(false);
    if (statut === 'ANNULE' && !window.confirm(`Annuler le rendez-vous de ${rdv.patient.prenom} ${rdv.patient.nom} ?`)) return;
    onChangerStatut(rdv.id, statut);
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={bouton}
        onClick={basculer}
        title="Plus d'actions"
        aria-label="Plus d'actions"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
      >
        <IconePlusActions className="w-4 h-4" strokeWidth={2} />
      </button>
      {ouvert && position && (
        <div
          role="menu"
          style={{ top: position.top, left: position.left }}
          className="fixed w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-left"
        >
          <Link role="menuitem" href={`/patients/${rdv.patient.id}`} className="block px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
            Fiche patient
          </Link>
          {suivant && (
            <button role="menuitem" onClick={() => choisir(suivant.statut)} className="block w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
              {suivant.libelle}
            </button>
          )}
          {annulable && (
            <button role="menuitem" onClick={() => choisir('ANNULE')} className="block w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50">
              Annuler le RDV
            </button>
          )}
        </div>
      )}
    </div>
  );
}
