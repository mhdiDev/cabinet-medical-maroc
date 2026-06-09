'use client';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();

  const logout = async () => {
    try { await apiClient.post('/auth/logout'); } catch {}
    clearAuth();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition"
          aria-label="Menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-gray-500 text-sm hidden sm:block">
          {new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <span className="text-sm text-gray-600">
          {user?.prenom} {user?.nom} — <span className="text-blue-600">{user?.role}</span>
        </span>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-red-600 transition">
          Déconnexion
        </button>
      </div>
    </header>
  );
}
