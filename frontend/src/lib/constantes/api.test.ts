import { derniereTaille, peutModifier, type Prise } from './api';

const maintenant = new Date('2026-11-12T10:00:00Z');
const prise = { priseParId: 'u1', createdAt: '2026-11-12T08:00:00Z' };

describe('peutModifier', () => {
  it('un médecin : toujours', () => {
    expect(peutModifier({ priseParId: 'x', createdAt: '2026-01-01T08:00:00Z' }, { id: 'm', role: 'MEDECIN' }, maintenant)).toBe(true);
  });
  it('l auteur le même jour', () => {
    expect(peutModifier(prise, { id: 'u1', role: 'SECRETAIRE' }, maintenant)).toBe(true);
  });
  it('l auteur un autre jour', () => {
    expect(peutModifier({ ...prise, createdAt: '2026-11-11T08:00:00Z' }, { id: 'u1', role: 'SECRETAIRE' }, maintenant)).toBe(false);
  });
  it('un autre utilisateur', () => {
    expect(peutModifier(prise, { id: 'u2', role: 'SECRETAIRE' }, maintenant)).toBe(false);
  });
  it('sans utilisateur', () => {
    expect(peutModifier(prise, null, maintenant)).toBe(false);
  });
});

describe('derniereTaille', () => {
  const p = (taille: number | null | undefined) => ({ taille }) as Prise;
  it('première taille renseignée (liste récente → ancienne)', () => {
    expect(derniereTaille([p(null), p(172), p(170)])).toBe(172);
  });
  it('null sans taille ou sans liste', () => {
    expect(derniereTaille([p(null), p(undefined)])).toBeNull();
    expect(derniereTaille()).toBeNull();
  });
});
