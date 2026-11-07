import { PrismaClient } from '@prisma/client';
import { cabinetCourant } from './contexte-cabinet';

export const MODELES_CLOISONNES = new Set<string>([
  'User',
  'Patient',
  'RendezVous',
  'Consultation',
  'Ordonnance',
  'Paiement',
  'StockArticle',
  'StockMouvement',
  'Document',
  'Notification',
  'Parametre',
  'AuditLog',
]);

type Args = Record<string, any>;

const avecWhere = (args: Args, cabinetId: string): Args => ({
  ...args,
  where: { ...args.where, cabinetId },
});

// Une modification ne déplace jamais une ligne vers un autre cabinet
const sansCabinet = (data: Args): Args => {
  const copie = { ...data };
  delete copie.cabinetId;
  return copie;
};

export function appliquerCabinet(
  operation: string,
  args: Args | undefined,
  cabinetId: string,
): Args {
  const a = args ?? {};

  switch (operation) {
    case 'findMany':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'count':
    case 'aggregate':
    case 'groupBy':
    case 'delete':
    case 'deleteMany':
      return avecWhere(a, cabinetId);
    case 'update':
    case 'updateMany':
      return { ...avecWhere(a, cabinetId), data: sansCabinet(a.data) };
    case 'create':
      return { ...a, data: { ...a.data, cabinetId } };
    case 'createMany': {
      const lignes = Array.isArray(a.data) ? a.data : [a.data];
      return { ...a, data: lignes.map((ligne: Args) => ({ ...ligne, cabinetId })) };
    }
    case 'upsert':
      return {
        ...avecWhere(a, cabinetId),
        create: { ...a.create, cabinetId },
        update: sansCabinet(a.update),
      };
    default:
      // Une opération inconnue ne doit pas passer sans filtre
      throw new Error(`Opération Prisma non gérée sur un modèle cloisonné : ${operation}`);
  }
}

export function creerClientFiltre(base: PrismaClient) {
  return base.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!MODELES_CLOISONNES.has(model)) return query(args);
          return query(appliquerCabinet(operation, args, cabinetCourant()) as typeof args);
        },
      },
    },
  });
}
