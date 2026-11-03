import { genererMotDePasse } from './generer-mot-de-passe';

describe('genererMotDePasse', () => {
  const tirages = Array.from({ length: 200 }, () => genererMotDePasse());

  it('génère 12 caractères', () => {
    tirages.forEach((m) => expect(m).toHaveLength(12));
  });

  it('contient au moins une majuscule, une minuscule et un chiffre', () => {
    tirages.forEach((m) => {
      expect(m).toMatch(/[A-Z]/);
      expect(m).toMatch(/[a-z]/);
      expect(m).toMatch(/\d/);
    });
  });

  it('n\'utilise aucun caractère ambigu (0, O, 1, l, I)', () => {
    tirages.forEach((m) => expect(m).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/));
  });

  it('produit des mots de passe différents', () => {
    expect(new Set(tirages).size).toBe(tirages.length);
  });
});
