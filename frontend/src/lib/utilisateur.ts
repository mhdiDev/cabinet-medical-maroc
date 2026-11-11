import type { User } from '@/store/auth';

// Nom affiché partout (sidebar, barre du haut, salutation) : « Dr » pour un médecin
export function nomAffiche(user: Pick<User, 'prenom' | 'nom' | 'role'> | null | undefined): string {
  if (!user) return '';
  const nom = `${user.prenom ?? ''} ${user.nom ?? ''}`.trim();
  return user.role === 'MEDECIN' ? `Dr ${nom}` : nom;
}

export function libelleRole(role: User['role'] | undefined): string {
  switch (role) {
    case 'MEDECIN':
      return 'Médecin';
    case 'SECRETAIRE':
      return 'Secrétaire';
    case 'SUPER_ADMIN':
      return 'Super Admin';
    default:
      return '';
  }
}

export function initiales(prenom?: string | null, nom?: string | null): string {
  return `${prenom?.trim()?.[0] ?? ''}${nom?.trim()?.[0] ?? ''}`.toUpperCase();
}
