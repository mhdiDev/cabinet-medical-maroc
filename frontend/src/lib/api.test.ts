import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { api, apiClient } from './api';
import { useAuthStore } from '@/store/auth';

// Serveur simulé : un jeton d'accès valide à la fois, une clé de renouvellement à usage unique
let jetonValide: string;
let cleValide: string | null;
let renouvellements: number;

const reponse = (config: InternalAxiosRequestConfig, status: number, data: unknown) => {
  if (status >= 400) {
    return Promise.reject({ config, response: { status, data }, isAxiosError: true });
  }
  return Promise.resolve({ data, status, statusText: 'OK', headers: {}, config });
};

const serveurApi: AxiosAdapter = async (config) => {
  const jeton = String(config.headers?.Authorization ?? '').replace('Bearer ', '');
  if (jeton !== jetonValide) return reponse(config, 401, { message: 'Unauthorized' });
  return reponse(config, 200, { url: config.url });
};

const serveurRefresh: AxiosAdapter = async (config) => {
  const { refreshToken } = JSON.parse(config.data);
  // Le vrai serveur répond plus tard : laisse le temps aux autres requêtes d'échouer aussi
  await new Promise((r) => setTimeout(r, 10));
  if (refreshToken !== cleValide) return reponse(config, 401, { message: 'invalide' });
  renouvellements++;
  jetonValide = `acces-${renouvellements}`;
  cleValide = `cle-${renouvellements}`;
  return reponse(config, 200, { accessToken: jetonValide, refreshToken: cleValide });
};

const versConnexion = jest.fn();

beforeAll(() => {
  apiClient.defaults.adapter = serveurApi;
  api.defaults.adapter = serveurRefresh;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      pathname: '/dashboard',
      set href(url: string) {
        versConnexion(url);
      },
    },
  });
});

beforeEach(() => {
  renouvellements = 0;
  jetonValide = 'acces-0';
  cleValide = 'cle-0';
  versConnexion.mockReset();
  useAuthStore.setState({ token: 'acces-perime', refreshToken: 'cle-0' });
});

describe('renouvellement de la connexion', () => {
  it('plusieurs requêtes refusées en même temps : un seul renouvellement, toutes repartent', async () => {
    const resultats = await Promise.all(
      ['/rapports/dashboard', '/rendez-vous/today', '/stock/articles/alertes', '/notifications'].map((url) =>
        apiClient.get(url),
      ),
    );
    expect(resultats.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(renouvellements).toBe(1);
    expect(versConnexion).not.toHaveBeenCalled();
  });

  it('garde la nouvelle clé de renouvellement : le renouvellement suivant réussit aussi', async () => {
    await apiClient.get('/rapports/dashboard');
    expect(useAuthStore.getState()).toMatchObject({ token: 'acces-1', refreshToken: 'cle-1' });

    // 15 minutes plus tard, le jeton d'accès expire à nouveau
    jetonValide = 'acces-serveur-suivant';
    cleValide = 'cle-1';
    renouvellements = 1;
    const res = await apiClient.get('/rapports/dashboard');
    expect(res.status).toBe(200);
    expect(useAuthStore.getState()).toMatchObject({ token: 'acces-2', refreshToken: 'cle-2' });
    expect(versConnexion).not.toHaveBeenCalled();
  });

  it('clé de renouvellement refusée : retour à la connexion', async () => {
    cleValide = null;
    await expect(apiClient.get('/rapports/dashboard')).rejects.toBeTruthy();
    expect(versConnexion).toHaveBeenCalledWith('/login');
    expect(useAuthStore.getState().token).toBeNull();
  });
});
