export interface Patient {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: 'MASCULIN' | 'FEMININ';
  cin?: string;
  telephone: string;
  email?: string;
  adresse?: string;
  ville?: string;
  groupeSanguin?: string;
  allergies: string[];
  antecedents?: string;
  numeroAssurance?: string;
}

export interface RendezVous {
  id: string;
  patientId: string;
  medecinId: string;
  dateHeure: string;
  dureeMinutes: number;
  statut: 'EN_ATTENTE' | 'CONFIRME' | 'ARRIVE' | 'FACTURE' | 'ANNULE';
  motif?: string;
  patient?: Patient;
}

export interface Consultation {
  id: string;
  patientId: string;
  medecinId: string;
  dateConsultation: string;
  motif?: string;
  diagnostic?: string;
  traitement?: string;
  notes?: string;
}

export interface Paiement {
  id: string;
  montant: number;
  montantRemise: number;
  typePaiement: 'ESPECE' | 'CARTE' | 'CHEQUE' | 'ASSURANCE';
  dateHeure: string;
}
