'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import { libelleRole, nomAffiche } from '@/lib/utilisateur';
import { IconeCalendrier, IconeMenu, IconeRecherche } from '@/components/ui/icons';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
  menuOuvert: boolean;
}

export function Header({ onMenuClick, menuOuvert }: HeaderProps) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [recherche, setRecherche] = useState('');
  const estSuperAdmin = user?.role === 'SUPER_ADMIN';
  // La recherche mène à la liste des patients : pas pour le Super Admin ni pendant un changement forcé.
  // Sur l'accueil, la recherche patient de la page (avec résultats immédiats) la remplace.
  const avecRecherche = !estSuperAdmin && !user?.doitChangerMdp && pathname !== '/dashboard';

  const maintenant = new Date();
  const dateLongue = maintenant.toLocaleDateString('fr-MA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const dateCourte = maintenant.toLocaleDateString('fr-MA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  const logout = async () => {
    try { await apiClient.post('/auth/logout'); } catch {}
    clearAuth();
    router.push('/login');
  };

  const rechercher = (e: React.FormEvent) => {
    e.preventDefault();
    const q = recherche.trim();
    router.push(q ? `/patients?q=${encodeURIComponent(q)}` : '/patients');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 z-10 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          aria-controls="menu-principal"
          aria-expanded={menuOuvert}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <IconeMenu className="w-6 h-6" strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 font-medium min-w-0">
          <IconeCalendrier className="w-4 h-4 text-slate-400 flex-shrink-0" strokeWidth={2} />
          <span className="truncate hidden sm:inline first-letter:uppercase">{dateLongue}</span>
          <span className="truncate sm:hidden">{dateCourte}</span>
        </div>
      </div>

      {avecRecherche && (
        <form onSubmit={rechercher} role="search" className="hidden sm:block w-56 md:w-72 lg:w-96 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <IconeRecherche className="h-4 w-4 text-slate-400" strokeWidth={2} />
          </div>
          <input
            type="search"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher un patient (nom, téléphone)…"
            aria-label="Rechercher un patient"
            className="w-full text-xs pl-9 pr-3 sm:pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
          />
        </form>
      )}

      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {/* Les notifications concernent un cabinet : le SUPER_ADMIN n'en a pas */}
        {!estSuperAdmin && <NotificationBell />}
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-900 leading-tight">{nomAffiche(user)}</div>
            <span className="text-[11px] font-semibold text-primary-600">{libelleRole(user?.role)}</span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-slate-500 hover:text-rose-600 font-medium pl-2 hover:underline transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </div>
    </header>
  );
}
