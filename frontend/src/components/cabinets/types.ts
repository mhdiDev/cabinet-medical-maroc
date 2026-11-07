export interface Cabinet {
  id: string;
  nom: string;
  adresse: string;
  ville: string;
  telephone: string;
  actif: boolean;
  createdAt: string;
  nbUtilisateurs: number;
  titulaire: { id: string; prenom: string; nom: string; email: string } | null;
}

export const TELEPHONE = /^0[5-7][0-9]{8}$/;
