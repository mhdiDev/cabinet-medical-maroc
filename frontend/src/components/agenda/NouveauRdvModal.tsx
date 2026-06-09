'use client';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

interface Props {
  defaultDate?: Date | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function NouveauRdvModal({ defaultDate, onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      medecinId: user?.id || '',
      dateHeure: defaultDate ? new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
      dureeMinutes: 30,
    },
  });

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-search'],
    queryFn: () => apiClient.get('/patients', { params: { limit: 100 } }).then(r => r.data.data),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/rendez-vous', data),
    onSuccess: () => { toast.success('Rendez-vous créé'); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg mb-4">Nouveau rendez-vous</h2>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Patient *</label>
            <select {...register('patientId', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
              <option value="">Sélectionner un patient...</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom} — {p.telephone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Date & heure *</label>
            <input {...register('dateHeure', { required: true })} type="datetime-local"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Durée (minutes)</label>
            <select {...register('dureeMinutes')} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 heure</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Motif</label>
            <input {...register('motif')} placeholder="Consultation, suivi..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm">
              {mutation.isPending ? '...' : 'Créer le RDV'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
