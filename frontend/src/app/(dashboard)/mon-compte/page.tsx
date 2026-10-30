'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

const schema = z
  .object({
    ancienMdp: z.string().min(1, 'Mot de passe actuel requis'),
    nouveauMdp: z.string().min(8, '8 caractères minimum'),
    confirmation: z.string(),
  })
  .refine(d => d.nouveauMdp === d.confirmation, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmation'],
  })
  .refine(d => d.nouveauMdp !== d.ancienMdp, {
    message: 'Le nouveau mot de passe doit être différent de l\'actuel',
    path: ['nouveauMdp'],
  });

type FormData = z.infer<typeof schema>;

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1';

export default function MonComptePage() {
  const router = useRouter();
  const { user, setTokens, setDoitChangerMdp } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const force = !!user?.doitChangerMdp;

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/change-password', {
        ancienMdp: data.ancienMdp,
        nouveauMdp: data.nouveauMdp,
      });
      setTokens(res.data.accessToken, res.data.refreshToken);
      setDoitChangerMdp(false);
      reset();
      toast.success('Mot de passe modifié');
      if (force) router.replace('/dashboard');
    } catch (err: any) {
      const message = err.response?.data?.message;
      if (message === 'Ancien mot de passe incorrect') {
        setError('ancienMdp', { message: 'Mot de passe actuel incorrect' });
      } else {
        toast.error(message || 'Erreur lors du changement de mot de passe');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>

      {force && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          Votre mot de passe a été réinitialisé par l&apos;administrateur. Choisissez un nouveau
          mot de passe pour continuer.
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-2">
        <p className="text-sm text-gray-500">Nom</p>
        <p className="font-medium text-gray-900">{user?.prenom} {user?.nom}</p>
        <p className="text-sm text-gray-500 pt-2">Email</p>
        <p className="font-medium text-gray-900">{user?.email}</p>
        <p className="text-sm text-gray-500 pt-2">Rôle</p>
        <p className="font-medium text-gray-900">{user?.role}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-lg mb-4">Changer le mot de passe</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">
              {force ? 'Mot de passe temporaire (communiqué par l’administrateur)' : 'Mot de passe actuel'}
            </label>
            <input type="password" autoComplete="current-password" {...register('ancienMdp')} className={inputClass} />
            {errors.ancienMdp && <p className="text-xs text-red-600 mt-1">{errors.ancienMdp.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Nouveau mot de passe</label>
            <input type="password" autoComplete="new-password" {...register('nouveauMdp')} className={inputClass} />
            {errors.nouveauMdp && <p className="text-xs text-red-600 mt-1">{errors.nouveauMdp.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Confirmer le nouveau mot de passe</label>
            <input type="password" autoComplete="new-password" {...register('confirmation')} className={inputClass} />
            {errors.confirmation && <p className="text-xs text-red-600 mt-1">{errors.confirmation.message}</p>}
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '...' : 'Modifier le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
