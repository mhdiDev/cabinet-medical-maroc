'use client';
import { useId } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import type { Cabinet } from './types';
import { useModale } from './useModale';

export function StatutCabinetModal({ cabinet, onClose }: { cabinet: Cabinet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const suspendre = cabinet.actif;

  const mutation = useMutation({
    mutationFn: () => apiClient.patch(`/plateforme/cabinets/${cabinet.id}/statut`, { actif: !suspendre }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cabinets'] });
      toast.success(suspendre ? 'Cabinet suspendu' : 'Cabinet réactivé');
      onClose();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors du changement'),
  });

  const titreId = `${useId()}-titre`;
  const modaleRef = useModale(onClose, mutation.isPending);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={modaleRef} role="dialog" aria-modal="true" aria-labelledby={titreId} className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 id={titreId} className="font-bold text-lg mb-3">{suspendre ? 'Suspendre le cabinet' : 'Réactiver le cabinet'}</h2>
        <p className="text-sm text-gray-600">
          {suspendre
            ? `Suspendre ${cabinet.nom} ? Ses utilisateurs seront déconnectés et ne pourront plus se connecter. Les données sont conservées.`
            : `Réactiver ${cabinet.nom} ? Ses utilisateurs pourront de nouveau se connecter.`}
        </p>
        <div className="flex justify-end gap-3 pt-5">
          <button type="button" onClick={onClose} disabled={mutation.isPending} className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50">
            Annuler
          </button>
          <button
            type="button"
            data-autofocus
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className={`px-6 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${suspendre ? 'bg-red-600' : 'bg-blue-600'}`}
          >
            {mutation.isPending ? '...' : suspendre ? 'Suspendre' : 'Réactiver'}
          </button>
        </div>
      </div>
    </div>
  );
}
