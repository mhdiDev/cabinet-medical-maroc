// backend/src/patients/recherche-patients.ts
import { Prisma } from '@prisma/client';

const SEPARATEURS = /[\s.-]/g;

// Conditions (à combiner en ET) pour le texte d'une recherche de patients.
// - un numéro saisi avec séparateurs (« 06 12 34 ») est cherché d'un bloc, sans séparateurs
//   (les téléphones sont stockés sans espace : 0612345678) ;
// - sinon chaque mot doit se trouver dans le nom, le prénom ou le téléphone :
//   « Ahmed Tazi » et « Tazi Ahmed » trouvent le même patient.
export function conditionsRecherche(q: string): Prisma.PatientWhereInput[] {
  const texte = q.trim();
  if (!texte) return [];

  const chiffres = texte.replace(SEPARATEURS, '');
  if (/^\d+$/.test(chiffres) && chiffres !== texte) {
    return [{ telephone: { contains: chiffres } }];
  }

  return texte.split(/\s+/).map(
    (mot): Prisma.PatientWhereInput => ({
      OR: [
        { nom: { contains: mot, mode: Prisma.QueryMode.insensitive } },
        { prenom: { contains: mot, mode: Prisma.QueryMode.insensitive } },
        { telephone: { contains: mot } },
      ],
    }),
  );
}
