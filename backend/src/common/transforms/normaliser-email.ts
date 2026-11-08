import { Transform } from 'class-transformer';

// Emails comparés sans tenir compte de la casse ni des espaces.
// Lit la valeur brute (obj[key]) : avec enableImplicitConversion, `value` serait déjà
// convertie en chaîne (123 → '123', ['a@b.ma'] → 'a@b.ma')
export const NormaliserEmail = () =>
  Transform(({ obj, key }) =>
    typeof obj[key] === 'string' ? obj[key].trim().toLowerCase() : obj[key],
  );
