// frontend/src/components/constantes/CourbeConstantes.tsx
'use client';
import { useId, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COURBES, fr, libelleDate, libelleDateHeure, pointsCourbe, reperesCourbe } from '@/lib/constantes/affichage';
import type { Prise } from '@/lib/constantes/api';

const COULEURS = ['#2563eb', '#7c3aed'];

export function CourbeConstantes({ prises }: { prises: Prise[] }) {
  const id = useId();
  const [cle, setCle] = useState(COURBES[0].cle);
  const courbe = COURBES.find((c) => c.cle === cle) ?? COURBES[0];
  const points = pointsCourbe(prises, courbe);

  return (
    <div>
      <label htmlFor={`${id}-choix`} className="text-sm font-medium text-gray-700">
        Constante affichée
      </label>
      <select
        id={`${id}-choix`}
        value={cle}
        onChange={(e) => setCle(e.target.value)}
        className="mt-1 block w-full sm:w-64 min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
      >
        {COURBES.map((c) => (
          <option key={c.cle} value={c.cle}>
            {c.libelle}
          </option>
        ))}
      </select>

      {points.length < 2 ? (
        <p className="mt-4 text-sm text-gray-500">Pas encore assez de mesures pour une courbe</p>
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="instant" tickFormatter={libelleDate} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} width={44} domain={['auto', 'auto']} />
              <Tooltip labelFormatter={(l: string) => libelleDateHeure(l)} formatter={(v: number) => `${fr(v)} ${courbe.unite}`} />
              {courbe.series.length > 1 && <Legend />}
              {reperesCourbe(courbe).map((y) => (
                <ReferenceLine key={y} y={y} stroke="#f59e0b" strokeDasharray="4 4" />
              ))}
              {courbe.series.map((s, i) => (
                <Line
                  key={s.cle}
                  type="monotone"
                  dataKey={s.cle}
                  name={s.libelle}
                  stroke={COULEURS[i]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
