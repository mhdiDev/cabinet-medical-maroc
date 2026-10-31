'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: 'ADMIN' | 'MEDECIN' | 'SECRETAIRE';
  actif: boolean;
  doitChangerMdp: boolean;
}

export default function UtilisateursPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [cible, setCible] = useState<Utilisateur | null>(null);
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
      <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>

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
    </div>
  );
}

const resetSchema = z
  .object({
    nouveauMdp: z.string().min(8, '8 caractères minimum'),
    confirmation: z.string(),
  })
  .refine(d => d.nouveauMdp === d.confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmation'],
  });

type ResetForm = z.infer<typeof resetSchema>;

function ResetModal({ utilisateur, onClose }: { utilisateur: Utilisateur; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const mutation = useMutation({
    mutationFn: (data: ResetForm) =>
      apiClient.post(`/auth/users/${utilisateur.id}/reset-password`, { nouveauMdp: data.nouveauMdp }),
    onSuccess: () => {
      toast.success(
        'Mot de passe réinitialisé. Communiquez-le à l’utilisateur : il devra le changer à sa prochaine connexion.',
        { duration: 6000 },
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg mb-1">Réinitialiser le mot de passe</h2>
        <p className="text-sm text-gray-500 mb-4">{utilisateur.prenom} {utilisateur.nom} — {utilisateur.email}</p>
        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Mot de passe temporaire</label>
            <input type="password" autoComplete="new-password" {...register('nouveauMdp')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
            {errors.nouveauMdp && <p className="text-xs text-red-600 mt-1">{errors.nouveauMdp.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmation</label>
            <input type="password" autoComplete="new-password" {...register('confirmation')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
            {errors.confirmation && <p className="text-xs text-red-600 mt-1">{errors.confirmation.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {mutation.isPending ? '...' : 'Réinitialiser'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
