// backend/src/constantes/seuils.spec.ts
import { ageEnAnnees, calculerImc, evaluerConstantes } from './seuils';

describe('calculerImc', () => {
  it('poids / taille² arrondi au dixième', () => {
    expect(calculerImc(72, 170)).toBe(24.9);
  });
  it('null sans poids ou sans taille', () => {
    expect(calculerImc(72, null)).toBeNull();
    expect(calculerImc(undefined, 170)).toBeNull();
  });
});

describe('ageEnAnnees', () => {
  it('compte les années révolues', () => {
    expect(ageEnAnnees(new Date('2008-11-12'), new Date('2026-11-11'))).toBe(17);
    expect(ageEnAnnees(new Date('2008-11-11'), new Date('2026-11-11'))).toBe(18);
  });
});

describe('evaluerConstantes (adulte)', () => {
  const adulte = 40;

  it('aucune alerte pour des valeurs normales', () => {
    expect(
      evaluerConstantes(
        {
          tensionSystolique: 120,
          tensionDiastolique: 80,
          pouls: 72,
          spo2: 98,
          temperature: 37,
          glycemie: 1,
          imc: 24,
        },
        adulte,
      ),
    ).toEqual([]);
  });

  it('tension élevée dès 140/90, critique dès 180/110', () => {
    expect(evaluerConstantes({ tensionSystolique: 140, tensionDiastolique: 80 }, adulte)).toEqual([
      {
        cle: 'tension',
        sens: 'elevee',
        niveau: 'attention',
        etat: 'élevée',
        texte: 'tension 140/80 mmHg élevée',
      },
    ]);
    expect(
      evaluerConstantes({ tensionSystolique: 130, tensionDiastolique: 110 }, adulte)[0].niveau,
    ).toBe('critique');
  });

  it('tension basse sous 90/60', () => {
    expect(
      evaluerConstantes({ tensionSystolique: 85, tensionDiastolique: 55 }, adulte)[0],
    ).toMatchObject({
      sens: 'basse',
      etat: 'basse',
    });
  });

  it('tension incomplète : pas évaluée', () => {
    expect(evaluerConstantes({ tensionSystolique: 200 }, adulte)).toEqual([]);
  });

  it('accorde le masculin (pouls, IMC)', () => {
    expect(evaluerConstantes({ pouls: 100 }, adulte)[0].texte).toBe('pouls 100 bpm élevé');
    expect(evaluerConstantes({ imc: 17.2 }, adulte)[0].texte).toBe('IMC 17,2 bas');
  });

  it('température : virgule française, seuils 38 et 40', () => {
    expect(evaluerConstantes({ temperature: 39.5 }, adulte)[0]).toMatchObject({
      niveau: 'attention',
      texte: 'température 39,5 °C élevée',
    });
    expect(evaluerConstantes({ temperature: 40 }, adulte)[0].niveau).toBe('critique');
    expect(evaluerConstantes({ temperature: 35.2 }, adulte)[0]).toMatchObject({
      sens: 'basse',
      niveau: 'attention',
    });
  });

  it('SpO2 basse sous 95, critique sous 90', () => {
    expect(evaluerConstantes({ spo2: 94 }, adulte)[0].niveau).toBe('attention');
    expect(evaluerConstantes({ spo2: 89 }, adulte)[0].niveau).toBe('critique');
  });

  it('glycémie : < 0,7 basse, ≥ 1,26 élevée, ≥ 3 critique', () => {
    expect(evaluerConstantes({ glycemie: 0.65 }, adulte)[0].sens).toBe('basse');
    expect(evaluerConstantes({ glycemie: 1.26 }, adulte)[0].sens).toBe('elevee');
    expect(evaluerConstantes({ glycemie: 3.1 }, adulte)[0].niveau).toBe('critique');
  });
});

describe('evaluerConstantes (enfant)', () => {
  it('ignore tension, pouls et IMC avant 18 ans', () => {
    expect(
      evaluerConstantes({ tensionSystolique: 150, tensionDiastolique: 95, pouls: 130, imc: 14 }, 8),
    ).toEqual([]);
  });
  it('garde température, SpO2 et glycémie', () => {
    const cles = evaluerConstantes({ temperature: 39, spo2: 92, glycemie: 0.5 }, 8).map(
      (a) => a.cle,
    );
    expect(cles).toEqual(['spo2', 'temperature', 'glycemie']);
  });
});
