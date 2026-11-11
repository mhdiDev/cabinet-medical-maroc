'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, user, _hasHydrated, setUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mdpAChanger = !!user?.doitChangerMdp && pathname !== '/mon-compte';
  // Le SUPER_ADMIN n'a accès qu'à la liste des cabinets et à son compte
  const pagePlateforme = pathname === '/cabinets' || pathname === '/mon-compte';
  const horsEspacePlateforme = user?.role === 'SUPER_ADMIN' && !pagePlateforme && !mdpAChanger;

  // Menu mobile : se ferme au changement de page et avec Échap
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [sidebarOpen]);

  useEffect(() => {
    // Attendre la fin de la réhydratation avant de juger l'état d'auth
    if (_hasHydrated && !token) router.push('/login');
  }, [_hasHydrated, token, router]);

  useEffect(() => {
    // Une session ouverte avant une mise à jour peut garder un rôle périmé en local
    if (!_hasHydrated || !token) return;
    apiClient
      .get('/auth/me')
      .then(({ data }) =>
        setUser({
          id: data.id,
          email: data.email,
          nom: data.nom,
          prenom: data.prenom,
          role: data.role,
          cabinetId: data.cabinetId,
          estTitulaire: data.estTitulaire,
          doitChangerMdp: data.doitChangerMdp,
        }),
      )
      .catch(() => {
        // L'intercepteur axios gère déjà la session expirée
      });
  }, [_hasHydrated, token, setUser]);

  useEffect(() => {
    // Mot de passe réinitialisé par l'admin : seule la page Mon compte est accessible
    if (_hasHydrated && token && mdpAChanger) router.replace('/mon-compte');
  }, [_hasHydrated, token, mdpAChanger, router]);

  useEffect(() => {
    if (_hasHydrated && token && horsEspacePlateforme) router.replace('/cabinets');
  }, [_hasHydrated, token, horsEspacePlateforme, router]);

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

  if (!token || mdpAChanger || horsEspacePlateforme) return null;

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50 text-slate-800 antialiased">
      {/* Fond du menu mobile : un clic dehors ferme le menu */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Header menuOuvert={sidebarOpen} onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
