import {
  erreursSaisie,
  lireNombre,
  memeSaisie,
  SAISIE_VIDE,
  saisieVide,
  versSaisie,
  versValeurs,
  versValeursCompletes,
} from './saisie';

const avec = (champs: Partial<typeof SAISIE_VIDE>) => ({ ...SAISIE_VIDE, ...champs });

describe('lireNombre', () => {
  it('accepte la virgule et le point', () => {
    expect(lireNombre('37,5')).toBe(37.5);
    expect(lireNombre(' 72.4 ')).toBe(72.4);
  });
  it('vide : undefined ; illisible : NaN', () => {
    expect(lireNombre('  ')).toBeUndefined();
    expect(lireNombre('12a')).toBeNaN();
  });
});

describe('erreursSaisie', () => {
  it('aucune erreur pour une saisie correcte ou vide', () => {
    expect(erreursSaisie(SAISIE_VIDE)).toEqual({});
    expect(erreursSaisie(avec({ tensionSystolique: '120', tensionDiastolique: '80', poids: '72,5' }))).toEqual({});
  });
  it('hors bornes, illisible, entier attendu, trop de décimales', () => {
    expect(erreursSaisie(avec({ temperature: '375' })).temperature).toBe('Entre 30 et 45 °C');
    expect(erreursSaisie(avec({ poids: 'abc' })).poids).toBe('Entre 0,3 et 400 kg');
    expect(erreursSaisie(avec({ pouls: '72,5' })).pouls).toBe('Entre 20 et 250 bpm, nombre entier');
    expect(erreursSaisie(avec({ glycemie: '1,255' })).glycemie).toBe('Entre 0,1 et 6 g/L, 2 décimales au plus');
  });
  it('tension : les deux valeurs, haute > basse', () => {
    expect(erreursSaisie(avec({ tensionSystolique: '120' })).tensionDiastolique).toBe('Saisir les deux valeurs de la tension');
    expect(erreursSaisie(avec({ tensionSystolique: '80', tensionDiastolique: '120' })).tensionSystolique).toBe(
      'La tension haute doit dépasser la basse',
    );
  });
});

describe('conversions', () => {
  it('versValeurs ne garde que les champs remplis', () => {
    expect(versValeurs(avec({ poids: '72,5', taille: '' }))).toEqual({ poids: 72.5 });
  });
  it('versValeursCompletes met null dans les champs vidés', () => {
    const v = versValeursCompletes(avec({ poids: '70' }));
    expect(v.poids).toBe(70);
    expect(v.taille).toBeNull();
  });
  it('versSaisie écrit la virgule', () => {
    expect(versSaisie({ temperature: 37.5, poids: null }).temperature).toBe('37,5');
    expect(versSaisie({ temperature: 37.5, poids: null }).poids).toBe('');
  });
  it('saisieVide et memeSaisie', () => {
    expect(saisieVide(SAISIE_VIDE)).toBe(true);
    expect(saisieVide(avec({ poids: '7' }))).toBe(false);
    expect(memeSaisie(avec({ poids: '70' }), avec({ poids: ' 70 ' }))).toBe(true);
  });
});
