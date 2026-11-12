import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { controlerEcran, noterEchec } from '../lib/controles';
import {
  allerA,
  creerPatientFictif,
  nomFictif,
  retirerPatientsFictifs,
  seConnecter,
  type PatientFictif,
} from '../lib/session';

/**
 * Parcours des écrans principaux, joués sur chaque profil (desktop, iPhone 13, Pixel 7).
 * Données fictives uniquement : patients « TEST-E2E », téléphones 0699xxxxxx.
 */

let patient: PatientFictif;

test.beforeAll(async ({}, testInfo) => {
  patient = await creerPatientFictif(testInfo.project.name);
});

test.afterAll(async ({}, testInfo) => {
  await retirerPatientsFictifs(testInfo.project.name);
});

/** Une étape du parcours : si elle échoue, le problème est noté dans le rapport du jour */
async function etape(page: Page, testInfo: TestInfo, ecran: string, action: () => Promise<void>) {
  try {
    await test.step(ecran, action);
  } catch (err) {
    const message = (err as Error).message.split('\n').slice(0, 3).join(' ').slice(0, 400);
    noterEchec(testInfo, ecran, page.url(), message);
    throw err;
  }
}

/**
 * Créneaux du jour, de 19h30 à 8h00 par pas de 30 min (heures affichées par l'agenda), au format de <input type="datetime-local">.
 * Les créneaux déjà pris (autres profils, lancements précédents) sont refusés par l'API : on essaie le suivant.
 */
function creneauxDuJour() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const jour = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  const creneaux: string[] = [];
  for (let minutes = 19 * 60 + 30; minutes >= 8 * 60; minutes -= 30) {
    creneaux.push(`${jour}T${p(Math.floor(minutes / 60))}:${p(minutes % 60)}`);
  }
  return creneaux;
}

