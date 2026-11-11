// frontend/src/components/constantes/FormulaireConstantes.tsx
'use client';
import { useId } from 'react';
import {
  ageEnAnnees,
  calculerImc,
  CHAMPS,
  evaluerConstantes,
  type AlerteConstante,
  type ChampMesure,
} from '@/lib/constantes/seuils';
import { lireNombre, versValeurs, type ErreursSaisie, type SaisieConstantes } from '@/lib/constantes/saisie';
import { PastilleAlerte } from './PastilleAlerte';

// Champ du formulaire → alerte affichée sous ce champ
const ALERTE_DU_CHAMP: Partial<Record<ChampMesure, AlerteConstante['cle']>> = {
  tensionSystolique: 'tension',
  pouls: 'pouls',
  spo2: 'spo2',
  temperature: 'temperature',
  glycemie: 'glycemie',
};

const ORDRE: ChampMesure[] = ['tensionSystolique', 'tensionDiastolique', 'pouls', 'spo2', 'temperature', 'poids', 'taille'];
const APRES_IMC: ChampMesure[] = ['glycemie', 'perimetreCranien', 'tourDeTaille'];

/** IMC de la saisie ; sans taille saisie, celle déjà connue (adulte seulement) */
export function imcDeSaisie(saisie: SaisieConstantes, age: number, tailleConnue?: number | null): number | null {
  const poids = lireNombre(saisie.poids);
  const taille = lireNombre(saisie.taille);
  const t = taille !== undefined && !Number.isNaN(taille) ? taille : age >= 18 ? tailleConnue ?? null : null;
  return poids !== undefined && !Number.isNaN(poids) ? calculerImc(poids, t) : null;
}

interface Props {
  saisie: SaisieConstantes;
  onChange: (saisie: SaisieConstantes) => void;
  erreurs: ErreursSaisie;
  dateNaissance: string;
  tailleConnue?: number | null;
  desactive?: boolean;
  /** Focus initial (modale) sur le premier champ */
  autoFocus?: boolean;
}

export function FormulaireConstantes({ saisie, onChange, erreurs, dateNaissance, tailleConnue, desactive, autoFocus }: Props) {
  const id = useId();
  const age = ageEnAnnees(dateNaissance);
  const imc = imcDeSaisie(saisie, age, tailleConnue);
  const alertes = evaluerConstantes({ ...versValeurs(saisie), imc }, age);
  const alerte = (cle?: AlerteConstante['cle']) => (cle ? alertes.find((a) => a.cle === cle) : undefined);

  const champ = (c: ChampMesure) => {
    const a = alerte(ALERTE_DU_CHAMP[c]);
    const idChamp = `${id}-${c}`;
    return (
      <div key={c}>
        <label htmlFor={idChamp} className="text-sm font-medium text-gray-700">
          {CHAMPS[c].libelle}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={idChamp}
            name={c}
            inputMode={CHAMPS[c].entier ? 'numeric' : 'decimal'}
            autoComplete="off"
            value={saisie[c]}
            onChange={(e) => onChange({ ...saisie, [c]: e.target.value })}
            disabled={desactive}
            data-autofocus={autoFocus && c === 'tensionSystolique' ? true : undefined}
            aria-invalid={erreurs[c] ? true : undefined}
            aria-describedby={[a && `${idChamp}-alerte`, erreurs[c] && `${idChamp}-erreur`].filter(Boolean).join(' ') || undefined}
            className={`w-full min-h-[44px] px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 ${
              erreurs[c] ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          <span className="w-12 shrink-0 text-sm text-gray-500">{CHAMPS[c].unite}</span>
        </div>
        {a && <PastilleAlerte id={`${idChamp}-alerte`} alerte={a} className="mt-1" />}
        {erreurs[c] && (
          <p id={`${idChamp}-erreur`} className="mt-1 text-xs text-red-600">
            {erreurs[c]}
          </p>
        )}
      </div>
    );
  };

  const alerteImc = alerte('imc');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ORDRE.map(champ)}
      <div>
        <p id={`${id}-imc`} className="text-sm font-medium text-gray-700">
          IMC <span className="font-normal text-gray-400">(calculé)</span>
        </p>
        <output
          aria-labelledby={`${id}-imc`}
          data-testid="imc"
          className="mt-1 min-h-[44px] flex items-center px-3 rounded-lg bg-gray-50 text-sm text-gray-900"
        >
          {imc === null ? '—' : String(imc).replace('.', ',')}
        </output>
        {alerteImc && <PastilleAlerte alerte={alerteImc} className="mt-1" />}
      </div>
      {APRES_IMC.map(champ)}
    </div>
  );
}
