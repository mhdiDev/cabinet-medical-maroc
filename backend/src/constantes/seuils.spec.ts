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

describe('calculerImc (valeurs nulles)', () => {
  it('null si le poids ou la taille vaut 0', () => {
    expect(calculerImc(0, 170)).toBeNull();
    expect(calculerImc(72, 0)).toBeNull();
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

describe('evaluerConstantes (bornes adultes)', () => {
  type V = Parameters<typeof evaluerConstantes>[0];
  const cas: [string, V, string[]][] = [
    ['tension 139/89', { tensionSystolique: 139, tensionDiastolique: 89 }, []],
    ['tension 140/80', { tensionSystolique: 140, tensionDiastolique: 80 }, ['elevee', 'attention']],
    ['tension 120/90', { tensionSystolique: 120, tensionDiastolique: 90 }, ['elevee', 'attention']],
    ['tension 180/80', { tensionSystolique: 180, tensionDiastolique: 80 }, ['elevee', 'critique']],
    ['tension 120/95', { tensionSystolique: 120, tensionDiastolique: 95 }, ['elevee', 'attention']],
    ['tension 89/60', { tensionSystolique: 89, tensionDiastolique: 60 }, ['basse', 'attention']],
    ['pouls 50', { pouls: 50 }, []],
    ['pouls 49', { pouls: 49 }, ['basse', 'attention']],
    ['pouls 40', { pouls: 40 }, ['basse', 'attention']],
    ['pouls 39', { pouls: 39 }, ['basse', 'critique']],
    ['pouls 99', { pouls: 99 }, []],
    ['pouls 100', { pouls: 100 }, ['elevee', 'attention']],
    ['pouls 130', { pouls: 130 }, ['elevee', 'critique']],
    ['spo2 95', { spo2: 95 }, []],
    ['spo2 94', { spo2: 94 }, ['basse', 'attention']],
    ['spo2 90', { spo2: 90 }, ['basse', 'attention']],
    ['spo2 89', { spo2: 89 }, ['basse', 'critique']],
    ['température 37,9', { temperature: 37.9 }, []],
    ['température 38', { temperature: 38 }, ['elevee', 'attention']],
    ['température 40', { temperature: 40 }, ['elevee', 'critique']],
    ['température 35,5', { temperature: 35.5 }, []],
    ['température 35,4', { temperature: 35.4 }, ['basse', 'attention']],
    ['température 35', { temperature: 35 }, ['basse', 'attention']],
    ['température 34,9', { temperature: 34.9 }, ['basse', 'critique']],
    ['glycémie 0,7', { glycemie: 0.7 }, []],
    ['glycémie 0,69', { glycemie: 0.69 }, ['basse', 'attention']],
    ['glycémie 1,25', { glycemie: 1.25 }, []],
    ['glycémie 3', { glycemie: 3 }, ['elevee', 'critique']],
    ['IMC 18,5', { imc: 18.5 }, []],
    ['IMC 18,4', { imc: 18.4 }, ['basse', 'attention']],
    ['IMC 29,9', { imc: 29.9 }, []],
    ['IMC 30', { imc: 30 }, ['elevee', 'attention']],
  ];

  it.each(cas)('%s', (_nom, valeurs, attendu) => {
    const alertes = evaluerConstantes(valeurs, 40);
    expect(alertes.flatMap((a) => [a.sens, a.niveau])).toEqual(attendu);
  });

  it('une valeur non finie ne produit aucune alerte', () => {
    expect(evaluerConstantes({ temperature: NaN }, 40)).toEqual([]);
    expect(evaluerConstantes({ pouls: Infinity }, 40)).toEqual([]);
  });
});
