'use client';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { TELEPHONE, type Cabinet } from './types';
import { useModale } from './useModale';

const schema = z.object({
  nom: z.string().trim().min(1, 'Nom requis'),
  adresse: z.string().trim().min(1, 'Adresse requise'),
  ville: z.string().trim().min(1, 'Ville requise'),
  telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide'),
});

type FormData = z.infer<typeof schema>;

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1';
const errClass = 'text-xs text-red-600 mt-1';
const labelClass = 'text-sm font-medium text-gray-700';

export function EditCabinetModal({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nom: cabinet.nom,
      adresse: cabinet.adresse,
      ville: cabinet.ville,
      telephone: cabinet.telephone,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) => apiClient.patch(`/plateforme/cabinets/${cabinet.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      toast.success('Cabinet modifié');
      onClose();
    },
    onError: (err: any) => {
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Erreur lors de la modification');
    },
  });

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
        <h2 id={titreId} className="font-bold text-lg mb-4">Modifier {cabinet.nom}</h2>
        <form noValidate onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
          <div>
            <label htmlFor={`${uid}-nom`} className={labelClass}>Nom *</label>
            <input {...register('nom')} data-autofocus {...champ('nom', errors.nom)} className={inputClass} />
            {erreur('nom', errors.nom)}
          </div>
          <div>
            <label htmlFor={`${uid}-adresse`} className={labelClass}>Adresse *</label>
            <input {...register('adresse')} {...champ('adresse', errors.adresse)} className={inputClass} />
            {erreur('adresse', errors.adresse)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-ville`} className={labelClass}>Ville *</label>
              <input {...register('ville')} {...champ('ville', errors.ville)} className={inputClass} />
              {erreur('ville', errors.ville)}
            </div>
            <div>
              <label htmlFor={`${uid}-telephone`} className={labelClass}>Téléphone *</label>
              <input {...register('telephone')} {...champ('telephone', errors.telephone)} className={inputClass} />
              {erreur('telephone', errors.telephone)}
            </div>
          </div>
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
