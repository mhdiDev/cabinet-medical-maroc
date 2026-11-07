import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: 'SUPER_ADMIN' | 'MEDECIN' | 'SECRETAIRE';
  cabinetId?: string | null;
  estTitulaire?: boolean;
  doitChangerMdp?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  // Vrai une fois que persist a fini de lire localStorage
  _hasHydrated: boolean;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setDoitChangerMdp: (value: boolean) => void;
  clearAuth: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      _hasHydrated: false,
      setAuth: (user, token, refreshToken) => set({ user, token, refreshToken }),
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setDoitChangerMdp: (value) =>
        set((state) => ({ user: state.user ? { ...state.user, doitChangerMdp: value } : null })),
      clearAuth: () => set({ user: null, token: null, refreshToken: null }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'cabinet-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
