'use client';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { MotDePasseGenere } from '@/components/utilisateurs/MotDePasseGenere';
import { TELEPHONE } from './types';
import { useModale } from './useModale';

const schema = z.object({
  nom: z.string().trim().min(1, 'Nom requis'),
  adresse: z.string().trim().min(1, 'Adresse requise'),
  ville: z.string().trim().min(1, 'Ville requise'),
  telephone: z.string().trim().regex(TELEPHONE, 'Téléphone marocain invalide'),
  titulaire: z.object({
    prenom: z.string().trim().min(1, 'Prénom requis'),
    nom: z.string().trim().min(1, 'Nom requis'),
    email: z.string().trim().email('Email invalide'),
    telephone: z.string().trim().refine(v => v === '' || TELEPHONE.test(v), 'Téléphone marocain invalide'),
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

  const uid = useId();
  const titreId = `${uid}-titre`;
  const champ = (nom: string, e?: { message?: string }) => ({
    id: `${uid}-${nom}`,
    'aria-invalid': !!e,
    'aria-describedby': e ? `${uid}-${nom}-err` : undefined,
  });
  const erreur = (nom: string, e?: { message?: string }) =>
    e && <p id={`${uid}-${nom}-err`} className={errClass}>{e.message}</p>;
  const modaleRef = useModale(onClose, mutation.isPending || cree !== null);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modaleRef} role="dialog" aria-modal="true" aria-labelledby={titreId} className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        {cree ? (
          <MotDePasseGenere
            titre="Cabinet créé"
            utilisateur={cree.titulaire}
            motDePasse={cree.motDePasseInitial}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 id={titreId} className="font-bold text-lg mb-4">Nouveau cabinet</h2>
            <form noValidate onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-900 mb-1">Cabinet</legend>
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
                    <input {...register('telephone')} {...champ('telephone', errors.telephone)} placeholder="0522123456" className={inputClass} />
                    {erreur('telephone', errors.telephone)}
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-gray-900 mb-1">Médecin titulaire</legend>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`${uid}-t-prenom`} className={labelClass}>Prénom *</label>
                    <input {...register('titulaire.prenom')} {...champ('t-prenom', errors.titulaire?.prenom)} className={inputClass} />
                    {erreur('t-prenom', errors.titulaire?.prenom)}
                  </div>
                  <div>
                    <label htmlFor={`${uid}-t-nom`} className={labelClass}>Nom *</label>
                    <input {...register('titulaire.nom')} {...champ('t-nom', errors.titulaire?.nom)} className={inputClass} />
                    {erreur('t-nom', errors.titulaire?.nom)}
                  </div>
                </div>
                <div>
                  <label htmlFor={`${uid}-t-email`} className={labelClass}>Email *</label>
                  <input type="email" autoComplete="off" {...register('titulaire.email')} {...champ('t-email', errors.titulaire?.email)} className={inputClass} />
                  {erreur('t-email', errors.titulaire?.email)}
                </div>
                <div>
                  <label htmlFor={`${uid}-t-telephone`} className={labelClass}>Téléphone</label>
                  <input {...register('titulaire.telephone')} {...champ('t-telephone', errors.titulaire?.telephone)} placeholder="0612345678" className={inputClass} />
                  {erreur('t-telephone', errors.titulaire?.telephone)}
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
