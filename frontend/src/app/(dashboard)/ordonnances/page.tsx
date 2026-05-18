'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { SearchInput } from '@/components/ui/SearchInput';

export default function OrdonnancesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['ordonnances', search, page],
    queryFn: () =>
      apiClient
        .get('/ordonnances', { params: { q: search || undefined, page, limit: 20 } })
        .then((r) => r.data),
    staleTime: 10000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ordonnances</h1>
      </div>

      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Rechercher par patient..."
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Patient', 'Médicaments', 'Médecin', ''].map((h) => (
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
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      Aucune ordonnance trouvée
                    </td>
                  </tr>
                )}
                {data?.data?.map((o: any) => (
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
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {o.medicaments?.length > 0 ? (
                        <span>
                          {o.medicaments
                            .slice(0, 2)
                            .map((m: any) => m.medicament?.nom || m.nomLibre)
                            .join(', ')}
                          {o.medicaments.length > 2 && ` +${o.medicaments.length - 2}`}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{o.medecinNom}</td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                      <Link
                        href={`/ordonnances/${o.id}`}
                        className="text-blue-600 text-sm hover:underline"
                      >
                        Voir
                      </Link>
                      <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/ordonnances/${o.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-green-600 text-sm hover:underline"
                      >
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data?.meta && (
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
    </div>
  );
}
