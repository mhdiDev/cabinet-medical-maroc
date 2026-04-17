'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ConsultationForm {
  motif: string;
  anamnese: string;
  examenClinique: string;
  diagnostic: string;
  traitement: string;
  notes: string;
  actes: string;
}

export default function NouvelleConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const { user } = useAuthStore();

  const { data: patient } = useQuery({
    queryKey: ['patient-mini', patientId],
    queryFn: () => apiClient.get(`/patients/${patientId}`).then(r => r.data),
    enabled: !!patientId,
  });

  const { register, handleSubmit } = useForm<ConsultationForm>();

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/consultations', data),
    onSuccess: res => {
      toast.success('Consultation enregistrée');
      router.push(`/consultations/${res.data.id}`);
    },
    onError: () => toast.error('Erreur lors de l\'enregistrement'),
  });

  const onSubmit = (data: ConsultationForm) => {
    mutation.mutate({
      patientId,
      medecinId: user?.id,
      motif: data.motif || undefined,
      anamnese: data.anamnese || undefined,
      examenClinique: data.examenClinique || undefined,
      diagnostic: data.diagnostic || undefined,
      traitement: data.traitement || undefined,
      notes: data.notes || undefined,
      actes: data.actes
        ? data.actes.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [],
    });
  };

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none';
  const textareaClass = inputClass + ' resize-none';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={patientId ? `/patients/${patientId}` : '/patients'} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle consultation</h1>
      </div>

      {patient && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
            {patient.prenom?.[0]}{patient.nom?.[0]}
          </div>
          <div>
            <p className="font-semibold text-blue-900">{patient.prenom} {patient.nom}</p>
            <p className="text-sm text-blue-600">
              {new Date(patient.dateNaissance).toLocaleDateString('fr-MA')} ·{' '}
              {patient.groupeSanguin || 'Groupe sg. inconnu'}
            </p>
          </div>
          {patient.allergies?.length > 0 && (
            <div className="ml-auto">
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                ⚠️ Allergies: {patient.allergies.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Motif & Anamnèse</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Motif de consultation</label>
              <input {...register('motif')} placeholder="Fièvre, douleur abdominale..." className={inputClass + ' mt-1'} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Anamnèse</label>
              <textarea {...register('anamnese')} rows={3} placeholder="Histoire de la maladie..." className={textareaClass + ' mt-1'} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Examen clinique</h2>
          <textarea
            {...register('examenClinique')}
            rows={4}
            placeholder="TA: 120/80 mmHg, FC: 72 bpm, T°: 37.2°C&#10;Examen général: bon état général..."
            className={textareaClass}
          />
        </section>

        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Diagnostic & Traitement</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Diagnostic</label>
              <textarea {...register('diagnostic')} rows={2} placeholder="Diagnostic principal et différentiel..." className={textareaClass + ' mt-1'} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Traitement prescrit</label>
              <textarea {...register('traitement')} rows={2} placeholder="Médicaments, posologie, durée..." className={textareaClass + ' mt-1'} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Actes réalisés (séparés par virgule)</label>
              <input
                {...register('actes')}
                placeholder="ECG, Suture, Injection..."
                className={inputClass + ' mt-1'}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Notes complémentaires</h2>
          <textarea {...register('notes')} rows={3} placeholder="Observations, recommandations, suivi..." className={textareaClass} />
        </section>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href={patientId ? `/patients/${patientId}` : '/patients'}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending || !patientId}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Enregistrement...' : 'Enregistrer la consultation'}
          </button>
        </div>
      </form>
    </div>
  );
}
