'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { SearchInput } from '@/components/ui/SearchInput';
import { MedicamentAutocomplete } from '@/components/ordonnances/MedicamentAutocomplete';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  cin?: string;
  telephone: string;
  groupeSanguin?: string;
  allergies: string[];
}

interface Ligne {
  nomLibre: string;
  medicamentId?: string;
  posologie: string;
  duree: string;
  quantite: number;
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function OrdonnancesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['ordonnances', search, page],
    queryFn: () =>
      apiClient
        .get('/ordonnances', { params: { q: search || undefined, page, limit: 20 } })
        .then((r) => r.data),
    staleTime: 10000,
  });

  const downloadPdf = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.get(`/ordonnances/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast.error('Impossible de générer le PDF');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Ordonnances</h1>
        {user?.role !== 'SECRETAIRE' && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
          >
            + Nouvelle ordonnance
          </button>
        )}
      </div>

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Rechercher par patient ou médecin..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Médicaments</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Médecin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {!data?.data?.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                      <p className="mb-2">Aucune ordonnance trouvée</p>
                      <button
                        onClick={() => setShowModal(true)}
                        className="text-blue-600 text-sm underline"
                      >
                        Créer la première ordonnance
                      </button>
                    </td>
                  </tr>
                ) : (
                  data.data.map((o: any) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleDateString('fr-MA')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/patients/${o.patientId}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {o.patient?.prenom} {o.patient?.nom}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[220px]">
                        {o.medicaments?.length > 0 ? (
                          <span>
                            {o.medicaments
                              .slice(0, 2)
                              .map((m: any) => m.medicament?.nom || m.nomLibre)
                              .filter(Boolean)
                              .join(', ')}
                            {o.medicaments.length > 2 && (
                              <span className="text-gray-400"> +{o.medicaments.length - 2}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{o.medecinNom}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/ordonnances/${o.id}`}
                            className="text-blue-600 text-sm hover:underline"
                          >
                            Voir
                          </Link>
                          <button
                            onClick={(e) => downloadPdf(o.id, e)}
                            className="text-green-600 text-sm hover:underline"
                          >
                            📄 PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>

            {data?.meta && data.meta.pages > 1 && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">{data.meta.total} ordonnance(s)</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40"
                  >
                    Précédent
                  </button>
                  <span className="px-3 py-1 text-sm">
                    {page} / {data.meta.pages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(data.meta.pages, p + 1))}
                    disabled={page >= data.meta.pages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <NouvelleOrdonnanceModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['ordonnances'] });
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal création ordonnance ────────────────────────────────────────────────

function NouvelleOrdonnanceModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();

  // Sélection patient
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const patientDropRef = useRef<HTMLDivElement>(null);

  // Infos médecin (pré-remplies depuis le compte connecté, modifiables)
  const [medecinNom, setMedecinNom] = useState(
    user ? `Dr ${user.prenom} ${user.nom}` : '',
  );
  const [notes, setNotes] = useState('');

  // Lignes médicaments
  const [lignes, setLignes] = useState<Ligne[]>([
    { nomLibre: '', posologie: '', duree: '', quantite: 1 },
  ]);

  // Fermer dropdown patient en cliquant dehors
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (patientDropRef.current && !patientDropRef.current.contains(e.target as Node)) {
        setShowPatientDrop(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const { data: patientResults = [], isFetching: fetchingPatients } = useQuery({
    queryKey: ['patients-ord-search', patientSearch],
    queryFn: () =>
      apiClient
        .get('/patients', { params: { q: patientSearch, limit: 8 } })
        .then((r) => r.data.data as Patient[]),
    enabled: patientSearch.length >= 1,
    staleTime: 5000,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/ordonnances', data),
    onSuccess,
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Erreur lors de la création'),
  });

  // Gestion lignes médicaments
  const addLigne = () =>
    setLignes((l) => [...l, { nomLibre: '', posologie: '', duree: '', quantite: 1 }]);

  const removeLigne = (i: number) => setLignes((l) => l.filter((_, idx) => idx !== i));

  const updateLigne = (i: number, field: keyof Ligne, value: any) =>
    setLignes((l) => l.map((ligne, idx) => (idx === i ? { ...ligne, [field]: value } : ligne)));

  const submit = () => {
    if (!selectedPatient) {
      toast.error('Sélectionnez un patient');
      return;
    }
    if (!medecinNom.trim()) {
      toast.error('Le nom du médecin est requis');
      return;
    }
    const valides = lignes.filter((l) => l.nomLibre.trim() && l.posologie.trim());
    if (!valides.length) {
      toast.error('Ajoutez au moins un médicament avec sa posologie');
      return;
    }

    mutation.mutate({
      patientId: selectedPatient.id,
      medecinNom: medecinNom.trim(),
      notes: notes.trim() || undefined,
      medicaments: valides.map((l) => ({
        nomLibre: l.nomLibre,
        medicamentId: l.medicamentId || undefined,
        posologie: l.posologie,
        duree: l.duree || undefined,
        quantite: l.quantite || 1,
      })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-lg text-gray-900">Nouvelle ordonnance</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Sélection patient ── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Patient *</h3>

            {selectedPatient ? (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {selectedPatient.prenom?.[0]}{selectedPatient.nom?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-blue-900 text-sm">
                    {selectedPatient.prenom} {selectedPatient.nom}
                  </p>
                  <p className="text-xs text-blue-600">
                    {new Date(selectedPatient.dateNaissance).toLocaleDateString('fr-MA')}
                    {selectedPatient.groupeSanguin && ` · ${selectedPatient.groupeSanguin}`}
                  </p>
                  {selectedPatient.allergies?.length > 0 && (
                    <p className="text-xs text-red-600 font-medium mt-0.5">
                      ⚠️ Allergies : {selectedPatient.allergies.join(', ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                >
                  Changer ✕
                </button>
              </div>
            ) : (
              <div ref={patientDropRef} className="relative">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setShowPatientDrop(true);
                    }}
                    onFocus={() => setShowPatientDrop(true)}
                    placeholder="Rechercher un patient..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  {fetchingPatients && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {showPatientDrop && patientSearch.length >= 1 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {(patientResults as Patient[]).length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">Aucun patient trouvé</p>
                    ) : (
                      (patientResults as Patient[]).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p);
                            setPatientSearch('');
                            setShowPatientDrop(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition flex items-center gap-3 border-b border-gray-50 last:border-0"
                        >
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 shrink-0">
                            {p.prenom?.[0]}{p.nom?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {p.prenom} {p.nom}
                            </p>
                            <p className="text-xs text-gray-400">{p.telephone}</p>
                          </div>
                          {p.allergies?.length > 0 && (
                            <span className="ml-auto text-xs text-red-500">⚠️</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Infos médecin ── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Médecin</h3>
            <label className="text-xs text-gray-500">Nom complet *</label>
            <input
              value={medecinNom}
              onChange={(e) => setMedecinNom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </section>

          {/* ── Médicaments ── */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                Médicaments *
                <span className="ml-1 text-xs font-normal text-gray-400">
                  (recherche sur le référentiel CNOPS)
                </span>
              </h3>
              <button
                type="button"
                onClick={addLigne}
                className="text-xs text-blue-600 hover:underline"
              >
                + Ajouter
              </button>
            </div>

            <div className="space-y-3">
              {lignes.map((l, i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">
                      Médicament {i + 1}
                    </span>
                    {lignes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLigne(i)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        ✕ Retirer
                      </button>
                    )}
                  </div>

                  {/* Autocomplete CNOPS */}
                  <MedicamentAutocomplete
                    value={l.nomLibre}
                    onChange={(val, med) => {
                      updateLigne(i, 'nomLibre', val);
                      if (med) updateLigne(i, 'medicamentId', med.id);
                      else updateLigne(i, 'medicamentId', undefined);
                    }}
                    placeholder="Nom du médicament ou DCI..."
                  />

                  <input
                    value={l.posologie}
                    onChange={(e) => updateLigne(i, 'posologie', e.target.value)}
                    placeholder="Posologie * — ex: 1 comprimé matin et soir"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={l.duree}
                      onChange={(e) => updateLigne(i, 'duree', e.target.value)}
                      placeholder="Durée — ex: 7 jours"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 shrink-0">Qté</label>
                      <input
                        type="number"
                        value={l.quantite}
                        min={1}
                        onChange={(e) =>
                          updateLigne(i, 'quantite', parseInt(e.target.value) || 1)
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Notes ── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Instructions particulières, recommandations..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </section>
        </div>

        {/* Pied de page fixe */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={mutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {mutation.isPending ? 'Création...' : 'Créer l\'ordonnance'}
          </button>
        </div>
      </div>
    </div>
  );
}
