'use client';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { useAuthStore } from '@/store/auth';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get('/rapports/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: rdvToday } = useQuery({
    queryKey: ['rdv-today', user?.id],
    queryFn: () => user ? apiClient.get(`/rendez-vous/today?medecinId=${user.id}`).then(r => r.data) : null,
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-500">Bonjour, Dr {user?.nom}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Patients" value={stats?.totalPatients || 0} icon="👥" color="blue" />
          <StatCard title="RDV aujourd'hui" value={stats?.rdvAujourdhui || 0} icon="📅" color="green" />
          <StatCard title="RDV cette semaine" value={stats?.rdvSemaine || 0} icon="📊" color="purple" />
          <StatCard title="Recette du jour" value={`${stats?.recetteJour || 0} MAD`} icon="💰" color="yellow" />
        </div>
      )}

      {stats?.stockAlertes > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-orange-800">Alerte Stock</p>
            <p className="text-orange-600 text-sm">{stats.stockAlertes} article(s) sous le seuil d&apos;alerte</p>
          </div>
          <a href="/stock" className="ml-auto text-orange-700 underline text-sm">Voir le stock</a>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Rendez-vous du jour</h2>
        {!rdvToday || rdvToday.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucun rendez-vous aujourd&apos;hui</p>
        ) : (
          <div className="space-y-3">
            {rdvToday.map((rdv: any) => (
              <div key={rdv.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-center min-w-[60px]">
                  <p className="font-bold text-blue-600">
                    {new Date(rdv.dateHeure).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{rdv.patient.prenom} {rdv.patient.nom}</p>
                  <p className="text-sm text-gray-500">{rdv.motif || 'Consultation'}</p>
                </div>
                <StatusBadge statut={rdv.statut} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ statut }: { statut: string }) {
  const colors: Record<string, string> = {
    EN_ATTENTE: 'bg-yellow-100 text-yellow-700',
    CONFIRME: 'bg-blue-100 text-blue-700',
    ARRIVE: 'bg-green-100 text-green-700',
    FACTURE: 'bg-purple-100 text-purple-700',
    ANNULE: 'bg-red-100 text-red-700',
  };
  const labels: Record<string, string> = {
    EN_ATTENTE: 'En attente', CONFIRME: 'Confirmé', ARRIVE: 'Arrivé', FACTURE: 'Facturé', ANNULE: 'Annulé',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[statut] || 'bg-gray-100 text-gray-600'}`}>
      {labels[statut] || statut}
    </span>
  );
}
