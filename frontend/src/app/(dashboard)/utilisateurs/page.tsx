'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import { ResetModal } from '@/components/utilisateurs/ResetModal';
import { CreateUserModal } from '@/components/utilisateurs/CreateUserModal';
import type { Utilisateur } from '@/components/utilisateurs/types';

export default function UtilisateursPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [cible, setCible] = useState<Utilisateur | null>(null);
  const [creation, setCreation] = useState(false);
  const estAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (!estAdmin) router.replace('/dashboard');
  }, [estAdmin, router]);

  const { data: utilisateurs = [], isLoading } = useQuery<Utilisateur[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/auth/users').then(r => r.data),
    enabled: estAdmin,
  });

  if (!estAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <button
          onClick={() => setCreation(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + Nouvel utilisateur
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Chargement...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {utilisateurs.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.prenom} {u.nom}</p>
                      <p className="text-xs text-gray-400 sm:hidden">{u.email} · {u.role}</p>
                      {u.doitChangerMdp && (
                        <span className="text-xs text-orange-600 font-medium">Changement requis</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{u.role}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full ${u.actif ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== user?.id && (
                        <button
                          onClick={() => setCible(u)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Réinitialiser le mot de passe
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cible && <ResetModal utilisateur={cible} onClose={() => setCible(null)} />}
      {creation && <CreateUserModal onClose={() => setCreation(false)} />}
    </div>
  );
}