test('1. Connexion', async ({ page }, testInfo) => {
  await etape(page, testInfo, 'Connexion', async () => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await controlerEcran(page, testInfo, 'Connexion');
  });

  await etape(page, testInfo, 'Connexion — mauvais mot de passe', async () => {
    await page.locator('input[name="email"]').fill('inconnu@exemple.ma');
    await page.locator('input[name="motDePasse"]').fill('MauvaisMdp1');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    // Message d'erreur et pas de redirection
    await expect(page.getByText(/incorrect|invalide/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  await etape(page, testInfo, 'Connexion — compte de test', async () => {
    await seConnecter(page);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test('2. Tableau de bord et recherche', async ({ page }, testInfo) => {
  await seConnecter(page);

  await etape(page, testInfo, 'Tableau de bord', async () => {
    await expect(page.getByRole('combobox', { name: 'Rechercher un patient' })).toBeVisible();
    await controlerEcran(page, testInfo, 'Tableau de bord');
  });

  await etape(page, testInfo, 'Tableau de bord — recherche patient', async () => {
    const recherche = page.getByRole('combobox', { name: 'Rechercher un patient' });
    await recherche.fill(patient.prenom);
    await expect(page.getByRole('option').filter({ hasText: patient.prenom }).first()).toBeVisible();
    await controlerEcran(page, testInfo, 'Tableau de bord — résultats de recherche');
  });
});

test('3. Patients : création et fiche', async ({ page }, testInfo) => {
  await seConnecter(page);
  const { nom, prenom } = nomFictif(testInfo.project.name);

  await etape(page, testInfo, 'Liste des patients', async () => {
    await allerA(page, /^Patients$/, /\/patients$/);
    await expect(page.getByRole('link', { name: /Nouveau patient/ })).toBeVisible();
    await controlerEcran(page, testInfo, 'Liste des patients');
  });

  await etape(page, testInfo, 'Nouveau patient', async () => {
    await page.getByRole('link', { name: /Nouveau patient/ }).click();
    await page.waitForURL(/\/patients\/nouveau/);
    await controlerEcran(page, testInfo, 'Nouveau patient');
    await page.locator('input[name="nom"]').fill(nom);
    await page.locator('input[name="prenom"]').fill(`${prenom}-ui`);
    await page.locator('input[name="dateNaissance"]').fill('1985-06-15');
    await page.locator('select[name="sexe"]').selectOption('MASCULIN');
    await page.locator('input[name="telephone"]').fill(`0698${String(Date.now()).slice(-6)}`);
    await page.locator('input[name="ville"]').fill('Ville fictive');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
  });

  await etape(page, testInfo, 'Fiche patient', async () => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${prenom}-ui`);
    await controlerEcran(page, testInfo, 'Fiche patient');
  });

  await etape(page, testInfo, 'Constantes — prise', async () => {
    await page.getByRole('button', { name: 'Prendre les constantes' }).click();
    const modale = page.getByRole('dialog', { name: 'Prendre les constantes' });
    await expect(modale).toBeVisible();
    await modale.locator('[name="tensionSystolique"]').fill('125');
    await modale.locator('[name="tensionDiastolique"]').fill('80');
    await modale.locator('[name="temperature"]').fill('37,2');
    await modale.locator('[name="poids"]').fill('72');
    await modale.locator('[name="taille"]').fill('170');
    await expect(modale.getByTestId('imc')).toHaveText('24,9');
    await controlerEcran(page, testInfo, 'Constantes — prise');
    await modale.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('Constantes enregistrées')).toBeVisible();
  });

  await etape(page, testInfo, 'Constantes — onglet', async () => {
    await page.getByRole('button', { name: 'Constantes', exact: true }).click();
    await expect(page.getByText('Dernières valeurs')).toBeVisible();
    await controlerEcran(page, testInfo, 'Constantes — onglet');
  });

  await etape(page, testInfo, 'Modifier le patient', async () => {
    await page.locator('main a[href$="/modifier"]').first().click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}\/modifier$/);
    await expect(page.locator('input[name="nom"]')).toHaveValue(nom);
    await controlerEcran(page, testInfo, 'Modifier le patient');
  });
});

test('4. Agenda et prise de rendez-vous', async ({ page }, testInfo) => {
  await seConnecter(page);

  await etape(page, testInfo, 'Agenda', async () => {
    await allerA(page, /^Agenda$/, /\/agenda/);
    await expect(page.getByRole('button', { name: '+ Nouveau RDV' })).toBeVisible();
    await controlerEcran(page, testInfo, 'Agenda');
  });

  await etape(page, testInfo, 'Agenda — nouveau rendez-vous', async () => {
    await page.getByRole('button', { name: '+ Nouveau RDV' }).click();
    await expect(page.getByRole('heading', { name: 'Nouveau rendez-vous' })).toBeVisible();
    const choix = page.locator('select[name="patientId"]');
    const option = choix.locator('option').filter({ hasText: patient.prenom });
    await expect(option).toHaveCount(1);
    await choix.selectOption((await option.getAttribute('value'))!);
    await page.locator('input[name="motif"]').fill('Contrôle fictif E2E');
    const creneaux = creneauxDuJour();
    await page.locator('input[name="dateHeure"]').fill(creneaux[0]);
    await controlerEcran(page, testInfo, 'Agenda — nouveau rendez-vous');
    const cree = page.getByText('Rendez-vous créé');
    const occupe = page.getByText('Créneau déjà occupé');
    for (const creneau of creneaux) {
      await page.locator('input[name="dateHeure"]').fill(creneau);
      await page.getByRole('button', { name: 'Créer le RDV' }).click();
      await expect(cree.or(occupe).first()).toBeVisible();
      if (await cree.isVisible()) break;
      // Laisser disparaître le message avant l'essai suivant
      await expect(occupe).toBeHidden({ timeout: 8_000 }).catch(() => undefined);
    }
    await expect(cree).toBeVisible();
  });
});

test('5. Consultation depuis la fiche patient', async ({ page }, testInfo) => {
  await seConnecter(page);

  await etape(page, testInfo, 'Nouvelle consultation', async () => {
    await page.goto(`/patients/${patient.id}`);
    // Bouton « Consultation » de la fiche (pas l'entrée « Consultations » du menu)
    await page.locator('main a[href^="/consultations/nouvelle?patientId="]').first().click();
    await page.waitForURL(/\/consultations\/nouvelle\?patientId=/);
    // Le patient est pré-rempli : le bouton d'enregistrement devient actif
    const enregistrer = page.getByRole('button', { name: 'Enregistrer la consultation' });
    await expect(enregistrer).toBeEnabled();
    await page.locator('[name="motif"]').fill('Motif fictif E2E');
    await page.locator('[name="examenClinique"]').fill('TA 120/80, examen fictif');
    await page.locator('[name="diagnostic"]').fill('Diagnostic fictif');
    await page.locator('[name="pouls"]').fill('76');
    await page.locator('[name="spo2"]').fill('98');
    await controlerEcran(page, testInfo, 'Nouvelle consultation');
    await enregistrer.click();
    // Après l'enregistrement, l'application ouvre l'encaissement de la consultation
    await page.waitForURL(/\/paiements\?consultationId=/);
  });

  await etape(page, testInfo, 'Encaissement de la consultation', async () => {
    await expect(page.getByRole('heading', { name: 'Nouvel encaissement' })).toBeVisible();
    const montant = page.locator('input[name="montant"]');
    if (!(await montant.inputValue())) await montant.fill('200');
    await controlerEcran(page, testInfo, 'Encaissement de la consultation');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByText('Paiement enregistré')).toBeVisible();
  });

  await etape(page, testInfo, 'Ordonnances', async () => {
    await page.goto('/ordonnances');
    await expect(page.getByRole('heading', { name: 'Ordonnances' })).toBeVisible();
    await controlerEcran(page, testInfo, 'Ordonnances');
  });
});

test('6. Facturation : caisse et rapport', async ({ page }, testInfo) => {
  await seConnecter(page);

  await etape(page, testInfo, 'Caisse journalière', async () => {
    await allerA(page, /^Caisse$/, /\/paiements/);
    await expect(page.getByRole('heading', { name: 'Caisse & Recettes' })).toBeVisible();
    await controlerEcran(page, testInfo, 'Caisse journalière');
  });

  await etape(page, testInfo, 'Nouvel encaissement', async () => {
    await page.getByRole('button', { name: '+ Encaissement' }).click();
    await expect(page.getByRole('heading', { name: 'Nouvel encaissement' })).toBeVisible();
    await controlerEcran(page, testInfo, 'Nouvel encaissement');
    await page.getByRole('button', { name: 'Annuler' }).click();
  });

  await etape(page, testInfo, 'Rapport périodique', async () => {
    await page.getByRole('button', { name: 'Rapport périodique' }).click();
    await controlerEcran(page, testInfo, 'Rapport périodique');
  });
});

test('7. Paramètres : mon compte et utilisateurs', async ({ page }, testInfo) => {
  await seConnecter(page);

  await etape(page, testInfo, 'Mon compte', async () => {
    await allerA(page, /^Mon compte$/, /\/mon-compte/);
    await expect(page.getByRole('heading', { name: 'Mon compte' })).toBeVisible();
    // Lecture seule : aucun mot de passe n'est modifié
    await controlerEcran(page, testInfo, 'Mon compte');
  });

  await etape(page, testInfo, 'Utilisateurs', async () => {
    await allerA(page, /^Utilisateurs$/, /\/utilisateurs/);
    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible();
    await controlerEcran(page, testInfo, 'Utilisateurs');
  });
});
