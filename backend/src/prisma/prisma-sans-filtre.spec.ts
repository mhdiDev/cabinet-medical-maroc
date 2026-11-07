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
});
