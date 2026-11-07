export type Role = 'MEDECIN' | 'SECRETAIRE';

export const ROLES: Role[] = ['MEDECIN', 'SECRETAIRE'];

export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  estTitulaire: boolean;
  actif: boolean;
  doitChangerMdp: boolean;
}
