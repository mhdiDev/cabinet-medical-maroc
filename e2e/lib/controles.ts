import fs from 'fs';
import path from 'path';
import AxeBuilder from '@axe-core/playwright';
import axeFr from 'axe-core/locales/fr.json';

// Script axe-core injecté dans la page, réglé en français (messages du rapport)
const AXE_FR = `${fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')}\naxe.configure({ locale: ${JSON.stringify(axeFr)} });`;
import type { Page, TestInfo } from '@playwright/test';
import { DOSSIER_CAPTURES, DOSSIER_PROBLEMES } from './config';

export type Gravite = 'bloquant' | 'majeur' | 'mineur';
export type TypeProbleme =
  | 'chevauchement'
  | 'debordement-horizontal'
  | 'zone-cliquable'
  | 'texte-tronque'
  | 'accessibilite'
  | 'parcours';

export interface Probleme {
  ecran: string;
  url: string;
  projet: string;
  mobile: boolean;
  type: TypeProbleme;
  gravite: Gravite;
  description: string;
  selecteur: string;
  capture: string;
}

export interface Ecran {
  ecran: string;
  url: string;
  projet: string;
  mobile: boolean;
  capture: string;
}

/** Ce que les contrôles lisent dans la page (exécuté dans le navigateur) */
interface Mesures {
  largeurPage: number;
  largeurEcran: number;
  debordants: string[];
  chevauchements: { a: string; b: string; texteA: string; texteB: string; recouvrement: number; champ: boolean }[];
  petitesCibles: { selecteur: string; texte: string; largeur: number; hauteur: number }[];
  tronques: { selecteur: string; texte: string }[];
}

