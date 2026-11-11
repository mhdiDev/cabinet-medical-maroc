// frontend/src/lib/constantes/api.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { jourCabinet } from '@/lib/fuseau';
import type { AlerteConstante, ChampMesure } from './seuils';

/** Une prise de constantes telle que renvoyée par l'API (IMC et alertes calculés par le serveur) */
export type Prise = Partial<Record<ChampMesure, number | null>> & {
  id: string;
  patientId: string;
  consultationId: string | null;
  datePrise: string;
  createdAt: string;
  priseParId: string;
  prisePar: { id: string; prenom: string; nom: string; role: string };
  consultation: { id: string; dateConsultation: string } | null;
  imc: number | null;
  alertes: AlerteConstante[];
};

export const cleConstantes = (patientId: string) => ['constantes', patientId];

/** Prises du patient, de la plus récente à la plus ancienne */
export function useConstantes(patientId: string) {
  return useQuery({
    queryKey: cleConstantes(patientId),
    queryFn: () => apiClient.get(`/constantes/patient/${patientId}`).then((r) => r.data as Prise[]),
  });
}

/** Dernière taille mesurée (liste de la plus récente à la plus ancienne) */
export function derniereTaille(prises: Prise[] = []): number | null {
  return prises.find((p) => p.taille !== null && p.taille !== undefined)?.taille ?? null;
}

/** Même règle que le serveur : un médecin, ou l'auteur le jour même (heure du cabinet) */
export function peutModifier(
  prise: Pick<Prise, 'priseParId' | 'createdAt'>,
  user: { id: string; role: string } | null,
  maintenant: Date = new Date(),
): boolean {
  if (!user) return false;
  if (user.role === 'MEDECIN') return true;
  return prise.priseParId === user.id && jourCabinet(prise.createdAt) === jourCabinet(maintenant);
}

export const LIBELLE_ROLE: Record<string, string> = { MEDECIN: 'médecin', SECRETAIRE: 'secrétaire' };
