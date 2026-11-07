import { randomInt } from 'crypto';

// Sans caractères ambigus à la lecture ou à la dictée : 0/O, 1/l/I
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MINUSCULES = 'abcdefghijkmnopqrstuvwxyz';
const CHIFFRES = '23456789';
const TOUS = MAJUSCULES + MINUSCULES + CHIFFRES;
const LONGUEUR = 12;

const tirer = (alphabet: string) => alphabet[randomInt(alphabet.length)];

// Mot de passe aléatoire avec au moins une majuscule, une minuscule et un chiffre
export function genererMotDePasse(): string {
  const caracteres = [tirer(MAJUSCULES), tirer(MINUSCULES), tirer(CHIFFRES)];
  while (caracteres.length < LONGUEUR) caracteres.push(tirer(TOUS));

  // Mélange de Fisher-Yates, pour que les trois premiers caractères ne soient pas prévisibles
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
