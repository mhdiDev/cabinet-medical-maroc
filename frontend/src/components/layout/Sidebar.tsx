'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

const nav = [
  { href: '/dashboard', icon: '🏠', label: 'Tableau de bord', roles: ['ADMIN', 'MEDECIN', 'SECRETAIRE'] },
  { href: '/agenda', icon: '📅', label: 'Agenda', roles: ['ADMIN', 'MEDECIN', 'SECRETAIRE'] },
  { href: '/patients', icon: '👥', label: 'Patients', roles: ['ADMIN', 'MEDECIN', 'SECRETAIRE'] },
  { href: '/consultations', icon: '🩺', label: 'Consultations', roles: ['ADMIN', 'MEDECIN'] },
  { href: '/ordonnances', icon: '💊', label: 'Ordonnances', roles: ['ADMIN', 'MEDECIN'] },
  { href: '/paiements', icon: '💰', label: 'Caisse', roles: ['ADMIN', 'SECRETAIRE'] },
  { href: '/stock', icon: '📦', label: 'Stock', roles: ['ADMIN', 'SECRETAIRE'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  const items = nav.filter(n => !user?.role || n.roles.includes(user.role));

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm">
      <div className="p-6 border-b border-gray-100">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mb-2">
          <span className="text-white text-lg">⚕</span>
        </div>
        <p className="font-bold text-gray-900 text-sm">Cabinet Médical</p>
        <p className="text-xs text-gray-400">Système de gestion</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {items.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold text-gray-600">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-gray-400">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
