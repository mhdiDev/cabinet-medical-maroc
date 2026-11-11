// frontend/src/components/constantes/ResumeConstantes.tsx
import { ageEnAnnees, calculerImc, evaluerConstantes, type ValeursConstantes } from '@/lib/constantes/seuils';
import { resumePrise } from '@/lib/constantes/affichage';
import type { Prise } from '@/lib/constantes/api';

/** Constantes rattachées à une consultation, avec leurs alertes */
export function ResumeConstantes({ constantes, dateNaissance }: { constantes: ValeursConstantes & Pick<Prise, 'datePrise'>; dateNaissance: string }) {
  const age = ageEnAnnees(dateNaissance, new Date(constantes.datePrise));
  const imc = calculerImc(constantes.poids, constantes.taille);
  const alertes = evaluerConstantes({ ...constantes, imc }, age);
  const prise = { ...constantes, imc, alertes } as unknown as Prise;
  return (
    <div className="px-6 py-4">
      <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Constantes</p>
      <p className="text-gray-800">{resumePrise(prise)}</p>
      {alertes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {alertes.map((a) => (
            <li
              key={a.cle}
              className={`rounded-full px-2 py-0.5 text-xs ${a.niveau === 'critique' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-800'}`}
            >
              {a.texte}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
