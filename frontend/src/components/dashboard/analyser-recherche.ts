// frontend/src/components/dashboard/analyser-recherche.ts

export type Recherche =
  | { type: 'vide' }
  | { type: 'aide'; message: string }
  | { type: 'erreur'; message: string }
  | { type: 'requete'; q?: string; date?: string };

// JJ/MM/AAAA, séparateurs / - ou . ; une année à 4 chiffres distingue une date d'un téléphone (06-12-34)
const DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

const deux = (n: number) => String(n).padStart(2, '0');

// Lit la saisie de la barre de recherche : un mot peut être une date, le reste est le texte
export function analyserRecherche(texte: string): Recherche {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  const reste: string[] = [];
  let date: string | undefined;

  for (const mot of mots) {
    const m = date ? null : DATE.exec(mot);
    if (m) {
      const [j, mois, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const d = new Date(Date.UTC(a, mois - 1, j));
      const reelle = a >= 1900 && d.getUTCFullYear() === a && d.getUTCMonth() === mois - 1 && d.getUTCDate() === j;
      if (!reelle) return { type: 'erreur', message: 'Date invalide' };
      date = `${a}-${deux(mois)}-${deux(j)}`;
    } else if (mot.includes('/')) {
      // Date en cours de frappe (« 10/11 »)
      return { type: 'aide', message: 'Date au format JJ/MM/AAAA' };
    } else {
      reste.push(mot);
    }
  }

  const q = reste.join(' ');
  if (!date && q.length < 2) return { type: 'vide' };
  return { type: 'requete', ...(q && { q }), ...(date && { date }) };
}
