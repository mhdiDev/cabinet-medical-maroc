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
  'Constantes',
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
  delete copie.cabinet;
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

// Le cabinet est lu à l'exécution de la requête : ne jamais partager ni mettre en
// cache une promesse Prisma entre deux requêtes.
export function creerClientFiltre(base: PrismaClient) {
  return base.$extends({
    query: {
      // Niveau client et non $allModels : le SQL brut passe ici, avec model indéfini
      $allOperations({ model, operation, args, query }) {
        if (!model) throw new Error(`SQL brut interdit sur le client filtré : ${operation}`);
        // Les services d'un cabinet ne listent jamais les cabinets : seule une relation
        // depuis une ligne déjà filtrée peut atteindre son propre cabinet
        if (model === 'Cabinet') {
          throw new Error('Accès direct aux cabinets interdit sur le client filtré');
        }
        if (!MODELES_CLOISONNES.has(model)) return query(args);
        return query(appliquerCabinet(operation, args, cabinetCourant()) as typeof args);
      },
    },
  });
}
