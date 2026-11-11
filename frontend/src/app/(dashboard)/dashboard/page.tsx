'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useIsFetching, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { nomAffiche } from '@/lib/utilisateur';
import { NouveauRdvModal } from '@/components/agenda/NouveauRdvModal';
import { CarteStat } from '@/components/dashboard/CarteStat';
import { ActiviteSemaine } from '@/components/dashboard/ActiviteSemaine';
import { ProchainPatient } from '@/components/dashboard/ProchainPatient';
import { RdvDuJourTable } from '@/components/dashboard/RdvDuJourTable';
import { RecherchePatient } from '@/components/dashboard/RecherchePatient';
import {
  choisirProchainPatient,
  formaterMad,
  RdvDuJour,
  StatsDashboard,
  StatutRdv,
} from '@/components/dashboard/donnees';
import {
  IconeActualiser,
  IconeAlerte,
  IconeCalendrier,
  IconeChevronDroite,
  IconeGraphique,
  IconeMonnaie,
  IconePatients,
  IconePlus,
} from '@/components/ui/icons';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [modaleRdv, setModaleRdv] = useState(false);
  const estMedecin = user?.role === 'MEDECIN';
  // Mêmes droits que le menu Stock : secrétaire et médecin titulaire
  const voitStock = user?.role === 'SECRETAIRE' || !!user?.estTitulaire;

  const { data: stats, isLoading: statsEnChargement } = useQuery<StatsDashboard>({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get('/rapports/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  // Médecin : ses RDV ; secrétaire : ceux de tout le cabinet
  const { data: rdvToday = [], isLoading: rdvEnChargement, isError: rdvErreur } = useQuery<RdvDuJour[]>({
    queryKey: ['rdv-today', user?.id, user?.role],
    queryFn: () =>
      apiClient
        .get('/rendez-vous/today', { params: estMedecin ? { medecinId: user?.id } : {} })
        .then(r => r.data),
    enabled: !!user,
    refetchInterval: 60000,
  });

  const { data: alertesStock = [] } = useQuery<{ id: string; nom: string }[]>({
    queryKey: ['stock', 'alertes'],
    queryFn: () => apiClient.get('/stock/articles/alertes').then(r => r.data),
    enabled: voitStock,
    refetchInterval: 60_000,
  });

  const changerStatut = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutRdv }) =>
      apiClient.patch(`/rendez-vous/${id}/statut`, { statut }),
    onSuccess: () => {
      toast.success('Statut mis à jour');
      queryClient.invalidateQueries({ queryKey: ['rdv-today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => toast.error('Erreur lors de la mise à jour du statut'),
  });

  const actualisations = useIsFetching();
  const actualiser = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['rdv-today'] });
    queryClient.invalidateQueries({ queryKey: ['stock', 'alertes'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const prochain = choisirProchainPatient(rdvToday);
  const nomsAlertes = alertesStock.slice(0, 3).map(a => a.nom).join(', ');

  return (
    <div className="space-y-6">
      {/* En-tête + actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tableau de bord</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Bonjour, {nomAffiche(user)} — Voici le point sur {estMedecin ? 'votre activité' : "l'activité du cabinet"} aujourd&apos;hui.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={actualiser}
            title="Actualiser"
            aria-label="Actualiser"
            className="p-2 border border-slate-300 rounded-lg text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-colors"
          >
            <IconeActualiser className={`w-4 h-4 ${actualisations > 0 ? 'animate-spin' : ''}`} strokeWidth={2} />
          </button>
          <Link
            href="/patients/nouveau"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-primary-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
          >
            <IconePlus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Nouveau patient
          </Link>
          <button
            onClick={() => setModaleRdv(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors"
          >
            <IconePlus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Nouveau RDV
          </button>
        </div>
      </div>

      <RecherchePatient peutCreerConsultation={estMedecin} />

      {/* Indicateurs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <CarteStat titre="Patients" valeur={stats?.totalPatients ?? 0} icone={IconePatients} teinte="bleu" chargement={statsEnChargement} />
        <CarteStat titre="RDV aujourd'hui" valeur={stats?.rdvAujourdhui ?? 0} icone={IconeCalendrier} teinte="indigo" chargement={statsEnChargement} />
        <CarteStat titre="RDV cette semaine" valeur={stats?.rdvSemaine ?? 0} icone={IconeGraphique} teinte="violet" chargement={statsEnChargement} />
        <CarteStat
          titre="Recette du jour"
          valeur={<>{formaterMad(stats?.recetteJour ?? 0)} <span className="text-lg font-semibold text-slate-600">MAD</span></>}
          icone={IconeMonnaie}
          teinte="ambre"
          chargement={statsEnChargement}
        />
      </section>

      {/* Alerte stock */}
      {voitStock && alertesStock.length > 0 && (
        <section className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700">
              <IconeAlerte className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-amber-900 leading-snug">Alerte stock</h2>
              <p className="text-xs text-amber-700 leading-snug">
                {alertesStock.length === 1
                  ? `1 article est sous le seuil d'alerte (${nomsAlertes}).`
                  : `${alertesStock.length} articles sont sous le seuil d'alerte (${nomsAlertes}${alertesStock.length > 3 ? '…' : ''}).`}
              </p>
            </div>
          </div>
          <Link
            href="/stock"
            className="inline-flex items-center self-start sm:self-auto gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 hover:underline px-3 py-1.5 bg-amber-100/70 hover:bg-amber-200/70 rounded-md transition-colors"
          >
            Voir le stock
            <IconeChevronDroite className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </section>
      )}

      {/* Prochain patient + activité de la semaine */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ProchainPatient
          rdv={prochain}
          estMedecin={estMedecin}
          chargement={rdvEnChargement}
          enCours={changerStatut.isPending}
          onMarquerArrive={id => changerStatut.mutate({ id, statut: 'ARRIVE' })}
        />
        <ActiviteSemaine
          rdvParJour={stats?.rdvParJour}
          semaineDebut={stats?.semaineDebut}
          total={stats?.rdvSemaine}
          chargement={statsEnChargement}
        />
      </section>

      <RdvDuJourTable
        rdvs={rdvToday}
        estMedecin={estMedecin}
        afficherMedecin={!estMedecin}
        chargement={rdvEnChargement}
        erreur={rdvErreur}
        onChangerStatut={(id, statut) => changerStatut.mutate({ id, statut })}
      />

      {modaleRdv && (
        <NouveauRdvModal
          onClose={() => setModaleRdv(false)}
          onSuccess={() => {
            setModaleRdv(false);
            actualiser();
          }}
        />
      )}
    </div>
  );
}
