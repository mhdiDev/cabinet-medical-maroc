'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { MotDePasseGenere } from '@/components/utilisateurs/MotDePasseGenere';
import { TELEPHONE } from './types';

const schema = z.object({
  nom: z.string().trim().min(1, 'Nom requis'),
  adresse: z.string().trim().min(1, 'Adresse requise'),
  ville: z.string().trim().min(1, 'Ville requise'),
  telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide'),
  titulaire: z.object({
    prenom: z.string().trim().min(1, 'Prénom requis'),
    nom: z.string().trim().min(1, 'Nom requis'),
    email: z.string().trim().email('Email invalide'),
    telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide').or(z.literal('')),
  }),
});

type FormData = z.infer<typeof schema>;

interface Reponse {
  titulaire: { email: string; nom: string; prenom: string };
  motDePasseInitial: string;
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1';
const errClass = 'text-xs text-red-600 mt-1';
const labelClass = 'text-sm font-medium text-gray-700';

export function CreateCabinetModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cree, setCree] = useState<Reponse | null>(null);
  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiClient
        .post<Reponse>('/plateforme/cabinets', {
          ...data,
          titulaire: { ...data.titulaire, telephone: data.titulaire.telephone || undefined },
        })
        .then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      setCree(data);
    },
    onError: (err: any) => {
      if (err.response?.status === 409) {
        setError('titulaire.email', { message: 'Email déjà utilisé' });
        return;
      }
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || 'Erreur lors de la création');
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {cree ? (
          <MotDePasseGenere
            titre="Cabinet créé"
            utilisateur={cree.titulaire}
            motDePasse={cree.motDePasseInitial}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 className="font-bold text-lg mb-4">Nouveau cabinet</h2>
            <form noValidate onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-900 mb-1">Cabinet</legend>
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
                    <input {...register('telephone')} placeholder="0522123456" className={inputClass} />
                    {errors.telephone && <p className={errClass}>{errors.telephone.message}</p>}
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-900 mb-1">Médecin titulaire</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Prénom *</label>
                    <input {...register('titulaire.prenom')} className={inputClass} />
                    {errors.titulaire?.prenom && <p className={errClass}>{errors.titulaire.prenom.message}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Nom *</label>
                    <input {...register('titulaire.nom')} className={inputClass} />
                    {errors.titulaire?.nom && <p className={errClass}>{errors.titulaire.nom.message}</p>}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input type="email" autoComplete="off" {...register('titulaire.email')} className={inputClass} />
                  {errors.titulaire?.email && <p className={errClass}>{errors.titulaire.email.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input {...register('titulaire.telephone')} placeholder="0612345678" className={inputClass} />
                  {errors.titulaire?.telephone && <p className={errClass}>{errors.titulaire.telephone.message}</p>}
                </div>
              </fieldset>

              <p className="text-xs text-gray-500">
                Un mot de passe initial sera généré pour le titulaire et affiché une seule fois.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
                  Annuler
                </button>
                <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {mutation.isPending ? '...' : 'Créer'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
