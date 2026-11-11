'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { SearchInput } from '@/components/ui/SearchInput';
import toast from 'react-hot-toast';

function ListePatients() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const dateUrl = params.get('date') ?? '';
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(dateUrl) ? dateUrl : '');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['patients', search, date, page],
    queryFn: () =>
      apiClient
        .get('/patients', { params: { q: search || undefined, date: date || undefined, page, limit: 20 } })
        .then(r => r.data),
    staleTime: 10000,
  });

  // Garde l'adresse alignée sur les filtres : retirer la pastille puis revenir
  // à la liste ne doit pas rétablir le filtre.
  useEffect(() => {
    const requete = new URLSearchParams();
    if (search) requete.set('q', search);
    if (date) requete.set('date', date);
    const texte = requete.toString();
    router.replace(texte ? `/patients?${texte}` : '/patients', { scroll: false });
  }, [search, date, router]);

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/patients/export/csv', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patients.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Erreur lors de l\'export');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        <div className="flex gap-3">
          <button onClick={handleExport} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Export CSV
          </button>
          <Link href="/patients/nouveau" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
            + Nouveau patient
          </Link>
        </div>
      </div>

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Rechercher par nom, téléphone..."
      />

      {date && (
        <div className="flex items-center gap-2 text-sm">
          <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
            Vus en consultation le {date.split('-').reverse().join('/')}
          </span>
          <button
            onClick={() => { setDate(''); setPage(1); }}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Retirer le filtre de date"
          >
            ✕
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : isError ? (
          <div className="p-8 text-center text-red-600">Erreur lors du chargement des patients</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Date naiss.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Téléphone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Ville</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Groupe sg.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.prenom} {p.nom}</p>
                      <p className="text-xs text-gray-500">{p.sexe === 'MASCULIN' ? 'M' : 'F'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {new Date(p.dateNaissance).toLocaleDateString('fr-MA')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.telephone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{p.ville || '—'}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {p.groupeSanguin && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded font-medium">{p.groupeSanguin}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/patients/${p.id}`} className="text-blue-600 text-sm hover:underline">
                        Voir fiche
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {data?.meta && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">{data.meta.total} patient(s)</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40">Précédent</button>
                  <span className="px-3 py-1 text-sm">{page} / {data.meta.pages}</span>
                  <button onClick={() => setPage(p => Math.min(data.meta.pages, p + 1))} disabled={page >= data.meta.pages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-40">Suivant</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense>
      <ListePatients />
    </Suspense>
  );
}
