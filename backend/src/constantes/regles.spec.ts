// backend/src/constantes/regles.spec.ts
import { BadRequestException } from '@nestjs/common';
import { enrichirPrises, peutModifier, verifierDatePrise, verifierMesures } from './regles';

describe('verifierMesures', () => {
  it('refuse une prise sans aucune valeur', () => {
    expect(() => verifierMesures({})).toThrow(new BadRequestException('Aucune constante saisie'));
    expect(() => verifierMesures({ poids: null })).toThrow('Aucune constante saisie');
  });
  it('exige les deux valeurs de la tension', () => {
    expect(() => verifierMesures({ tensionSystolique: 120 })).toThrow(
      'Tension : saisir les deux valeurs',
    );
  });
  it('exige une tension haute supérieure à la basse', () => {
    expect(() => verifierMesures({ tensionSystolique: 80, tensionDiastolique: 120 })).toThrow(
      'Tension : la valeur haute doit dépasser la valeur basse',
    );
  });
  it('accepte une seule valeur', () => {
    expect(() => verifierMesures({ poids: 72 })).not.toThrow();
  });
});

describe('verifierDatePrise', () => {
  const maintenant = new Date('2026-11-11T10:00:00Z');
  it('accepte une date absente ou passée, et 5 minutes d avance', () => {
    expect(() => verifierDatePrise(undefined, maintenant)).not.toThrow();
    expect(() => verifierDatePrise('2026-11-10T10:00:00Z', maintenant)).not.toThrow();
    expect(() => verifierDatePrise('2026-11-11T10:04:00Z', maintenant)).not.toThrow();
  });
  it('refuse une date dans le futur ou avant 1900', () => {
    expect(() => verifierDatePrise('2026-11-11T11:00:00Z', maintenant)).toThrow('dans le futur');
    expect(() => verifierDatePrise('1899-12-31T00:00:00Z', maintenant)).toThrow(
      'Date de prise invalide',
    );
  });
});

describe('peutModifier', () => {
  const maintenant = new Date('2026-11-11T15:00:00Z');
  const prise = { priseParId: 'sec-1', createdAt: new Date('2026-11-11T09:00:00Z') };
  it('un médecin peut toujours', () => {
    expect(
      peutModifier(
        { ...prise, createdAt: new Date('2025-01-01') },
        { id: 'dr', role: 'MEDECIN' },
        maintenant,
      ),
    ).toBe(true);
  });
  it('l auteur le jour même peut', () => {
    expect(peutModifier(prise, { id: 'sec-1', role: 'SECRETAIRE' }, maintenant)).toBe(true);
  });
  it('l auteur le lendemain ne peut plus, une autre secrétaire non plus', () => {
    expect(
      peutModifier(prise, { id: 'sec-1', role: 'SECRETAIRE' }, new Date('2026-11-12T15:00:00Z')),
    ).toBe(false);
    expect(peutModifier(prise, { id: 'sec-2', role: 'SECRETAIRE' }, maintenant)).toBe(false);
  });
});

describe('enrichirPrises', () => {
  const adulte = new Date('1980-01-01');
  it('calcule l IMC avec la taille de la prise', () => {
    const [p] = enrichirPrises(
      [{ id: 'a', datePrise: new Date('2026-11-11'), poids: 72, taille: 170 }],
      adulte,
    );
    expect(p.imc).toBe(24.9);
    expect(p.alertes).toEqual([]);
  });
  it('reprend la dernière taille connue chez l adulte', () => {
    const prises = [
      { id: 'recente', datePrise: new Date('2026-11-11'), poids: 95 },
      { id: 'ancienne', datePrise: new Date('2026-01-01'), taille: 170 },
    ];
    const res = enrichirPrises(prises, adulte);
    expect(res.map((p) => p.id)).toEqual(['recente', 'ancienne']); // ordre d'origine conservé
    expect(res[0].imc).toBe(32.9);
    expect(res[0].alertes[0]).toMatchObject({ cle: 'imc', sens: 'elevee' });
  });
  it('ne reprend pas une ancienne taille chez l enfant', () => {
    const prises = [
      { id: 'recente', datePrise: new Date('2026-11-11'), poids: 20 },
      { id: 'ancienne', datePrise: new Date('2026-01-01'), taille: 110 },
    ];
    expect(enrichirPrises(prises, new Date('2020-01-01'))[0].imc).toBeNull();
  });
  it('évalue les alertes à l âge du jour de la prise', () => {
    const [p] = enrichirPrises(
      [
        {
          id: 'a',
          datePrise: new Date('2026-11-11'),
          tensionSystolique: 150,
          tensionDiastolique: 95,
        },
      ],
      new Date('2010-01-01'),
    );
    expect(p.alertes).toEqual([]); // 16 ans : pas de seuil de tension
  });
});
