// frontend/src/components/constantes/OngletConstantes.tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { FUSEAU_CABINET } from '@/lib/fuseau';
import { cleConstantes, LIBELLE_ROLE, peutModifier, type Prise, useConstantes } from '@/lib/constantes/api';
import { dernieresValeurs, resumePrise } from '@/lib/constantes/affichage';
import { CourbeConstantes } from './CourbeConstantes';
import { PastilleAlerte } from './PastilleAlerte';
import { PriseConstantesModal } from './PriseConstantesModal';

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSEAU_CABINET });
const dateHeure = (iso: string) =>
  new Date(iso).toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSEAU_CABINET,
  });

export function OngletConstantes({ patient }: { patient: { id: string; dateNaissance: string } }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: prises = [], isLoading } = useConstantes(patient.id);
  const [enEdition, setEnEdition] = useState<Prise | null>(null);

  const suppression = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/constantes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cleConstantes(patient.id) });
      toast.success('Prise supprimée');
    },
    onError: () => toast.error('Suppression impossible'),
  });

  if (isLoading) return <p className="text-sm text-gray-500">Chargement…</p>;
  if (!prises.length) {
    return (
      <p className="text-sm text-gray-500">
        Aucune constante enregistrée. Utilisez « Prendre les constantes » en haut de la fiche.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Dernières valeurs</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {dernieresValeurs(prises).map((d) => (
            <div
              key={d.cle}
              className={`rounded-lg border p-3 ${
                d.alerte?.niveau === 'critique'
                  ? 'border-red-200 bg-red-50'
                  : d.alerte
                    ? 'border-orange-200 bg-orange-50'
                    : 'border-gray-100'
              }`}
            >
              <p className="text-xs text-gray-500">{d.libelle}</p>
              <p className="font-semibold text-gray-900">{d.valeur}</p>
              {d.alerte && <PastilleAlerte alerte={d.alerte} className="mt-1" />}
              <p className="text-xs text-gray-400 mt-1">{dateCourte(d.date)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Évolution</h3>
        <CourbeConstantes prises={prises} />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 mb-3">Historique</h3>
        <ul className="divide-y divide-gray-100">
          {prises.map((p) => (
            <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {dateHeure(p.datePrise)} · prise par {p.prisePar.prenom} {p.prisePar.nom} (
                  {LIBELLE_ROLE[p.prisePar.role] ?? p.prisePar.role})
                  {p.consultation && (
                    <>
                      {' · '}
                      <Link href={`/consultations/${p.consultation.id}`} className="text-blue-600 hover:underline">
                        consultation
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-sm text-gray-600 mt-1 break-words">{resumePrise(p)}</p>
                {p.alertes.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {p.alertes.map((a) => (
                      <li
                        key={a.cle}
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          a.niveau === 'critique' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {a.texte}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {peutModifier(p, user) && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEnEdition(p)}
                    className="min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    disabled={suppression.isPending}
                    onClick={() => {
                      if (window.confirm('Supprimer cette prise de constantes ?')) suppression.mutate(p.id);
                    }}
                    className="min-h-[44px] px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {enEdition && <PriseConstantesModal patient={patient} prise={enEdition} onClose={() => setEnEdition(null)} />}
    </div>
  );
}
