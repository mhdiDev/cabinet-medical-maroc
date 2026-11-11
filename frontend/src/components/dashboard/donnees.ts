// Données et règles du tableau de bord (sans React, testées dans donnees.test.ts)
import { FUSEAU_CABINET, heureCabinet } from '@/lib/fuseau';

export type StatutRdv = 'EN_ATTENTE' | 'CONFIRME' | 'ARRIVE' | 'FACTURE' | 'ANNULE';

export interface RdvDuJour {
  id: string;
  dateHeure: string;
  dureeMinutes: number;
  statut: StatutRdv;
  motif?: string | null;
  patient: {
    id: string;
    nom: string;
    prenom: string;
    telephone: string;
    dateNaissance?: string | null;
    sexe?: 'MASCULIN' | 'FEMININ' | null;
  };
  medecin?: { id: string; nom: string; prenom: string } | null;
}

export interface StatsDashboard {
  totalPatients: number;
  rdvAujourdhui: number;
  rdvSemaine: number;
  // Lundi (0) → dimanche (6), semaine en cours, heure du cabinet
  rdvParJour: number[];
  // Lundi de la semaine, AAAA-MM-JJ
  semaineDebut: string;
  recetteJour: number;
  stockAlertes: number;
}

// Statuts réels de l'API (enum StatutRDV), dans l'ordre du parcours patient
export const STATUTS: { valeur: StatutRdv; libelle: string; badge: string; point: string }[] = [
  { valeur: 'EN_ATTENTE', libelle: 'En attente', badge: 'bg-amber-50 text-amber-700 border-amber-200', point: 'bg-amber-500' },
  { valeur: 'CONFIRME', libelle: 'Confirmé', badge: 'bg-blue-50 text-blue-700 border-blue-200', point: 'bg-blue-500' },
  { valeur: 'ARRIVE', libelle: 'Arrivé', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', point: 'bg-emerald-500' },
  { valeur: 'FACTURE', libelle: 'Facturé', badge: 'bg-violet-50 text-violet-700 border-violet-200', point: 'bg-violet-500' },
  { valeur: 'ANNULE', libelle: 'Annulé', badge: 'bg-rose-50 text-rose-700 border-rose-200', point: 'bg-rose-500' },
];

export function infoStatut(statut: string) {
  return (
    STATUTS.find(s => s.valeur === statut) ?? {
      valeur: statut as StatutRdv,
      libelle: statut,
      badge: 'bg-slate-50 text-slate-600 border-slate-200',
      point: 'bg-slate-400',
    }
  );
}

// Étape suivante proposée (même parcours que l'agenda)
export function statutSuivant(statut: StatutRdv): { statut: StatutRdv; libelle: string } | null {
  switch (statut) {
    case 'EN_ATTENTE':
      return { statut: 'CONFIRME', libelle: 'Confirmer' };
    case 'CONFIRME':
      return { statut: 'ARRIVE', libelle: 'Marquer arrivé' };
    case 'ARRIVE':
      return { statut: 'FACTURE', libelle: 'Marquer facturé' };
    default:
      return null;
  }
}

/**
 * Prochain patient : d'abord un patient déjà arrivé (salle d'attente), le plus ancien RDV en premier ;
 * sinon le prochain RDV en attente ou confirmé dont le créneau n'est pas terminé.
 */
export function choisirProchainPatient(rdvs: RdvDuJour[], maintenant: Date = new Date()): RdvDuJour | null {
  const tries = [...rdvs].sort((a, b) => +new Date(a.dateHeure) - +new Date(b.dateHeure));
  const arrive = tries.find(r => r.statut === 'ARRIVE');
  if (arrive) return arrive;
  return (
    tries.find(r => {
      if (r.statut !== 'EN_ATTENTE' && r.statut !== 'CONFIRME') return false;
      const finCreneau = +new Date(r.dateHeure) + (r.dureeMinutes || 30) * 60_000;
      return finCreneau >= +maintenant;
    }) ?? null
  );
}

export function age(dateNaissance: string | null | undefined, maintenant: Date = new Date()): number | null {
  if (!dateNaissance) return null;
  const n = new Date(dateNaissance);
  if (Number.isNaN(+n)) return null;
  let a = maintenant.getFullYear() - n.getFullYear();
  const pasEncore =
    maintenant.getMonth() < n.getMonth() ||
    (maintenant.getMonth() === n.getMonth() && maintenant.getDate() < n.getDate());
  if (pasEncore) a -= 1;
  return a >= 0 ? a : null;
}

// Heure HH:mm dans le fuseau du cabinet (comme le reste de l'application)
export const heure = heureCabinet;

// Index du jour (0 = lundi … 6 = dimanche) aujourd'hui, dans le fuseau du cabinet
export function indexAujourdhui(maintenant: Date = new Date()): number {
  const jour = new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU_CABINET, weekday: 'short' }).format(maintenant);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(jour);
}

// AAAA-MM-JJ → Date locale à midi (évite tout glissement de jour lié au fuseau du navigateur)
export function dateDepuisJour(jour: string | undefined): Date {
  const m = jour && /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : new Date();
}

export function formaterMad(montant: number): string {
  return new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 2 }).format(montant || 0);
}
