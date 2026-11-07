'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import type { Cabinet } from '@/components/cabinets/types';
import { CreateCabinetModal } from '@/components/cabinets/CreateCabinetModal';
import { EditCabinetModal } from '@/components/cabinets/EditCabinetModal';
import { StatutCabinetModal } from '@/components/cabinets/StatutCabinetModal';
import { ResetTitulaireModal } from '@/components/cabinets/ResetTitulaireModal';

type Action = { type: 'modifier' | 'statut' | 'reset'; cabinet: Cabinet };

export default function CabinetsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const estSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [creation, setCreation] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  useEffect(() => {
    if (user && !estSuperAdmin) router.replace('/dashboard');
  }, [user, estSuperAdmin, router]);

  const { data: cabinets = [], isLoading } = useQuery<Cabinet[]>({
    queryKey: ['cabinets'],
    queryFn: () => apiClient.get('/plateforme/cabinets').then(r => r.data),
    enabled: estSuperAdmin,
  });

  if (!estSuperAdmin) return null;

  const fermer = () => setAction(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Cabinets</h1>
        <button
          onClick={() => setCreation(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + Nouveau cabinet
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Chargement...</p>
        ) : cabinets.length === 0 ? (
          <p className="p-6 text-sm text-gray-400">Aucun cabinet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cabinet</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Titulaire</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Utilisateurs</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">État</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Créé le</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cabinets.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{c.nom}</p>
                      <p className="text-xs text-gray-400">{c.ville} · {c.telephone}</p>
                      <p className="text-xs text-gray-400 sm:hidden">
                        {c.titulaire ? `${c.titulaire.prenom} ${c.titulaire.nom}` : 'Aucun titulaire'} · {c.actif ? 'Actif' : 'Suspendu'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                      {c.titulaire ? (
                        <>
                          <p>{c.titulaire.prenom} {c.titulaire.nom}</p>
                          <p className="text-xs text-gray-400">{c.titulaire.email}</p>
                        </>
                      ) : (
                        <span className="text-gray-400">Aucun titulaire</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{c.nbUtilisateurs}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full ${c.actif ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.actif ? 'Actif' : 'Suspendu'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                      {new Date(c.createdAt).toLocaleDateString('fr-MA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <button onClick={() => setAction({ type: 'modifier', cabinet: c })} className="text-xs text-blue-600 hover:underline">
                          Modifier
                        </button>
                        <button onClick={() => setAction({ type: 'statut', cabinet: c })} className={`text-xs hover:underline ${c.actif ? 'text-red-600' : 'text-green-700'}`}>
                          {c.actif ? 'Suspendre' : 'Réactiver'}
                        </button>
                        {c.titulaire && (
                          <button onClick={() => setAction({ type: 'reset', cabinet: c })} className="text-xs text-blue-600 hover:underline">
                            Réinitialiser le titulaire
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creation && <CreateCabinetModal onClose={() => setCreation(false)} />}
      {action?.type === 'modifier' && <EditCabinetModal cabinet={action.cabinet} onClose={fermer} />}
      {action?.type === 'statut' && <StatutCabinetModal cabinet={action.cabinet} onClose={fermer} />}
      {action?.type === 'reset' && action.cabinet.titulaire && (
        <ResetTitulaireModal cabinet={action.cabinet} titulaire={action.cabinet.titulaire} onClose={fermer} />
      )}
    </div>
  );
}
