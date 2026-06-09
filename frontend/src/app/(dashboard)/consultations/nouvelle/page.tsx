'use client';
import { useState, useEffect, useRef } from 'react';
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

interface Patient {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  groupeSanguin?: string;
  allergies: string[];
  cin?: string;
  telephone: string;
}

export default function NouvelleConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === 'SECRETAIRE') {
      router.replace('/patients');
    }
  }, [user, router]);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Pré-remplir le patient si patientId passé en query param
  const preloadId = searchParams.get('patientId');
  useQuery({
    queryKey: ['patient-preload', preloadId],
    queryFn: () => apiClient.get(`/patients/${preloadId}`).then(r => r.data),
    enabled: !!preloadId && !selectedPatient,
    onSuccess: (data: Patient) => setSelectedPatient(data),
  } as any);

  // Recherche patients avec debounce
  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['patients-search', search],
    queryFn: () =>
      apiClient
        .get('/patients', { params: { q: search, limit: 8 } })
        .then(r => r.data.data as Patient[]),
    enabled: search.length >= 1,
    staleTime: 5000,
  });

  // Fermer le dropdown en cliquant ailleurs
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { register, handleSubmit } = useForm<ConsultationForm>();

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/consultations', data),
    onSuccess: (res) => {
      toast.success('Consultation enregistrée — vous pouvez ajouter une ordonnance');
      const today = new Date().toISOString().split('T')[0];
      router.push(`/paiements?consultationId=${res.data.id}&date=${today}`);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement"),
  });

  const onSubmit = (data: ConsultationForm) => {
    if (!selectedPatient) {
      toast.error('Veuillez sélectionner un patient');
      return;
    }
    mutation.mutate({
      patientId: selectedPatient.id,
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

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setSearch('');
    setShowDropdown(false);
  };

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition';
  const textareaClass = inputClass + ' resize-none';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Link
          href={selectedPatient ? `/patients/${selectedPatient.id}` : '/patients'}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ← Retour
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle consultation</h1>
      </div>

      {/* Sélecteur patient */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-700 mb-3">Patient *</h2>

        {selectedPatient ? (
          /* Patient sélectionné — carte récapitulative */
          <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
              {selectedPatient.prenom?.[0]}
              {selectedPatient.nom?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-900">
                {selectedPatient.prenom} {selectedPatient.nom}
              </p>
              <p className="text-sm text-blue-600">
                {new Date(selectedPatient.dateNaissance).toLocaleDateString('fr-MA')}
                {selectedPatient.cin && ` · CIN: ${selectedPatient.cin}`}
                {selectedPatient.groupeSanguin && ` · ${selectedPatient.groupeSanguin}`}
              </p>
              {selectedPatient.allergies?.length > 0 && (
                <p className="text-xs text-red-600 mt-0.5 font-medium">
                  ⚠️ Allergies : {selectedPatient.allergies.join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedPatient(null)}
              className="text-sm text-gray-400 hover:text-red-500 transition shrink-0"
              title="Changer de patient"
            >
              Changer ✕
            </button>
          </div>
        ) : (
          /* Champ de recherche patient */
          <div ref={dropdownRef} className="relative">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                type="text"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Rechercher par nom, CIN ou téléphone..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
              />
              {isFetching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </span>
              )}
            </div>

            {/* Dropdown résultats */}
            {showDropdown && search.length >= 1 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400 flex items-center justify-between">
                    <span>Aucun patient trouvé</span>
                    <Link
                      href={`/patients/nouveau`}
                      className="text-blue-600 hover:underline text-xs"
                      onClick={() => setShowDropdown(false)}
                    >
                      + Créer un patient
                    </Link>
                  </div>
                ) : (
                  searchResults.map((p: Patient) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center gap-3 border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                        {p.prenom?.[0]}{p.nom?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {p.prenom} {p.nom}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {p.cin ? `CIN: ${p.cin} · ` : ''}{p.telephone}
                        </p>
                      </div>
                      {p.allergies?.length > 0 && (
                        <span className="text-xs text-red-500 shrink-0">⚠️</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formulaire médical */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6"
      >
        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Motif & Anamnèse</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Motif de consultation</label>
              <input
                {...register('motif')}
                placeholder="Fièvre, douleur abdominale..."
                className={inputClass + ' mt-1'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Anamnèse</label>
              <textarea
                {...register('anamnese')}
                rows={3}
                placeholder="Histoire de la maladie..."
                className={textareaClass + ' mt-1'}
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Examen clinique</h2>
          <textarea
            {...register('examenClinique')}
            rows={4}
            placeholder="TA: 120/80 mmHg, FC: 72 bpm, T°: 37.2°C"
            className={textareaClass}
          />
        </section>

        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Diagnostic & Traitement</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Diagnostic</label>
              <textarea
                {...register('diagnostic')}
                rows={2}
                placeholder="Diagnostic principal et différentiel..."
                className={textareaClass + ' mt-1'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Traitement prescrit</label>
              <textarea
                {...register('traitement')}
                rows={2}
                placeholder="Médicaments, posologie, durée..."
                className={textareaClass + ' mt-1'}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">
                Actes réalisés{' '}
                <span className="font-normal text-gray-400">(séparés par virgule)</span>
              </label>
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
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Observations, recommandations, suivi..."
            className={textareaClass}
          />
        </section>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href={selectedPatient ? `/patients/${selectedPatient.id}` : '/patients'}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-center"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending || !selectedPatient}
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            title={!selectedPatient ? 'Sélectionnez un patient pour continuer' : ''}
          >
            {mutation.isPending ? 'Enregistrement...' : 'Enregistrer la consultation'}
          </button>
        </div>
      </form>
    </div>
  );
}
