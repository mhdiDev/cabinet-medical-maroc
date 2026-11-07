import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Prisma } from '@prisma/client';
import { MODELES_CLOISONNES } from './client-filtre';

const RACINE = join(__dirname, '..');

const AUTORISES = [
  'auth/auth.service.ts',
  'auth/auth.service.spec.ts',
  'auth/strategies/jwt.strategy.ts',
  'plateforme/plateforme.service.ts',
  'prisma/prisma.module.ts',
  'prisma/prisma.service.ts',
  'prisma/prisma-sans-filtre.spec.ts',
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

describe('garde-fous du cloisonnement', () => {
  it("PrismaSansFiltre n'est utilisé que dans les fichiers autorisés", () => {
    const utilisateurs = fichiers(RACINE)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => readFileSync(f, 'utf8').includes('PrismaSansFiltre'))
      .map((f) => relative(RACINE, f))
      .sort();
    expect(utilisateurs).toEqual([...AUTORISES].sort());
  });

  it("plateforme.service.ts n'atteint que les cabinets, comptes, sessions et audit", () => {
    const source = readFileSync(join(RACINE, 'plateforme/plateforme.service.ts'), 'utf8');
    const acces = [...source.matchAll(/\b(?:prismaSansFiltre|tx)\.(\$?\w+)/g)].map((m) => m[1]);
    const permis = new Set(['cabinet', 'user', 'auditLog', 'refreshToken', '$transaction']);
    expect(acces.filter((a) => !permis.has(a))).toEqual([]);
    expect(acces.length).toBeGreaterThan(0);
  });

  it('plateforme.service.ts ne cite aucune relation vers les données des patients', () => {
    const source = readFileSync(join(RACINE, 'plateforme/plateforme.service.ts'), 'utf8');
    const relations =
      /\b(patients|rendezVous|consultations|ordonnances|paiements|stockArticles|stockMouvements|documents|notifications|parametres)\s*:/;
    expect(source).not.toMatch(relations);
  });

  it('tout modèle ayant un cabinetId est cloisonné', () => {
    const modeles = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.name === 'cabinetId'))
      .map((m) => m.name)
      .sort();
    expect(modeles).toEqual([...MODELES_CLOISONNES].sort());
  });

  it('aucun client Prisma ne se crée hors de src/prisma', () => {
    const fautifs = fichiers(RACINE)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => relative(RACINE, f))
      .filter((f) => !f.startsWith('prisma/'))
      .filter((f) => /new PrismaClient|extends PrismaClient/.test(readFileSync(join(RACINE, f), 'utf8')));
    expect(fautifs).toEqual([]);
  });

  it("auth.service.ts n'utilise les accès sans filtre que dans les méthodes prévues", () => {
    const source = readFileSync(join(RACINE, 'auth/auth.service.ts'), 'utf8');
    // Découpe le fichier par méthode de la classe (déclarations indentées de deux espaces)
    const debuts = [...source.matchAll(/^ {2}(?:private |public )?(?:async )?(\w+)\(/gm)];
    const parMethode: Record<string, string[]> = {};
    const blocs = [
      { nom: '(hors méthode)', texte: source.slice(0, debuts[0]?.index ?? source.length) },
      ...debuts.map((d, i) => ({
        nom: d[1],
        texte: source.slice(d.index, debuts[i + 1]?.index ?? source.length),
      })),
    ];
    for (const { nom, texte } of blocs) {
      // Toute mention compte, pas seulement les appels : un alias (const db = this.prismaSansFiltre) aussi
      const mentions = [...texte.matchAll(/prismaSansFiltre\b(?:\.(\$?\w+(?:\.\w+)?))?/g)].map(
        (m) => m[1] ?? '(mention)',
      );
      if (mentions.length) parMethode[nom] = mentions;
    }
    expect(parMethode).toEqual({
      constructor: ['(mention)'], // private prismaSansFiltre: PrismaSansFiltre
      validateUser: ['user.findUnique'], // le cabinet n'est pas connu à la connexion
      createUser: ['user.findUnique'], // l'email est unique sur toute la plateforme
      // un SUPER_ADMIN n'a pas de cabinet
      changePassword: ['user.findUnique', '$transaction', 'user.update', 'refreshToken.deleteMany'],
    });
  });

  it("prisma.service.ts n'exporte aucun alias de PrismaSansFiltre", () => {
    const source = readFileSync(join(RACINE, 'prisma/prisma.service.ts'), 'utf8');
    expect(source).not.toMatch(/export\s*\{[^}]*PrismaSansFiltre\s+as\b/);
    expect(source).not.toMatch(/export\s+(const|type)\s+\w+\s*=\s*PrismaSansFiltre/);
  });
});
