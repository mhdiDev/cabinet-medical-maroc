// Champs renvoyés au frontend : l'adresse de stockage reste côté serveur
export const DOCUMENT_PUBLIC = {
  id: true,
  patientId: true,
  consultationId: true,
  nom: true,
  type: true,
  taille: true,
  createdAt: true,
} as const;
