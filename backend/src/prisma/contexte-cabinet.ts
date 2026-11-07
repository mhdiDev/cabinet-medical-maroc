import { ForbiddenException } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

const stockage = new AsyncLocalStorage<{ cabinetId: string | null }>();

// Ouvert par le middleware, avant l'authentification
export function ouvrirContexte<T>(suite: () => T): T {
  return stockage.run({ cabinetId: null }, suite);
}

// Appelé par JwtAuthGuard : le cabinet vient toujours de la base, jamais du client
export function definirCabinet(cabinetId: string | null): void {
  const contexte = stockage.getStore();
  if (contexte) contexte.cabinetId = cabinetId;
}

// Refus par défaut : sans cabinet connu, aucune donnée cloisonnée n'est accessible
export function cabinetCourant(): string {
  const cabinetId = stockage.getStore()?.cabinetId;
  if (!cabinetId) throw new ForbiddenException('Aucun cabinet associé à cette requête');
  return cabinetId;
}
