'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { NouveauRdvModal } from '@/components/agenda/NouveauRdvModal';
import toast from 'react-hot-toast';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

const messages = {
  today: "Aujourd'hui",
  previous: '‹',
  next: '›',
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
  agenda: 'Liste',
  noEventsInRange: 'Aucun rendez-vous sur cette période',
  showMore: (n: number) => `+${n} autres`,
};

const STATUS_COLORS: Record<string, string> = {
  EN_ATTENTE: '#f59e0b',
  CONFIRME: '#3b82f6',
  ARRIVE: '#10b981',
  FACTURE: '#8b5cf6',
  ANNULE: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  CONFIRME: 'Confirmé',
  ARRIVE: 'Arrivé',
  FACTURE: 'Facturé',
  ANNULE: 'Annulé',
};

export default function AgendaPage() {
  const { user } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<any>(Views.WEEK);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [selectedRdv, setSelectedRdv] = useState<any>(null);
  const queryClient = useQueryClient();

  const debut = startOfMonth(currentDate).toISOString();
  const fin = endOfMonth(currentDate).toISOString();

  const { data: rdvList = [] } = useQuery({
    queryKey: ['agenda', user?.id, debut],
    queryFn: () =>
      user
        ? apiClient
            .get('/rendez-vous/agenda', { params: { medecinId: user.id, debut, fin } })
            .then(r => r.data)
        : [],
    enabled: !!user,
  });

  const updateStatut = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: string }) =>
      apiClient.patch(`/rendez-vous/${id}/statut`, { statut }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['rdv-today'] });
      toast.success('Statut mis à jour');
      setSelectedRdv(null);
    },
    onError: () => toast.error('Erreur mise à jour statut'),
  });

  const events = rdvList.map((rdv: any) => ({
    id: rdv.id,
    title: `${rdv.patient?.prenom} ${rdv.patient?.nom}`,
    start: new Date(rdv.dateHeure),
    end: new Date(new Date(rdv.dateHeure).getTime() + (rdv.dureeMinutes || 30) * 60000),
    resource: rdv,
    color: STATUS_COLORS[rdv.statut] || '#6b7280',
  }));

  const handleSelectSlot = ({ start }: { start: Date }) => {
    setSelectedSlot(start);
    setShowModal(true);
  };

  const handleSelectEvent = (event: any) => {
    setSelectedRdv(event.resource);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
        <button
          onClick={() => { setSelectedSlot(null); setShowModal(true); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + Nouveau RDV
        </button>
      </div>

      {/* Légende statuts */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: STATUS_COLORS[status] }} />
            {label}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4" style={{ height: 620 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView}
          date={currentDate}
          onNavigate={setCurrentDate}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          selectable
          messages={messages}
          culture="fr"
          min={new Date(0, 0, 0, 7, 0)}
          max={new Date(0, 0, 0, 20, 0)}
          eventPropGetter={(event: any) => ({
            style: {
              backgroundColor: event.color,
              borderColor: event.color,
              color: 'white',
              borderRadius: '6px',
              fontSize: '12px',
            },
          })}
        />
      </div>

      {/* Modal détail RDV */}
      {selectedRdv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-lg mb-1">
              {selectedRdv.patient?.prenom} {selectedRdv.patient?.nom}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {new Date(selectedRdv.dateHeure).toLocaleString('fr-MA')} — {selectedRdv.dureeMinutes} min
            </p>
            {selectedRdv.motif && (
              <p className="text-sm text-gray-700 mb-4">Motif: {selectedRdv.motif}</p>
            )}
            <p className="text-sm mb-4">
              Statut:{' '}
              <span className="font-medium" style={{ color: STATUS_COLORS[selectedRdv.statut] }}>
                {STATUS_LABELS[selectedRdv.statut]}
              </span>
            </p>

            {/* Actions de progression de statut */}
            <div className="space-y-2">
              {selectedRdv.statut === 'EN_ATTENTE' && (
                <button
                  onClick={() => updateStatut.mutate({ id: selectedRdv.id, statut: 'CONFIRME' })}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm"
                >
                  ✓ Confirmer
                </button>
              )}
              {selectedRdv.statut === 'CONFIRME' && (
                <button
                  onClick={() => updateStatut.mutate({ id: selectedRdv.id, statut: 'ARRIVE' })}
                  className="w-full py-2 bg-green-600 text-white rounded-lg text-sm"
                >
                  ✓ Patient arrivé
                </button>
              )}
              {selectedRdv.statut === 'ARRIVE' && (
                <button
                  onClick={() => updateStatut.mutate({ id: selectedRdv.id, statut: 'FACTURE' })}
                  className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm"
                >
                  ✓ Marquer facturé
                </button>
              )}
              {selectedRdv.statut !== 'ANNULE' && selectedRdv.statut !== 'FACTURE' && (
                <button
                  onClick={() => updateStatut.mutate({ id: selectedRdv.id, statut: 'ANNULE' })}
                  className="w-full py-2 border border-red-300 text-red-600 rounded-lg text-sm"
                >
                  Annuler le RDV
                </button>
              )}
            </div>

            <button
              onClick={() => setSelectedRdv(null)}
              className="w-full mt-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <NouveauRdvModal
          defaultDate={selectedSlot}
          onClose={() => { setShowModal(false); setSelectedSlot(null); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['agenda'] });
            queryClient.invalidateQueries({ queryKey: ['rdv-today'] });
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
