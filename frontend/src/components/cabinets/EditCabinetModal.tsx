'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { TELEPHONE, type Cabinet } from './types';

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="font-bold text-lg mb-4">Modifier {cabinet.nom}</h2>
        <form noValidate onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-3">
          <div>
            <label className={labelClass}>Nom *</label>
            <input {...register('nom')} className={inputClass} />
            {errors.nom && <p className={errClass}>{errors.nom.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Adresse *</label>
            <input {...register('adresse')} className={inputClass} />
            {errors.adresse && <p className={errClass}>{errors.adresse.message}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Ville *</label>
              <input {...register('ville')} className={inputClass} />
              {errors.ville && <p className={errClass}>{errors.ville.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Téléphone *</label>
              <input {...register('telephone')} className={inputClass} />
              {errors.telephone && <p className={errClass}>{errors.telephone.message}</p>}
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
