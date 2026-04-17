'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

const schema = z.object({
  nom: z.string().min(1, 'Requis'),
  prenom: z.string().min(1, 'Requis'),
  dateNaissance: z.string().min(1, 'Requis'),
  sexe: z.enum(['MASCULIN', 'FEMININ']),
  cin: z.string().optional(),
  telephone: z.string().regex(/^0[5-7][0-9]{8}$/, 'Téléphone marocain invalide'),
  email: z.string().email().optional().or(z.literal('')),
  adresse: z.string().optional(),
  ville: z.string().optional(),
  groupeSanguin: z.string().optional(),
  allergies: z.string().optional(),
  antecedents: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NouveauPatientPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/patients', data),
    onSuccess: (res) => {
      toast.success('Patient créé avec succès');
      router.push(`/patients/${res.data.id}`);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de la création'),
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate({
      ...data,
      allergies: data.allergies ? data.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
      email: data.email || undefined,
    });
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm';
  const errClass = 'text-red-500 text-xs mt-1';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/patients" className="text-gray-400 hover:text-gray-600">← Retour</Link>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau patient</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Identité</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Nom *</label>
              <input {...register('nom')} className={inputClass} />
              {errors.nom && <p className={errClass}>{errors.nom.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Prénom *</label>
              <input {...register('prenom')} className={inputClass} />
              {errors.prenom && <p className={errClass}>{errors.prenom.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Date de naissance *</label>
              <input {...register('dateNaissance')} type="date" className={inputClass} />
              {errors.dateNaissance && <p className={errClass}>{errors.dateNaissance.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Sexe *</label>
              <select {...register('sexe')} className={inputClass}>
                <option value="MASCULIN">Masculin</option>
                <option value="FEMININ">Féminin</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">CIN</label>
              <input {...register('cin')} placeholder="AB123456" className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Téléphone *</label>
              <input {...register('telephone')} placeholder="0612345678" className={inputClass} />
              {errors.telephone && <p className={errClass}>{errors.telephone.message}</p>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Coordonnées</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input {...register('email')} type="email" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">Adresse</label>
              <input {...register('adresse')} className={inputClass} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Ville</label>
              <input {...register('ville')} className={inputClass} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b">Informations médicales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Groupe sanguin</label>
              <select {...register('groupeSanguin')} className={inputClass}>
                <option value="">Inconnu</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Allergies (séparées par virgule)</label>
              <input {...register('allergies')} placeholder="Pénicilline, Aspirine..." className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-gray-700">Antécédents médicaux</label>
              <textarea {...register('antecedents')} rows={3} className={inputClass} />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Link href="/patients" className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            Annuler
          </Link>
          <button type="submit" disabled={mutation.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
