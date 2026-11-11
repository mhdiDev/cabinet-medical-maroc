import axios from 'axios';
import { useAuthStore } from '@/store/auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({ baseURL: BASE_URL });

// Client avec token auth automatique
export const apiClient = axios.create({ baseURL: BASE_URL });

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// La clé de renouvellement ne sert qu'une fois (le serveur la remplace) : un seul
// renouvellement à la fois, que les requêtes refusées en même temps attendent toutes
let renouvellementEnCours: Promise<string> | null = null;

function renouvelerSession(): Promise<string> {
  if (!renouvellementEnCours) {
    const refreshToken = useAuthStore.getState().refreshToken;
    renouvellementEnCours = api
      .post('/auth/refresh', { refreshToken })
      .then((res) => {
        // Garder aussi la nouvelle clé de renouvellement : l'ancienne n'existe plus
        useAuthStore.getState().setTokens(res.data.accessToken, res.data.refreshToken);
        return res.data.accessToken as string;
      })
      .finally(() => {
        renouvellementEnCours = null;
      });
  }
  return renouvellementEnCours;
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        // Requête partie avec un jeton déjà remplacé entre-temps : repartir avec le nouveau
        const envoye = String(original.headers?.Authorization ?? '').replace('Bearer ', '');
        const actuel = useAuthStore.getState().token;
        const jeton = actuel && actuel !== envoye ? actuel : await renouvelerSession();
        original.headers.Authorization = `Bearer ${jeton}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
      }
    }
    if (err.response?.status === 403 && err.response?.data?.code === 'MUST_CHANGE_PASSWORD') {
      useAuthStore.getState().setDoitChangerMdp(true);
      if (window.location.pathname !== '/mon-compte') window.location.href = '/mon-compte';
    }
    return Promise.reject(err);
  },
);
