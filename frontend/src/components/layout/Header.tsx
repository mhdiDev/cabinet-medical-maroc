'use client';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export function Header() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();

  const logout = async () => {
    try { await apiClient.post('/auth/logout'); } catch {}
    clearAuth();
    router.push('/login');
  };

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <h2 className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h2>
      </div>
      <div className="flex items-center gap-4">
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