function nomFichier(ecran: string) {
  return ecran.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

/**
 * Contrôle un écran : capture pleine page, mise en page (chevauchements, débordement,
 * zones cliquables, textes tronqués) et accessibilité (axe-core). Les problèmes sont
 * écrits dans le dossier du jour ; ils ne font pas échouer le test (seuls les parcours le font).
 */
export async function controlerEcran(page: Page, testInfo: TestInfo, ecran: string): Promise<Probleme[]> {
  const projet = testInfo.project.name;
  const mobile = projet.startsWith('mobile');

  // Laisser finir les chargements et animations avant de mesurer
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(400);

  const fichier = `${nomFichier(ecran)}.png`;
  const capture = path.join(DOSSIER_CAPTURES, projet, fichier);
  fs.mkdirSync(path.dirname(capture), { recursive: true });
  // La page défile dans une zone (<main overflow-y-auto>) et non dans la fenêtre : la déplier
  // le temps de la capture pour qu'elle montre tout l'écran, puis remettre la mise en page
  await page.evaluate(deplierZonesDefilantes, true);
  await page.screenshot({ path: capture, fullPage: true, scale: 'css' });
  await page.evaluate(deplierZonesDefilantes, false);
  const captureRel = `captures/${projet}/${fichier}`;

  const base = { ecran, url: new URL(page.url()).pathname + new URL(page.url()).search, projet, mobile, capture: captureRel };
  const problemes: Probleme[] = [];
  const m = await page.evaluate(mesurerPage, { mobile });

  if (m.largeurPage > m.largeurEcran + 1) {
    problemes.push({
      ...base,
      type: 'debordement-horizontal',
      gravite: mobile ? 'majeur' : 'mineur',
      description: `La page fait ${m.largeurPage} px de large pour un écran de ${m.largeurEcran} px : défilement horizontal.`,
      selecteur: m.debordants.join(', ') || 'html',
    });
  }

  for (const c of m.chevauchements) {
    problemes.push({
      ...base,
      type: 'chevauchement',
      // Un champ de formulaire recouvert empêche la saisie
      gravite: c.champ && c.recouvrement >= 0.3 ? 'bloquant' : c.champ ? 'majeur' : 'mineur',
      description: `« ${c.texteA} » et « ${c.texteB} » se chevauchent (${Math.round(c.recouvrement * 100)} % de la plus petite boîte).`,
      selecteur: `${c.a}  ⟷  ${c.b}`,
    });
  }

  if (mobile) {
    for (const t of m.petitesCibles) {
      problemes.push({
        ...base,
        type: 'zone-cliquable',
        gravite: t.largeur < 24 || t.hauteur < 24 ? 'majeur' : 'mineur',
        description: `Zone cliquable « ${t.texte} » de ${t.largeur}×${t.hauteur} px (minimum 44×44 px sur mobile).`,
        selecteur: t.selecteur,
      });
    }
  }

  for (const t of m.tronques) {
    problemes.push({
      ...base,
      type: 'texte-tronque',
      gravite: 'mineur',
      description: `Texte coupé ou masqué : « ${t.texte} ».`,
      selecteur: t.selecteur,
    });
  }

  // @axe-core/playwright est typé avec sa propre version de playwright-core : même objet à l'exécution
  const axe = await new AxeBuilder({
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'],
    axeSource: AXE_FR,
  })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  for (const v of axe.violations) {
    const gravite: Gravite = v.impact === 'critical' ? 'bloquant' : v.impact === 'serious' ? 'majeur' : 'mineur';
    problemes.push({
      ...base,
      type: 'accessibilite',
      gravite,
      description: `${v.help} (${v.id}, ${v.nodes.length} élément(s)).`,
      selecteur: v.nodes
        .slice(0, 5)
        .map((n: { target: unknown[] }) => n.target.join(' '))
        .join(', '),
    });
  }

  enregistrer(testInfo, base, problemes);
  return problemes;
}

/** Problème de parcours (étape qui échoue) : noté dans le rapport, le test échoue ensuite */
export function noterEchec(testInfo: TestInfo, ecran: string, url: string, description: string) {
  const projet = testInfo.project.name;
  const probleme: Probleme = {
    ecran,
    url,
    projet,
    mobile: projet.startsWith('mobile'),
    type: 'parcours',
    gravite: 'bloquant',
    description,
    selecteur: '—',
    capture: '',
  };
  ecrireJson(`${projet}--echec-${nomFichier(ecran)}-${Date.now()}.json`, { ecrans: [], problemes: [probleme] });
}

function enregistrer(testInfo: TestInfo, ecran: Ecran, problemes: Probleme[]) {
  ecrireJson(`${testInfo.project.name}--${nomFichier(ecran.ecran)}.json`, { ecrans: [ecran], problemes });
}

function ecrireJson(nom: string, contenu: unknown) {
  fs.mkdirSync(DOSSIER_PROBLEMES, { recursive: true });
  fs.writeFileSync(path.join(DOSSIER_PROBLEMES, nom), JSON.stringify(contenu, null, 2));
}

/** Exécuté dans la page : déplie (ou remet) les zones qui défilent et leurs parents de hauteur fixe */
function deplierZonesDefilantes(deplier: boolean) {
  const ATTR = 'data-e2e-style';
  if (!deplier) {
    for (const el of Array.from(document.querySelectorAll(`[${ATTR}]`)) as HTMLElement[]) {
      el.setAttribute('style', el.getAttribute(ATTR) || '');
      if (!el.getAttribute(ATTR)) el.removeAttribute('style');
      el.removeAttribute(ATTR);
    }
    return;
  }
  const ouvrir = (el: HTMLElement) => {
    if (el.hasAttribute(ATTR)) return;
    el.setAttribute(ATTR, el.getAttribute('style') || '');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('height', 'auto', 'important');
    el.style.setProperty('max-height', 'none', 'important');
  };
  for (const el of Array.from(document.body.querySelectorAll('*')) as HTMLElement[]) {
    const s = getComputedStyle(el);
    if (!/(auto|scroll)/.test(s.overflowY) || el.scrollHeight <= el.clientHeight + 1) continue;
    if (el.closest('[role=dialog], [aria-modal=true], .fixed')) continue; // fenêtres et menus : laisser tels quels
    for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) ouvrir(p);
  }
}

