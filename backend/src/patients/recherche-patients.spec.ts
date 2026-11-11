// backend/src/patients/recherche-patients.spec.ts
import { conditionsRecherche } from './recherche-patients';

const mot = (m: string) => ({
  OR: [
    { nom: { contains: m, mode: 'insensitive' } },
    { prenom: { contains: m, mode: 'insensitive' } },
    { telephone: { contains: m } },
  ],
});

describe('conditionsRecherche', () => {
  it('un mot : nom, prénom ou téléphone', () => {
    expect(conditionsRecherche('tazi')).toEqual([mot('tazi')]);
  });

  it('plusieurs mots : chacun doit correspondre (ET), dans n importe quel ordre', () => {
    expect(conditionsRecherche('  Ahmed   Tazi ')).toEqual([mot('Ahmed'), mot('Tazi')]);
  });

  it('téléphone avec espaces, points ou tirets : un seul fragment sans séparateurs', () => {
    expect(conditionsRecherche('06 12 34')).toEqual([{ telephone: { contains: '061234' } }]);
    expect(conditionsRecherche('06.12-34')).toEqual([{ telephone: { contains: '061234' } }]);
  });

  it('téléphone sans séparateur : règle par mot (nom, prénom ou téléphone)', () => {
    expect(conditionsRecherche('0612')).toEqual([mot('0612')]);
  });

  it('texte vide : aucune condition', () => {
    expect(conditionsRecherche('   ')).toEqual([]);
  });
});
