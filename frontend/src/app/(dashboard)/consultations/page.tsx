'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { SearchInput } from '@/components/ui/SearchInput';

export default function ConsultationsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['consultations', search, page],
    queryFn: () =>
      apiClient
        .get('/consultations', { params: { q: search || undefined, page, limit: 20 } })
        .then((r) => r.data),
    staleTime: 10000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Consultations</h1>
        <Link
          href="/consultations/nouvelle"
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + Nouvelle consultation
        </Link>
      </div>

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Rechercher par patient, motif, diagnostic..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Patient', 'Motif', 'Diagnostic', 'Médecin', ''].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      Aucune consultation trouvée
                    </td>
                  </tr>
                )}
                {data?.data?.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(c.dateConsultation).toLocaleDateString('fr-MA')}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/patients/${c.patientId}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {c.patient?.prenom} {c.patient?.nom}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                      {c.motif || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                      {c.diagnostic || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      Dr {c.medecin?.prenom} {c.medecin?.nom}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/consultations/${c.id}`}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.meta && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {data.meta.total} consultation(s)
                </p>
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
    </div>
  );
}
