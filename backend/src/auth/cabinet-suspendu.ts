export const CODE_CABINET_SUSPENDU = 'CABINET_SUSPENDU';

export const MESSAGE_CABINET_SUSPENDU =
  "Ce cabinet est suspendu. Contactez l'administrateur de la plateforme.";

// Un SUPER_ADMIN n'a pas de cabinet : il n'est jamais concerné
export function cabinetSuspendu(cabinet: { actif: boolean } | null | undefined): boolean {
  return !!cabinet && !cabinet.actif;
}
