'use client';
import { useId } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useModale } from '@/components/commun/useModale';
import type { Utilisateur } from './types';

export function StatutUserModal({ utilisateur, onClose }: { utilisateur: Utilisateur; onClose: () => void }) {
  const queryClient = useQueryClient();
  const desactiver = utilisateur.actif;
  const nom = `${utilisateur.prenom} ${utilisateur.nom}`;

  const mutation = useMutation({
    mutationFn: () => apiClient.patch(`/auth/users/${utilisateur.id}/statut`, { actif: !desactiver }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(desactiver ? 'Compte désactivé' : 'Compte réactivé');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors du changement'),
  });

  const titreId = `${useId()}-titre`;
  const modaleRef = useModale(onClose, mutation.isPending);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modaleRef} role="dialog" aria-modal="true" aria-labelledby={titreId} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 id={titreId} className="font-bold text-lg mb-3">{desactiver ? 'Désactiver le compte' : 'Réactiver le compte'}</h2>
        <p className="text-sm text-gray-600">
          {desactiver
            ? `Désactiver le compte de ${nom} ? La personne sera déconnectée et ne pourra plus se connecter. Ses données sont conservées.`
            : `Réactiver le compte de ${nom} ? La personne pourra de nouveau se connecter avec son mot de passe actuel.`}
        </p>
        {desactiver && utilisateur.rdvAVenir > 0 && (
          <p className="text-sm text-orange-700 bg-orange-50 rounded-lg p-3 mt-3">
            {utilisateur.rdvAVenir} rendez-vous à venir restent dans l&apos;agenda.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-5">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
            Annuler
          </button>
          <button
            type="button"
            data-autofocus
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`px-6 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${desactiver ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {mutation.isPending ? '...' : desactiver ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>
      </div>
    </div>
  );
}
