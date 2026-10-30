'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, user, _hasHydrated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mdpAChanger = !!user?.doitChangerMdp && pathname !== '/mon-compte';

  useEffect(() => {
    // Attendre la fin de la réhydratation avant de juger l'état d'auth
    if (_hasHydrated && !token) router.push('/login');
  }, [_hasHydrated, token, router]);

  useEffect(() => {
    // Mot de passe réinitialisé par l'admin : seule la page Mon compte est accessible
    if (_hasHydrated && token && mdpAChanger) router.replace('/mon-compte');
  }, [_hasHydrated, token, mdpAChanger, router]);

  // Pendant la réhydratation : écran de chargement neutre (évite le flash de redirection)
  if (!_hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!token || mdpAChanger) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Overlay mobile — ferme la sidebar en cliquant dehors */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
