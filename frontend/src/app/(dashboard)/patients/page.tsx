'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { SearchInput } from '@/components/ui/SearchInput';
import toast from 'react-hot-toast';

export default function PatientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['patients', search, page],
    queryFn: () => apiClient.get('/patients', { params: { q: search || undefined, page, limit: 20 } }).then(r => r.data),
    staleTime: 10000,
  });

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
      <div className="flex items-center justify-between">
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
        placeholder="Rechercher par nom, CIN, téléphone..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Nom', 'Date naiss.', 'CIN', 'Téléphone', 'Ville', 'Groupe sg.', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data?.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.prenom} {p.nom}</p>
                      <p className="text-xs text-gray-500">{p.sexe === 'MASCULIN' ? 'M' : 'F'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(p.dateNaissance).toLocaleDateString('fr-MA')}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{p.cin || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.telephone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.ville || '—'}</td>
                    <td className="px-4 py-3">
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
