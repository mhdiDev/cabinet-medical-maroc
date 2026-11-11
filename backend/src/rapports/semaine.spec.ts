import { aujourdhui, bornesSemaine, compterParJour, jourLocal } from './semaine';

// Fuseau fixe UTC+1 (« Etc/GMT-1 ») : les tests ne dépendent pas de la version des données de fuseaux
const F = 'Etc/GMT-1';

describe('jourLocal', () => {
  it('passe au lendemain à minuit heure locale, pas à minuit UTC', () => {
    expect(jourLocal(new Date('2026-11-11T22:59:00Z'), F)).toBe('2026-11-11');
    expect(jourLocal(new Date('2026-11-11T23:30:00Z'), F)).toBe('2026-11-12');
  });
});

describe('aujourdhui', () => {
  it('renvoie la journée locale en instants UTC', () => {
    const { debut, fin } = aujourdhui(new Date('2026-11-11T12:00:00Z'), F);
    expect(debut.toISOString()).toBe('2026-11-10T23:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-11-11T23:00:00.000Z');
  });
});

describe('bornesSemaine', () => {
  it('va du lundi au lundi suivant (heure locale)', () => {
    // Mercredi 11 novembre 2026
    const s = bornesSemaine(new Date('2026-11-11T14:30:00Z'), F);
    expect(s.lundi).toBe('2026-11-09');
    expect(s.debut.toISOString()).toBe('2026-11-08T23:00:00.000Z');
    expect(s.fin.toISOString()).toBe('2026-11-15T23:00:00.000Z');
  });

  it('un dimanche appartient à la semaine commencée le lundi précédent', () => {
    expect(bornesSemaine(new Date('2026-11-15T10:00:00Z'), F).lundi).toBe('2026-11-09');
  });

  it('dimanche 23h30 UTC est déjà lundi en heure locale', () => {
    expect(bornesSemaine(new Date('2026-11-15T23:30:00Z'), F).lundi).toBe('2026-11-16');
  });
});

describe('compterParJour', () => {
  it('range les RDV du lundi (0) au dimanche (6), heure locale', () => {
    const dates = [
      new Date('2026-11-09T08:00:00Z'), // lundi
      new Date('2026-11-11T09:00:00Z'), // mercredi
      new Date('2026-11-11T15:00:00Z'), // mercredi
      new Date('2026-11-14T23:30:00Z'), // samedi 23h30 UTC = dimanche 00h30 en heure locale
    ];
    expect(compterParJour(dates, F)).toEqual([1, 0, 2, 0, 0, 0, 1]);
  });
});
