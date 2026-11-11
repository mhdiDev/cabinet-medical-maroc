'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import { initiales, libelleRole, nomAffiche } from '@/lib/utilisateur';
import {
  IconeCabinets,
  IconeCaisse,
  IconeCalendrier,
  IconeConsultations,
  IconeDeconnexion,
  IconeFermer,
  IconePatients,
  IconePlus,
  IconeReglages,
  IconeStock,
  IconeTableauDeBord,
  IconeUtilisateurs,
} from '@/components/ui/icons';

interface EntreeNav {
  href: string;
  icone: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  roles: string[];
  // Entrée aussi visible par le médecin titulaire
  titulaire?: boolean;
}

const nav: EntreeNav[] = [
  { href: '/cabinets', icone: IconeCabinets, label: 'Cabinets', roles: ['SUPER_ADMIN'] },
  { href: '/dashboard', icone: IconeTableauDeBord, label: 'Tableau de bord', roles: ['MEDECIN', 'SECRETAIRE'] },
  { href: '/agenda', icone: IconeCalendrier, label: 'Agenda', roles: ['MEDECIN', 'SECRETAIRE'] },
  { href: '/patients', icone: IconePatients, label: 'Patients', roles: ['MEDECIN', 'SECRETAIRE'] },
  { href: '/consultations', icone: IconeConsultations, label: 'Consultations', roles: ['MEDECIN'] },
  { href: '/paiements', icone: IconeCaisse, label: 'Caisse', roles: ['SECRETAIRE'], titulaire: true },
  { href: '/stock', icone: IconeStock, label: 'Stock', roles: ['SECRETAIRE'], titulaire: true },
  { href: '/utilisateurs', icone: IconeUtilisateurs, label: 'Utilisateurs', roles: [], titulaire: true },
  { href: '/mon-compte', icone: IconeReglages, label: 'Mon compte', roles: ['MEDECIN', 'SECRETAIRE', 'SUPER_ADMIN'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const items = user?.doitChangerMdp
    ? nav.filter(n => n.href === '/mon-compte')
    : nav.filter(n =>
        !user?.role || n.roles.includes(user.role) || (n.titulaire && user.estTitulaire),
      );

  // Pastille du menu Stock : seulement pour ceux qui voient ce menu
  const voitStock = items.some(n => n.href === '/stock');
  const { data: alertesStock = [] } = useQuery<unknown[]>({
    queryKey: ['stock', 'alertes'],
    queryFn: () => apiClient.get('/stock/articles/alertes').then(r => r.data),
    enabled: voitStock,
    refetchInterval: 60_000,
  });

  const logout = async () => {
    try { await apiClient.post('/auth/logout'); } catch {}
    clearAuth();
    router.push('/login');
  };

  return (
    <aside
      id="menu-principal"
      className={`
        fixed inset-y-0 left-0 z-40 w-60 max-w-[75vw] lg:w-64 lg:max-w-none flex-shrink-0
        bg-white border-r border-slate-200 flex flex-col justify-between select-none
        shadow-xl lg:shadow-none transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:static lg:translate-x-0
      `}
    >
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Logo + bouton de fermeture (mobile) */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-sm shadow-blue-300 flex-shrink-0">
              <IconePlus className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.2} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base leading-tight truncate">
                Cabinet Médical
              </span>
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium leading-tight truncate">
                Système de gestion
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <IconeFermer className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>

        <nav aria-label="Menu principal" className="px-2.5 sm:px-3 py-3 sm:py-4 space-y-1 flex-1">
          {items.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icone = item.icone;
            const badge = item.href === '/stock' && alertesStock.length > 0 ? alertesStock.length : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center justify-between gap-2.5 sm:gap-3 px-3 py-2 sm:py-2.5 text-xs sm:text-sm rounded-lg transition-colors group ${
                  active
                    ? 'bg-blue-50/80 text-primary-700 font-semibold'
                    : 'font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary-600 rounded-r-md" />}
                <span className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <Icone
                    className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${
                      active ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {badge !== null && (
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-amber-100 text-amber-800"
                    title={`${badge} article(s) sous le seuil d'alerte`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Profil */}
      <div className="p-2.5 sm:p-3 border-t border-slate-200">
        <div className="flex items-center gap-2.5 sm:gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100">
          <Link
            href="/mon-compte"
            onClick={onClose}
            className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold text-xs tracking-wider border border-white shadow-sm flex-shrink-0">
              {initiales(user?.prenom, user?.nom)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{nomAffiche(user)}</p>
              <span className="inline-flex items-center mt-0.5 px-1.5 rounded text-[10px] font-semibold bg-primary-100 text-primary-700">
                {libelleRole(user?.role)}
              </span>
            </div>
          </Link>
          <button
            onClick={logout}
            title="Déconnexion"
            aria-label="Déconnexion"
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/60 transition-colors flex-shrink-0"
          >
            <IconeDeconnexion className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