/* ------------------------------------------------------------------------------------------
 * Exécuté dans la page : ne doit rien utiliser de l'extérieur (sérialisé par Playwright).
 * ---------------------------------------------------------------------------------------- */
function mesurerPage({ mobile }: { mobile: boolean }): Mesures {
  const largeurEcran = document.documentElement.clientWidth;
  const largeurPage = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);

  // Fenêtre modale ouverte (fond sombre plein écran ou role=dialog) : la dernière ouverte
  const couches = Array.from(document.querySelectorAll('[role=dialog], [aria-modal=true], .fixed.inset-0')).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
  const couche: Element | null = couches.length ? couches[couches.length - 1] : null;

  const selecteur = (el: Element): string => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const tag = el.tagName.toLowerCase();
    const nom = el.getAttribute('name');
    if (nom) return `${tag}[name="${nom}"]`;
    const aria = el.getAttribute('aria-label');
    if (aria) return `${tag}[aria-label="${aria}"]`;
    const parties: string[] = [];
    let courant: Element | null = el;
    while (courant && courant !== document.body && parties.length < 4) {
      let partie = courant.tagName.toLowerCase();
      const parent: Element | null = courant.parentElement;
      if (parent) {
        const memes = Array.from(parent.children).filter((c) => c.tagName === courant!.tagName);
        if (memes.length > 1) partie += `:nth-of-type(${memes.indexOf(courant) + 1})`;
      }
      parties.unshift(partie);
      if (courant.id) {
        parties[0] = `#${CSS.escape(courant.id)}`;
        break;
      }
      courant = parent;
    }
    return parties.join(' > ');
  };

  const texte = (el: Element): string => {
    const t =
      (el as HTMLInputElement).placeholder ||
      el.getAttribute('aria-label') ||
      (el.textContent || '').trim() ||
      (el as HTMLInputElement).value ||
      el.getAttribute('name') ||
      el.tagName.toLowerCase();
    return t.replace(/\s+/g, ' ').slice(0, 60);
  };

  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    // Hors de l'écran à gauche ou à droite (menu mobile replié) : pas affiché
    if (r.right <= 0 || r.left >= largeurEcran) return false;
    // Fenêtre ouverte par-dessus la page : seul son contenu est utilisable
    if (couche && !couche.contains(el)) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    // Texte réservé aux lecteurs d'écran (sr-only)
    if (s.position === 'absolute' && s.clip !== 'auto' && r.width <= 2) return false;
    return true;
  };

  // Éléments sous une couche visuelle différente (modale, menu) : ignorer les éléments masqués par l'overlay
  const auPremierPlan = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth) return true; // hors écran : non vérifiable
    const dessus = document.elementFromPoint(x, y);
    return !dessus || el.contains(dessus) || dessus.contains(el) || !!dessus.closest('label')?.contains(el);
  };

  // 1. Débordement : éléments qui dépassent à droite
  const debordants: string[] = [];
  if (largeurPage > largeurEcran + 1) {
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.right > largeurEcran + 1 && r.width >= 2 && r.height >= 2 && getComputedStyle(el).visibility !== 'hidden') {
        // Garder le plus extérieur : ignorer un élément dont le parent déborde déjà
        const parent = el.parentElement;
        if (parent && parent.getBoundingClientRect().right > largeurEcran + 1 && parent !== document.body) continue;
        debordants.push(selecteur(el));
        if (debordants.length >= 5) break;
      }
    }
  }

  // 2. Chevauchements entre champs, boutons et libellés
  const elements = Array.from(
    document.querySelectorAll('input:not([type=hidden]), select, textarea, button, a[href], label, [role=button]'),
  ).filter((el) => visible(el) && !el.closest('[aria-hidden="true"]'));

  const chevauchements: Mesures['chevauchements'] = [];
  const estChamp = (el: Element) => ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
  const boites = elements.map((el) => ({ el, r: el.getBoundingClientRect() }));
  for (let i = 0; i < boites.length; i++) {
    for (let j = i + 1; j < boites.length; j++) {
      const A = boites[i];
      const B = boites[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      // Un libellé associé à son champ n'est pas un chevauchement
      const lab = (A.el.tagName === 'LABEL' ? A.el : B.el.tagName === 'LABEL' ? B.el : null) as HTMLLabelElement | null;
      if (lab && lab.control && (lab.control === A.el || lab.control === B.el)) continue;
      // Éléments en position fixe (en-tête, bouton flottant) : comparer seulement entre eux
      const fixeA = !!A.el.closest('header, [class*="fixed"], [class*="sticky"]');
      const fixeB = !!B.el.closest('header, [class*="fixed"], [class*="sticky"]');
      if (fixeA !== fixeB) continue;
      const l = Math.max(A.r.left, B.r.left);
      const r = Math.min(A.r.right, B.r.right);
      const t = Math.max(A.r.top, B.r.top);
      const b = Math.min(A.r.bottom, B.r.bottom);
      const w = r - l;
      const h = b - t;
      if (w <= 3 || h <= 3) continue; // simple contact entre bordures
      const petite = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
      const recouvrement = (w * h) / petite;
      if (recouvrement < 0.05) continue;
      chevauchements.push({
        a: selecteur(A.el),
        b: selecteur(B.el),
        texteA: texte(A.el),
        texteB: texte(B.el),
        recouvrement,
        champ: estChamp(A.el) || estChamp(B.el),
      });
      if (chevauchements.length >= 30) break;
    }
  }

  // 3. Zones cliquables trop petites (mobile)
  const petitesCibles: Mesures['petitesCibles'] = [];
  if (mobile) {
    const vus = new Set<string>();
    const cibles = Array.from(
      document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=option]'),
    ).filter(visible);
    for (const el of cibles) {
      let r = el.getBoundingClientRect();
      // Une case à cocher dans un libellé cliquable : mesurer le libellé
      const lab = el.closest('label');
      if (lab && (el as HTMLInputElement).type !== 'text') r = lab.getBoundingClientRect();
      if (r.width >= 44 && r.height >= 44) continue;
      // Lien au milieu d'un paragraphe : exception WCAG 2.5.8 (cible en ligne)
      if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement?.tagName === 'P') continue;
      const sel = selecteur(el);
      if (vus.has(sel)) continue;
      vus.add(sel);
      petitesCibles.push({ selecteur: sel, texte: texte(el), largeur: Math.round(r.width), hauteur: Math.round(r.height) });
    }
  }

  // 4. Textes tronqués ou masqués
  const tronques: Mesures['tronques'] = [];
  const feuilles = Array.from(document.body.querySelectorAll('p, span, a, button, label, h1, h2, h3, h4, td, th, li, div')).filter(
    (el) => visible(el) && Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim()),
  );
  for (const el of feuilles) {
    const s = getComputedStyle(el);
    const coupeX = el.scrollWidth > el.clientWidth + 1 && (s.overflowX !== 'visible' || s.textOverflow === 'ellipsis');
    const coupeY = el.scrollHeight > el.clientHeight + 2 && s.overflowY === 'hidden' && el.clientHeight > 0;
    const masque = (el.tagName === 'BUTTON' || el.tagName === 'LABEL') && !auPremierPlan(el);
    if (coupeX || coupeY || masque) {
      tronques.push({ selecteur: selecteur(el), texte: texte(el) + (masque ? ' (recouvert par un autre élément)' : '') });
      if (tronques.length >= 20) break;
    }
  }

  return { largeurPage, largeurEcran, debordants, chevauchements, petitesCibles, tronques };
}
