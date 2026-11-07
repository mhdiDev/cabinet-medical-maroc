import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { Prisma } from '@prisma/client';
import { MODELES_CLOISONNES } from './client-filtre';

const RACINE = join(__dirname, '..');

const AUTORISES = [
  'auth/auth.service.ts',
  'auth/auth.service.spec.ts',
  'auth/strategies/jwt.strategy.ts',
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

  it("auth.service.ts n'utilise que prismaSansFiltre.user.findUnique", () => {
    const source = readFileSync(join(RACINE, 'auth/auth.service.ts'), 'utf8');
    const autres = source.match(/prismaSansFiltre\.(?!user\.findUnique\b)\S*/g) ?? [];
    expect(autres).toEqual([]);
  });

  it("prisma.service.ts n'exporte aucun alias de PrismaSansFiltre", () => {
    const source = readFileSync(join(RACINE, 'prisma/prisma.service.ts'), 'utf8');
    expect(source).not.toMatch(/export\s*\{[^}]*PrismaSansFiltre\s+as\b/);
    expect(source).not.toMatch(/export\s+(const|type)\s+\w+\s*=\s*PrismaSansFiltre/);
  });
});
