'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { MotDePasseGenere } from '@/components/utilisateurs/MotDePasseGenere';
import type { Cabinet } from './types';

type Titulaire = NonNullable<Cabinet['titulaire']>;

export function ResetTitulaireModal({
  cabinet,
  titulaire,
  onClose,
}: {
  cabinet: Cabinet;
  titulaire: Titulaire;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [motDePasse, setMotDePasse] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient
        .post<{ motDePasseTemporaire: string }>(`/plateforme/cabinets/${cabinet.id}/titulaire/reset-password`)
        .then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      setMotDePasse(data.motDePasseTemporaire);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de la réinitialisation'),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        {motDePasse ? (
          <MotDePasseGenere
            titre="Mot de passe réinitialisé"
            utilisateur={titulaire}
            motDePasse={motDePasse}
            onClose={onClose}
          />
        ) : (
          <>
            <h2 className="font-bold text-lg mb-3">Réinitialiser le mot de passe</h2>
            <p className="text-sm text-gray-600">
              Réinitialiser le mot de passe de {titulaire.prenom} {titulaire.nom}, titulaire de {cabinet.nom} ?
              Un nouveau mot de passe temporaire sera généré et ses sessions seront fermées.
            </p>
            <div className="flex justify-end gap-3 pt-5">
              <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
                Annuler
              </button>
              <button type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                {mutation.isPending ? '...' : 'Réinitialiser'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
