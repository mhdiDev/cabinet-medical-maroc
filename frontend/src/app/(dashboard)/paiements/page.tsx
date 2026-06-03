'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface PaiementForm {
  montant: string;
  montantRemise: string;
  typePaiement: string;
  description: string;
  referenceAssurance: string;
  consultationId: string;
}

export default function PaiementsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'caisse' | 'rapport'>('caisse');
  const [rapportDebut, setRapportDebut] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  );
  const [rapportFin, setRapportFin] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  const { data: caisse, isLoading } = useQuery({
    queryKey: ['caisse', date],
    queryFn: () => apiClient.get('/paiements/caisse', { params: { date } }).then(r => r.data),
  });

  const { data: consultationsDuJour } = useQuery({
    queryKey: ['consultations-du-jour', date],
    queryFn: () =>
      apiClient
        .get('/consultations', { params: { date, nonEncaissees: true } })
        .then(r => r.data),
    enabled: showForm,
  });

  const { data: rapport } = useQuery({
    queryKey: ['rapport', rapportDebut, rapportFin],
    queryFn: () =>
      apiClient
        .get('/paiements/rapport', { params: { debut: rapportDebut, fin: rapportFin } })
        .then(r => r.data),
    enabled: activeTab === 'rapport',
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/paiements', data),
    onSuccess: () => {
      toast.success('Paiement enregistré');
      queryClient.invalidateQueries({ queryKey: ['caisse'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      reset();
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<PaiementForm>({
    defaultValues: { typePaiement: 'ESPECE', montantRemise: '0', consultationId: '' },
  });

  const typePaiement = watch('typePaiement');

  const onSubmit = (data: PaiementForm) => {
    const linkedConsultation = consultationsDuJour?.consultations?.find(
      (c: any) => c.id === data.consultationId,
    );
    mutation.mutate({
      montant: parseFloat(data.montant),
      montantRemise: parseFloat(data.montantRemise || '0'),
      typePaiement: data.typePaiement,
      description: data.description || undefined,
      referenceAssurance: data.referenceAssurance || undefined,
      consultationId: data.consultationId || undefined,
      patientId: linkedConsultation?.patientId || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Caisse & Recettes</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
        >
          + Encaissement
        </button>
      </div>

      {/* Formulaire encaissement */}
      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm"
        >
          <h2 className="font-semibold text-gray-900 mb-4">Nouvel encaissement</h2>
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700">Consultation</label>
            <select
              {...register('consultationId')}
              onChange={(e) => {
                const consultation = consultationsDuJour?.consultations?.find(
                  (c: any) => c.id === e.target.value,
                );
                setValue('consultationId', e.target.value);
                if (consultation?.montantSuggere) {
                  setValue('montant', consultation.montantSuggere.toString());
                }
                if (consultation?.motif) {
                  setValue('description', consultation.motif);
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            >
              <option value="">— Sélectionner une consultation (optionnel) —</option>
              {consultationsDuJour?.consultations?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.patient?.nom} {c.patient?.prenom} — {c.motif || 'Consultation'}
                  {c.patient?.estAssure ? ' 🔵 Assuré' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Montant (MAD) *</label>
              <input
                {...register('montant', { required: true })}
                type="number"
                step="0.01"
                min="0"
                placeholder="200.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Remise (MAD)</label>
              <input
                {...register('montantRemise')}
                type="number"
                step="0.01"
                min="0"
                defaultValue="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Mode de paiement</label>
              <select
                {...register('typePaiement')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="ESPECE">💵 Espèces</option>
                <option value="CARTE">💳 Carte bancaire</option>
                <option value="CHEQUE">📝 Chèque</option>
                <option value="ASSURANCE">🏥 Assurance</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Description</label>
              <input
                {...register('description')}
                placeholder="Consultation, acte, examen..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            {typePaiement === 'ASSURANCE' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Réf. assurance</label>
                <input
                  {...register('referenceAssurance')}
                  placeholder="N° dossier assurance"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => { setShowForm(false); reset(); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {/* Onglets */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['caisse', 'rapport'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-3 text-sm font-medium transition ${
              activeTab === t
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'caisse' ? 'Caisse journalière' : 'Rapport périodique'}
          </button>
        ))}
      </div>

      {activeTab === 'caisse' && (
        <>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Date:</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {isLoading ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Chargement...</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-6 text-center md:col-span-1">
                  <p className="text-3xl font-bold text-green-600">{(caisse?.total || 0).toFixed(2)}</p>
                  <p className="text-sm text-gray-500 mt-1">Total MAD</p>
                  <p className="text-xs text-gray-400 mt-1">{caisse?.paiements?.length || 0} transaction(s)</p>
                </div>
                {Object.entries(caisse?.parType || {}).map(([type, montant]: [string, any]) => {
                  const icons: Record<string, string> = { ESPECE: '💵', CARTE: '💳', CHEQUE: '📝', ASSURANCE: '🏥' };
                  return (
                    <div key={type} className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                      <p className="text-xl font-bold text-gray-800">{(montant as number).toFixed(2)}</p>
                      <p className="text-sm text-gray-500 mt-1">{icons[type] || ''} {type}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">
                    Transactions du {new Date(date).toLocaleDateString('fr-MA')}
                  </h2>
                </div>
                {!caisse?.paiements?.length ? (
                  <p className="text-center text-gray-400 py-8">Aucune transaction ce jour</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Heure', 'Montant', 'Remise', 'Net', 'Mode', 'Description'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {caisse.paiements.map((p: any) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {new Date(p.dateHeure).toLocaleTimeString('fr-MA', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">{p.montant} MAD</td>
                          <td className="px-4 py-3 text-sm text-red-500">
                            {p.montantRemise > 0 ? `-${p.montantRemise}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-green-700">
                            {(p.montant - p.montantRemise).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">{p.typePaiement}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{p.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'rapport' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Du:</label>
              <input
                type="date"
                value={rapportDebut}
                onChange={e => setRapportDebut(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Au:</label>
              <input
                type="date"
                value={rapportFin}
                onChange={e => setRapportFin(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {rapport && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <p className="text-3xl font-bold text-green-600">{(rapport.total || 0).toFixed(2)}</p>
                <p className="text-sm text-gray-500 mt-1">Recette totale (MAD)</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <p className="text-3xl font-bold text-blue-600">{rapport.count || 0}</p>
                <p className="text-sm text-gray-500 mt-1">Transactions</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <p className="text-3xl font-bold text-gray-700">
                  {rapport.count > 0 ? ((rapport.total || 0) / rapport.count).toFixed(0) : 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">Moyenne / transaction (MAD)</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
