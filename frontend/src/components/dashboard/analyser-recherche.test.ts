// frontend/src/components/dashboard/analyser-recherche.test.ts
import { analyserRecherche } from './analyser-recherche';

describe('analyserRecherche', () => {
  it.each([
    ['tazi', { type: 'requete', q: 'tazi' }],
    ['  Ahmed  Tazi ', { type: 'requete', q: 'Ahmed Tazi' }],
    ['10/11/2026', { type: 'requete', date: '2026-11-10' }],
    ['10-11-2026', { type: 'requete', date: '2026-11-10' }],
    ['10.11.2026', { type: 'requete', date: '2026-11-10' }],
    ['1/3/2026', { type: 'requete', date: '2026-03-01' }],
    ['tazi 10/11/2026', { type: 'requete', q: 'tazi', date: '2026-11-10' }],
    ['10/11/2026 tazi', { type: 'requete', q: 'tazi', date: '2026-11-10' }],
    ['06-12-34', { type: 'requete', q: '06-12-34' }],
    ['06 12 34', { type: 'requete', q: '06 12 34' }],
    ['29/02/2028', { type: 'requete', date: '2028-02-29' }],
  ])('« %s » → requête', (texte, attendu) => {
    expect(analyserRecherche(texte)).toEqual(attendu);
  });

  it.each(['10/11', '10/11/20', '10/', 'tazi 10/11'])('« %s » → aide au format', (texte) => {
    expect(analyserRecherche(texte)).toEqual({ type: 'aide', message: 'Date au format JJ/MM/AAAA' });
  });

  it.each(['31/02/2026', '32/01/2026', '10/13/2026', '29/02/2027', '01/01/0999'])('« %s » → date invalide', (texte) => {
    expect(analyserRecherche(texte)).toEqual({ type: 'erreur', message: 'Date invalide' });
  });

  it.each(['', ' ', 'a', '  b  '])('« %s » → rien à chercher', (texte) => {
    expect(analyserRecherche(texte)).toEqual({ type: 'vide' });
  });
});
