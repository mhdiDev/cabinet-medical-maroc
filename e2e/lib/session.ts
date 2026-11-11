import { expect, request, type Page } from '@playwright/test';
import { API_URL, COMPTE, JOUR } from './config';

/** Connexion par l'écran de connexion */
export async function seConnecter(page: Page) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(COMPTE.email);
  await page.locator('input[name="motDePasse"]').fill(COMPTE.motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL(/\/(dashboard|mon-compte)/, { timeout: 20_000 });
  if (page.url().includes('/mon-compte')) {
    throw new Error(
      'Le compte de test doit changer son mot de passe : connectez-vous une fois à la main avec ce compte et choisissez un mot de passe.',
    );
  }
}

/** Ouvre une page du menu : sur mobile, le menu est replié derrière un bouton */
export async function allerA(page: Page, libelle: RegExp, chemin: RegExp) {
  const menu = page.getByRole('button', { name: 'Ouvrir le menu' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Menu principal' }).getByRole('link', { name: libelle }).click();
  await page.waitForURL(chemin);
}

export interface PatientFictif {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
}

/** Numéro fictif : 0699 suivi de 6 chiffres aléatoires */
function telephoneFictif() {
  return `0699${String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')}`;
}

/** Nom reconnaissable : jamais confondu avec un vrai patient */
export function nomFictif(projet: string) {
  return { nom: 'TEST-E2E', prenom: `${projet.replace(/[^a-z0-9]/gi, '')}-${JOUR}` };
}

async function apiConnectee() {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_URL}/auth/login`, { data: { email: COMPTE.email, motDePasse: COMPTE.motDePasse } });
  expect(res.ok(), `connexion à l'API (${res.status()})`).toBeTruthy();
  const { accessToken } = await res.json();
  return { ctx, headers: { Authorization: `Bearer ${accessToken}` } };
}

/** Crée par l'API un patient fictif, pour les parcours qui en ont besoin */
export async function creerPatientFictif(projet: string): Promise<PatientFictif> {
  const { ctx, headers } = await apiConnectee();
  const { nom, prenom } = nomFictif(projet);
  const telephone = telephoneFictif();
  const res = await ctx.post(`${API_URL}/patients`, {
    headers,
    data: { nom, prenom: `${prenom}-api`, dateNaissance: '1990-01-01', sexe: 'FEMININ', telephone, allergies: [] },
  });
  expect(res.ok(), `création du patient fictif (${res.status()} ${await res.text()})`).toBeTruthy();
  const p = await res.json();
  await ctx.dispose();
  return { id: p.id, nom: p.nom, prenom: p.prenom, telephone };
}

/** Désactive les patients fictifs créés par les tests (la suppression d'un patient est une désactivation) */
export async function retirerPatientsFictifs(projet: string) {
  const { ctx, headers } = await apiConnectee();
  const { prenom } = nomFictif(projet);
  const res = await ctx.get(`${API_URL}/patients`, { headers, params: { q: prenom, limit: 50 } });
  if (res.ok()) {
    const { data } = await res.json();
    for (const p of data ?? []) {
      if (p.nom === 'TEST-E2E') await ctx.delete(`${API_URL}/patients/${p.id}`, { headers });
    }
  }
  await ctx.dispose();
}
