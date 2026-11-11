// frontend/src/lib/constantes/affichage.test.ts
import { COURBES, dernieresValeurs, pointsCourbe, reperesCourbe, resumePrise } from './affichage';
import type { Prise } from './api';

function prise(champs: Partial<Prise>): Prise {
  return {
    id: 'k',
    patientId: 'p1',
    consultationId: null,
    datePrise: '2026-11-11T09:00:00.000Z',
    createdAt: '2026-11-11T09:00:00.000Z',
    priseParId: 'sec-1',
    prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
    consultation: null,
    imc: null,
    alertes: [],
    ...champs,
  };
}

const tension = COURBES.find((c) => c.cle === 'tension')!;

describe('dernieresValeurs', () => {
  it('prend la valeur la plus récente de chaque constante', () => {
    const prises = [
      prise({ id: 'recente', datePrise: '2026-11-11T09:00:00.000Z', poids: 73 }),
      prise({ id: 'ancienne', datePrise: '2026-10-01T09:00:00.000Z', poids: 70, tensionSystolique: 130, tensionDiastolique: 85 }),
    ];
    const res = dernieresValeurs(prises);
    expect(res.find((d) => d.cle === 'poids')?.valeur).toBe('73 kg');
    expect(res.find((d) => d.cle === 'tension')?.valeur).toBe('130/85 mmHg');
    expect(res.find((d) => d.cle === 'spo2')).toBeUndefined();
  });
  it('associe l alerte de la prise', () => {
    const alerte = { cle: 'temperature' as const, sens: 'elevee' as const, niveau: 'attention' as const, etat: 'élevée', texte: '' };
    const [d] = dernieresValeurs([prise({ temperature: 39.5, alertes: [alerte] })]);
    expect(d).toMatchObject({ valeur: '39,5 °C', alerte });
  });
});

describe('resumePrise', () => {
  it('liste les valeurs présentes', () => {
    expect(resumePrise(prise({ tensionSystolique: 120, tensionDiastolique: 80, poids: 72, imc: 24.9 }))).toBe(
      'Tension 120/80 mmHg · Poids 72 kg · IMC 24,9',
    );
  });
});

describe('courbes', () => {
  it('points du plus ancien au plus récent, seulement les prises utiles', () => {
    const points = pointsCourbe(
      [
        prise({ datePrise: '2026-11-11T09:00:00.000Z', tensionSystolique: 140, tensionDiastolique: 90 }),
        prise({ datePrise: '2026-11-10T09:00:00.000Z', poids: 70 }),
        prise({ datePrise: '2026-10-01T09:00:00.000Z', tensionSystolique: 120, tensionDiastolique: 80 }),
      ],
      tension,
    );
    expect(points.map((p) => p.tensionSystolique)).toEqual([120, 140]);
  });
  it('repères de seuils sans doublon', () => {
    expect(reperesCourbe(tension)).toEqual([90, 140, 60]);
  });
});
