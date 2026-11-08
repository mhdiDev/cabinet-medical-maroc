import { Transform } from 'class-transformer';

// Retire les espaces autour d'un texte. Lit la valeur brute (obj[key]) : avec
// enableImplicitConversion, `value` serait déjà convertie en chaîne (123 → '123',
// true → 'true'), et IsString l'accepterait
export const NettoyerTexte = () =>
  Transform(({ obj, key }) => (typeof obj[key] === 'string' ? obj[key].trim() : obj[key]));
