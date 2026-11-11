import path from 'path';

/** Date du jour à Paris (AAAA-MM-JJ) : nom du dossier du rapport */
export function dateDuJour(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

export const BASE_URL = (process.env.E2E_URL || 'http://localhost:3000').replace(/\/$/, '');

/** L'API est servie sous /api derrière Nginx ; en local elle tourne sur le port 3001 */
export const API_URL = (
  process.env.E2E_API_URL || (BASE_URL.includes('localhost:3000') ? 'http://localhost:3001/api' : `${BASE_URL}/api`)
).replace(/\/$/, '');

export const COMPTE = {
  email: process.env.E2E_EMAIL || 'admin@cabinet.ma',
  motDePasse: process.env.E2E_MOT_DE_PASSE || 'Admin123!',
};

export const JOUR = process.env.E2E_DATE || dateDuJour();

/** Dossier du jour : rapports/AAAA-MM-JJ (à la racine du dépôt) */
export const DOSSIER_JOUR = path.resolve(__dirname, '..', '..', 'rapports', JOUR);
export const DOSSIER_CAPTURES = path.join(DOSSIER_JOUR, 'captures');
export const DOSSIER_PROBLEMES = path.join(DOSSIER_JOUR, 'donnees', 'problemes');
