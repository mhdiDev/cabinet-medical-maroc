import { Transform } from 'class-transformer';

// Emails comparés sans tenir compte de la casse ni des espaces
export const NormaliserEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
