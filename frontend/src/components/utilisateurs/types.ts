export type Role = 'ADMIN' | 'MEDECIN' | 'SECRETAIRE';

export const ROLES: Role[] = ['ADMIN', 'MEDECIN', 'SECRETAIRE'];

export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  actif: boolean;
  doitChangerMdp: boolean;
}
