import { lieuEtDate } from './lieu-et-date';

describe('lieuEtDate', () => {
  it('écrit la ville du cabinet et la date en français', () => {
    expect(lieuEtDate('Rabat', new Date('2026-11-07T10:00:00Z'))).toBe('Rabat, le 07/11/2026');
  });

  it('garde les accents de la ville', () => {
    expect(lieuEtDate('Fès', new Date('2026-01-02T10:00:00Z'))).toBe('Fès, le 02/01/2026');
  });
});
