/**
 * Génère rapports/AAAA-MM-JJ/rapport-tests-AAAA-MM-JJ.md à partir des résultats du jour :
 * problèmes relevés par les contrôles, échecs des parcours, avis UX (Claude si ANTHROPIC_API_KEY
 * est défini) et actions de correction à donner à Claude Code.
 */
import fs from 'fs';
import path from 'path';
import { BASE_URL, DOSSIER_JOUR, DOSSIER_PROBLEMES, JOUR } from '../lib/config';
import type { Ecran, Gravite, Probleme } from '../lib/controles';
import { analyserCaptures, type AvisUx } from './avis-ux';

const ORDRE: Record<Gravite, number> = { bloquant: 0, majeur: 1, mineur: 2 };
const PICTO: Record<Gravite, string> = { bloquant: '🔴 bloquant', majeur: '🟠 majeur', mineur: '🟡 mineur' };
const TYPES: Record<Probleme['type'], string> = {
  parcours: 'Parcours en échec',
  chevauchement: 'Éléments qui se chevauchent',
  'debordement-horizontal': 'Débordement horizontal',
  'zone-cliquable': 'Zones cliquables trop petites',
  'texte-tronque': 'Textes tronqués ou masqués',
  accessibilite: 'Accessibilité (axe-core)',
};

/** Fichiers de l'application les plus probables pour un écran */
const FICHIERS: Record<string, string> = {
  Connexion: 'frontend/src/app/(auth)/login/page.tsx',
  'Tableau de bord': 'frontend/src/app/(dashboard)/dashboard/page.tsx',
  'Liste des patients': 'frontend/src/app/(dashboard)/patients/page.tsx',
  'Nouveau patient': 'frontend/src/app/(dashboard)/patients/nouveau/page.tsx',
  'Fiche patient': 'frontend/src/app/(dashboard)/patients/[id]/page.tsx',
  'Modifier le patient': 'frontend/src/app/(dashboard)/patients/[id]/modifier/page.tsx',
  Agenda: 'frontend/src/app/(dashboard)/agenda/page.tsx',
  'Agenda — nouveau rendez-vous': 'frontend/src/components/agenda/NouveauRdvModal.tsx',
  'Nouvelle consultation': 'frontend/src/app/(dashboard)/consultations/nouvelle/page.tsx',
  'Encaissement de la consultation': 'frontend/src/app/(dashboard)/paiements/page.tsx',
  'Caisse journalière': 'frontend/src/app/(dashboard)/paiements/page.tsx',
  'Nouvel encaissement': 'frontend/src/app/(dashboard)/paiements/page.tsx',
  'Rapport périodique': 'frontend/src/app/(dashboard)/paiements/page.tsx',
  Ordonnances: 'frontend/src/app/(dashboard)/ordonnances/page.tsx',
  'Mon compte': 'frontend/src/app/(dashboard)/mon-compte/page.tsx',
  Utilisateurs: 'frontend/src/app/(dashboard)/utilisateurs/page.tsx',
};

function fichierDe(ecran: string) {
  const cle = Object.keys(FICHIERS)
    .sort((a, b) => b.length - a.length)
    .find((k) => ecran.startsWith(k));
  return cle ? FICHIERS[cle] : 'frontend/src/app/(dashboard)/';
}

function lireResultats() {
  const ecrans: Ecran[] = [];
  const problemes: Probleme[] = [];
  if (fs.existsSync(DOSSIER_PROBLEMES)) {
    for (const f of fs.readdirSync(DOSSIER_PROBLEMES).filter((n) => n.endsWith('.json'))) {
      const c = JSON.parse(fs.readFileSync(path.join(DOSSIER_PROBLEMES, f), 'utf8'));
      ecrans.push(...c.ecrans);
      problemes.push(...c.problemes);
    }
  }
  return { ecrans, problemes };
}

