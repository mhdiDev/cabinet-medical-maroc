'use client';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useModale } from '@/components/commun/useModale';
import { TELEPHONE, type Utilisateur } from './types';

const schema = z.object({
  prenom: z.string().trim().min(1, 'Prénom requis'),
  nom: z.string().trim().min(1, 'Nom requis'),
  email: z.string().trim().email('Email invalide'),
  telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide').or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1 disabled:bg-gray-100 disabled:text-gray-500';
const errClass = 'text-xs text-red-600 mt-1';
const labelClass = 'text-sm font-medium text-gray-700';

export function EditUserModal({ utilisateur, onClose }: { utilisateur: Utilisateur; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user: moi, setUser } = useAuthStore();
  const soiMeme = moi?.id === utilisateur.id;

  const initial: FormData = {
    prenom: utilisateur.prenom,
    nom: utilisateur.nom,
    email: utilisateur.email,
    telephone: utilisateur.telephone ?? '',
  };
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  const mutation = useMutation({
    mutationFn: (changes: Partial<FormData>) =>
      apiClient.patch<Utilisateur>(`/auth/users/${utilisateur.id}`, changes).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (soiMeme && moi) setUser({ ...moi, nom: data.nom, prenom: data.prenom });
      toast.success('Compte modifié');
      onClose();
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setError('email', { message: 'Email déjà utilisé' });
        return;
      }
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Erreur lors de la modification');
    },
  });

  const envoyer = (data: FormData) => {
    // N'envoie que les champs modifiés ; son propre email n'est jamais envoyé
    const changes = Object.fromEntries(
      (Object.keys(data) as (keyof FormData)[])
        .filter(k => !(soiMeme && k === 'email'))
        .filter(k => data[k].trim() !== initial[k])
        .map(k => [k, data[k].trim()]),
    ) as Partial<FormData>;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    mutation.mutate(changes);
  };

  const uid = useId();
  const titreId = `${uid}-titre`;
  const champ = (nom: string, e?: { message?: string }) => ({
    id: `${uid}-${nom}`,
    'aria-invalid': !!e,
    'aria-describedby': e ? `${uid}-${nom}-err` : undefined,
  });
  const erreur = (nom: string, e?: { message?: string }) =>
    e && <p id={`${uid}-${nom}-err`} className={errClass}>{e.message}</p>;
  const modaleRef = useModale(onClose, mutation.isPending);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modaleRef} role="dialog" aria-modal="true" aria-labelledby={titreId} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 id={titreId} className="font-bold text-lg mb-4">Modifier {utilisateur.prenom} {utilisateur.nom}</h2>
        <form noValidate onSubmit={handleSubmit(envoyer)} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-prenom`} className={labelClass}>Prénom *</label>
              <input {...register('prenom')} data-autofocus {...champ('prenom', errors.prenom)} className={inputClass} />
              {erreur('prenom', errors.prenom)}
            </div>
            <div>
              <label htmlFor={`${uid}-nom`} className={labelClass}>Nom *</label>
              <input {...register('nom')} {...champ('nom', errors.nom)} className={inputClass} />
              {erreur('nom', errors.nom)}
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-email`} className={labelClass}>Email *</label>
            <input type="email" autoComplete="off" disabled={soiMeme} {...register('email')} {...champ('email', errors.email)} className={inputClass} />
            {soiMeme && <p className="text-xs text-gray-500 mt-1">Vous ne pouvez pas modifier votre propre email.</p>}
            {erreur('email', errors.email)}
          </div>
          <div>
            <label htmlFor={`${uid}-telephone`} className={labelClass}>Téléphone</label>
            <input {...register('telephone')} placeholder="0612345678" {...champ('telephone', errors.telephone)} className={inputClass} />
            {erreur('telephone', errors.telephone)}
          </div>
          {!soiMeme && (
            <p className="text-xs text-gray-500">Si l&apos;email change, la personne est déconnectée et se reconnecte avec le nouvel email, sans changer de mot de passe.</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
              Annuler
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              {mutation.isPending ? '...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
