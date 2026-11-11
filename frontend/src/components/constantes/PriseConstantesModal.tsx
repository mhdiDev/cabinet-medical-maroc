// frontend/src/components/constantes/PriseConstantesModal.tsx
'use client';
import { useId, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useModale } from '@/components/commun/useModale';
import { cleConstantes, derniereTaille, type Prise, useConstantes } from '@/lib/constantes/api';
import {
  erreursSaisie,
  SAISIE_VIDE,
  saisieVide,
  versSaisie,
  versValeurs,
  versValeursCompletes,
  type ErreursSaisie,
  type SaisieConstantes,
} from '@/lib/constantes/saisie';
import { FormulaireConstantes } from './FormulaireConstantes';

interface Props {
  patient: { id: string; dateNaissance: string };
  /** Prise à modifier ; absente : nouvelle prise */
  prise?: Prise;
  onClose: () => void;
}

export function PriseConstantesModal({ patient, prise, onClose }: Props) {
  const queryClient = useQueryClient();
  const { data: prises } = useConstantes(patient.id);
  const [saisie, setSaisie] = useState<SaisieConstantes>(prise ? versSaisie(prise) : SAISIE_VIDE);
  const [erreurs, setErreurs] = useState<ErreursSaisie>({});

  const mutation = useMutation({
    mutationFn: () =>
      prise
        ? apiClient.patch(`/constantes/${prise.id}`, versValeursCompletes(saisie))
        : apiClient.post('/constantes', { patientId: patient.id, ...versValeurs(saisie) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cleConstantes(patient.id) });
      toast.success(prise ? 'Constantes modifiées' : 'Constantes enregistrées');
      onClose();
    },
    onError: (err: any) => {
      const message = err.response?.data?.message;
      toast.error(Array.isArray(message) ? message.join(', ') : message || "Erreur lors de l'enregistrement");
    },
  });

  const enregistrer = (e: React.FormEvent) => {
    e.preventDefault();
    const trouvees = erreursSaisie(saisie);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length) return;
    if (saisieVide(saisie)) {
      toast.error('Saisissez au moins une constante');
      return;
    }
    mutation.mutate();
  };

  const titreId = `${useId()}-titre`;
  const modaleRef = useModale(onClose, mutation.isPending);
  const autres = prises?.filter((p) => p.id !== prise?.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modaleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titreId}
        className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <h2 id={titreId} className="font-bold text-lg mb-4">
          {prise ? 'Modifier les constantes' : 'Prendre les constantes'}
        </h2>
        <form onSubmit={enregistrer} noValidate>
          <FormulaireConstantes
            saisie={saisie}
            onChange={setSaisie}
            erreurs={erreurs}
            dateNaissance={patient.dateNaissance}
            tailleConnue={derniereTaille(autres)}
            desactive={mutation.isPending}
            autoFocus
          />
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="min-h-[44px] px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? '...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