/** Bilan des tests Playwright (rapport JSON) */
function lireBilan() {
  const f = path.join(DOSSIER_JOUR, 'donnees', 'resultats.json');
  if (!fs.existsSync(f)) return null;
  const r = JSON.parse(fs.readFileSync(f, 'utf8'));
  return r.stats as { expected: number; unexpected: number; flaky: number; skipped: number; duration: number };
}

const echapper = (t: string) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const profil = (p: Probleme | Ecran) => (p.mobile ? `mobile (${p.projet.replace('mobile-', '')})` : 'desktop');

/** Regroupe les problèmes identiques vus sur plusieurs profils ou écrans */
function regrouper(problemes: Probleme[]) {
  const groupes = new Map<string, { p: Probleme; profils: Set<string>; captures: Set<string> }>();
  for (const p of problemes) {
    const cle = [p.ecran, p.type, p.selecteur, p.description.replace(/\d+(×\d+)? px/g, '')].join('|');
    const g = groupes.get(cle) ?? { p, profils: new Set(), captures: new Set() };
    g.profils.add(profil(p));
    if (p.capture) g.captures.add(p.capture);
    if (ORDRE[p.gravite] < ORDRE[g.p.gravite]) g.p = p;
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort(
    (a, b) => ORDRE[a.p.gravite] - ORDRE[b.p.gravite] || a.p.ecran.localeCompare(b.p.ecran) || a.p.type.localeCompare(b.p.type),
  );
}

function sectionProblemes(problemes: Probleme[]) {
  const lignes: string[] = [];
  const groupes = regrouper(problemes);
  if (!groupes.length) return '_Aucun problème relevé._\n';
  for (const type of Object.keys(TYPES) as Probleme['type'][]) {
    const duType = groupes.filter((g) => g.p.type === type);
    if (!duType.length) continue;
    lignes.push(`### ${TYPES[type]} (${duType.length})`, '');
    lignes.push('| Gravité | Écran | Profil | Description | Sélecteur / fichier | Capture |');
    lignes.push('|---|---|---|---|---|---|');
    for (const g of duType) {
      const captures = [...g.captures].map((c, i) => `[${i + 1}](${encodeURI(c)})`).join(' ');
      lignes.push(
        `| ${PICTO[g.p.gravite]} | ${echapper(g.p.ecran)} | ${[...g.profils].join(', ')} | ${echapper(g.p.description)} | \`${echapper(
          g.p.selecteur,
        )}\`<br>${fichierDe(g.p.ecran)} | ${captures || '—'} |`,
      );
    }
    lignes.push('');
  }
  return lignes.join('\n');
}

function sectionAvisUx(ecrans: Ecran[], avis: AvisUx[] | null) {
  const mobiles = ecrans.filter((e) => e.mobile);
  const lignes = ['## Avis UX', ''];
  if (avis) {
    lignes.push(`_Analyse automatique des captures mobiles par Claude (${avis.length} écrans)._`, '');
    for (const a of avis) lignes.push(`### ${a.ecran} — ${a.projet}`, '', `![${a.ecran}](${encodeURI(a.capture)})`, '', a.texte, '');
    return lignes.join('\n');
  }
  lignes.push(
    '_Pas de clé `ANTHROPIC_API_KEY` : section à remplir. Pour chaque écran mobile, regarder la capture et noter :_',
    '_lisibilité, hiérarchie visuelle, nombre d\'étapes pour les actions fréquentes, cohérence des boutons, suggestions concrètes._',
    '',
  );
  const parEcran = new Map<string, Ecran[]>();
  for (const e of mobiles) parEcran.set(e.ecran, [...(parEcran.get(e.ecran) ?? []), e]);
  for (const [ecran, liste] of parEcran) {
    lignes.push(`### ${ecran}`, '', liste.map((e) => `[${e.projet}](${encodeURI(e.capture)})`).join(' · '), '');
    lignes.push('- Lisibilité : ', '- Hiérarchie visuelle : ', '- Étapes pour les actions fréquentes : ', '- Cohérence des boutons : ', '- Suggestions : ', '');
  }
  return lignes.join('\n');
}

function sectionActions(problemes: Probleme[]) {
  const groupes = regrouper(problemes);
  const lignes = [
    '## Actions de correction proposées',
    '',
    '> À donner telle quelle à Claude Code, dans le dépôt `cabinet-medical-maroc`.',
    '',
    '```text',
    `Corrige les problèmes relevés par les tests de bout en bout du ${JOUR} (rapport : rapports/${JOUR}/rapport-tests-${JOUR}.md).`,
    'Ordre : bloquants, puis chevauchements de champs sur mobile, puis majeurs, puis mineurs.',
    'Pour chaque correction : modifier le fichier indiqué, garder le style Tailwind existant (breakpoints sm: et lg:),',
    'puis relancer `cd e2e && npx playwright test` et vérifier que le problème a disparu du nouveau rapport.',
    '',
  ];
  let n = 1;
  const parFichier = new Map<string, typeof groupes>();
  for (const g of groupes) {
    if (g.p.gravite === 'mineur' && g.p.type === 'zone-cliquable') continue; // regroupé plus bas
    const f = fichierDe(g.p.ecran);
    parFichier.set(f, [...(parFichier.get(f) ?? []), g]);
  }
  for (const [fichier, liste] of parFichier) {
    lignes.push(`${n++}. ${fichier}`);
    for (const g of liste.slice(0, 15)) {
      lignes.push(`   - [${g.p.gravite}] ${g.p.ecran} (${[...g.profils].join(', ')}) : ${g.p.description} Sélecteur : ${g.p.selecteur}`);
    }
    if (liste.length > 15) lignes.push(`   - … et ${liste.length - 15} autre(s), voir le rapport.`);
  }
  const petites = groupes.filter((g) => g.p.gravite === 'mineur' && g.p.type === 'zone-cliquable');
  if (petites.length) {
    lignes.push(
      `${n++}. Zones cliquables entre 24 et 44 px sur mobile (${petites.length}) : agrandir la zone de clic (min-h-11 min-w-11 ou padding)`,
      `   sur mobile seulement (sm: garde la taille actuelle). Écrans : ${[...new Set(petites.map((g) => g.p.ecran))].join(', ')}.`,
    );
  }
  if (n === 1) lignes.push('Aucune correction à faire aujourd\'hui.');
  lignes.push('```', '');
  return lignes.join('\n');
}

async function main() {
  const { ecrans, problemes } = lireResultats();
  const bilan = lireBilan();
  const compte = (g: Gravite) => regrouper(problemes).filter((x) => x.p.gravite === g).length;

  let avis: AvisUx[] | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      avis = await analyserCaptures(ecrans.filter((e) => e.mobile), DOSSIER_JOUR);
    } catch (err) {
      console.error('Avis UX automatique impossible :', (err as Error).message);
    }
  }

  const md = [
    `# Rapport des tests de bout en bout — ${JOUR}`,
    '',
    `- Application testée : ${BASE_URL}`,
    bilan
      ? `- Tests : ${bilan.expected} réussis, ${bilan.unexpected} en échec, ${bilan.flaky} instables, ${bilan.skipped} ignorés (${Math.round(bilan.duration / 1000)} s)`
      : '- Tests : bilan Playwright introuvable',
    `- Écrans contrôlés : ${new Set(ecrans.map((e) => e.ecran)).size} écrans × ${new Set(ecrans.map((e) => e.projet)).size} profils (${ecrans.length} captures)`,
    `- Problèmes : ${compte('bloquant')} bloquants, ${compte('majeur')} majeurs, ${compte('mineur')} mineurs`,
    '- Rapport Playwright détaillé : [rapport-html/index.html](rapport-html/index.html)',
    '',
    '## Problèmes relevés',
    '',
    sectionProblemes(problemes),
    sectionAvisUx(ecrans, avis),
    sectionActions(problemes),
  ].join('\n');

  const sortie = path.join(DOSSIER_JOUR, `rapport-tests-${JOUR}.md`);
  fs.mkdirSync(DOSSIER_JOUR, { recursive: true });
  fs.writeFileSync(sortie, md);
  console.log(`Rapport écrit : ${sortie}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
