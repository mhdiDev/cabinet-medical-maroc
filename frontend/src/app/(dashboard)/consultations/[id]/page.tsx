'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { MedicamentAutocomplete } from '@/components/ordonnances/MedicamentAutocomplete';
import toast from 'react-hot-toast';

export default function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuthStore();
  const [showOrdonnance, setShowOrdonnance] = useState(false);
  const queryClient = useQueryClient();

  const { data: consultation, isLoading } = useQuery({
    queryKey: ['consultation', params.id],
    queryFn: () => apiClient.get(`/consultations/${params.id}`).then(r => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;
  if (!consultation) return <div className="p-8 text-center text-red-500">Consultation introuvable</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/patients/${consultation.patientId}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Fiche patient
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            Consultation du {new Date(consultation.dateConsultation).toLocaleDateString('fr-MA')}
          </h1>
          <p className="text-sm text-gray-500">
            {consultation.patient?.prenom} {consultation.patient?.nom} · Dr {consultation.medecin?.prenom} {consultation.medecin?.nom}
          </p>
        </div>
        <button
          onClick={() => setShowOrdonnance(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          + Ordonnance
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {[
          { label: 'Motif', value: consultation.motif },
          { label: 'Anamnèse', value: consultation.anamnese },
          { label: 'Examen clinique', value: consultation.examenClinique },
          { label: 'Diagnostic', value: consultation.diagnostic },
          { label: 'Traitement', value: consultation.traitement },
          { label: 'Notes', value: consultation.notes },
        ].map(
          ({ label, value }) =>
            value && (
              <div key={label} className="px-6 py-4">
                <p className="text-xs font-semibold text-gray-400 uppercase mb-1">{label}</p>
                <p className="text-gray-800 whitespace-pre-wrap">{value}</p>
              </div>
            ),
        )}
        {consultation.actes?.length > 0 && (
          <div className="px-6 py-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Actes réalisés</p>
            <div className="flex flex-wrap gap-2">
              {consultation.actes.map((a: string) => (
                <span key={a} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {consultation.ordonnances?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Ordonnances</h2>
          <div className="space-y-2">
            {consultation.ordonnances.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <p className="text-sm">Ordonnance du {new Date(o.createdAt).toLocaleDateString('fr-MA')}</p>
                <button
                  onClick={async () => {
                    const res = await apiClient.get(`/ordonnances/${o.id}/pdf`, { responseType: 'blob' });
                    const url = URL.createObjectURL(res.data);
                    window.open(url, '_blank');
                  }}
                  className="text-blue-600 text-sm hover:underline"
                >
                  📄 PDF
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showOrdonnance && (
        <OrdonnanceModal
          patientId={consultation.patientId}
          consultationId={params.id}
          medecinNom={`Dr ${user?.prenom} ${user?.nom}`}
          onClose={() => setShowOrdonnance(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['consultation', params.id] });
            setShowOrdonnance(false);
            toast.success('Ordonnance créée');
          }}
        />
      )}
    </div>
  );
}

function OrdonnanceModal({ patientId, consultationId, medecinNom, onClose, onSuccess }: any) {
  interface Ligne {
    nomLibre: string;
    medicamentId?: string;
    posologie: string;
    duree: string;
    quantite: number;
  }

  const [lignes, setLignes] = useState<Ligne[]>([
    { nomLibre: '', posologie: '', duree: '', quantite: 1 },
  ]);
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/ordonnances', data),
    onSuccess,
    onError: () => toast.error('Erreur création ordonnance'),
  });

  const addLigne = () =>
    setLignes(l => [...l, { nomLibre: '', posologie: '', duree: '', quantite: 1 }]);
  const removeLigne = (i: number) => setLignes(l => l.filter((_, idx) => idx !== i));
  const updateLigne = (i: number, field: string, value: any) =>
    setLignes(l => l.map((ligne, idx) => (idx === i ? { ...ligne, [field]: value } : ligne)));

  const submit = () => {
    const valides = lignes.filter(l => l.nomLibre.trim() && l.posologie.trim());
    if (!valides.length) return toast.error('Au moins un médicament avec posologie requis');
    mutation.mutate({
      patientId,
      consultationId,
      medecinNom,
      medicaments: valides.map(l => ({
        nomLibre: l.nomLibre,
        medicamentId: l.medicamentId || undefined,
        posologie: l.posologie,
        duree: l.duree || undefined,
        quantite: l.quantite || 1,
      })),
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-1">Nouvelle ordonnance</h2>
        <p className="text-xs text-gray-400 mb-4">
          Tapez le nom ou la DCI — les médicaments du référentiel CNOPS apparaîtront en suggestion.
        </p>

        <div className="space-y-3 mb-4">
          {lignes.map((l, i) => (
            <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Médicament {i + 1}</p>
                {lignes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLigne(i)}
                    className="text-red-400 text-xs hover:text-red-600"
                  >
                    ✕ Retirer
                  </button>
                )}
              </div>

              {/* Autocomplete branché sur le référentiel CNOPS */}
              <MedicamentAutocomplete
                value={l.nomLibre}
                onChange={(val, med) => {
                  updateLigne(i, 'nomLibre', val);
                  if (med) updateLigne(i, 'medicamentId', med.id);
                }}
              />

              <input
                value={l.posologie}
                onChange={e => updateLigne(i, 'posologie', e.target.value)}
                placeholder="Posologie * (ex: 1 cp matin et soir pendant 7 jours)"
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={l.duree}
                  onChange={e => updateLigne(i, 'duree', e.target.value)}
                  placeholder="Durée (ex: 7 jours)"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
                <input
                  type="number"
                  value={l.quantite}
                  min={1}
                  onChange={e => updateLigne(i, 'quantite', parseInt(e.target.value) || 1)}
                  placeholder="Quantité"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addLigne}
          className="text-blue-600 text-sm hover:underline mb-4"
        >
          + Ajouter un médicament
        </button>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Instructions particulières..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 resize-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={mutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {mutation.isPending ? 'Génération...' : 'Créer l\'ordonnance'}
          </button>
        </div>
      </div>
    </div>
  );
}
