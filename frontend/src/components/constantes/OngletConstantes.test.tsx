// frontend/src/components/constantes/OngletConstantes.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OngletConstantes } from './OngletConstantes';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn(), delete: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
// Recharts ne se dessine pas dans jsdom : la courbe a ses propres tests (affichage.test.ts)
jest.mock('./CourbeConstantes', () => ({ CourbeConstantes: () => <div>courbe</div> }));
const get = apiClient.get as jest.Mock;

const maintenant = new Date().toISOString();
const prises = [
  {
    id: 'k2',
    patientId: 'p1',
    consultationId: null,
    datePrise: maintenant,
    createdAt: maintenant,
    priseParId: 'sec-1',
    prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
    consultation: null,
    temperature: 39.5,
    imc: null,
    alertes: [{ cle: 'temperature', sens: 'elevee', niveau: 'attention', etat: 'élevée', texte: 'température 39,5 °C élevée' }],
  },
  {
    id: 'k1',
    patientId: 'p1',
    consultationId: 'c1',
    datePrise: '2026-01-01T09:00:00.000Z',
    createdAt: '2026-01-01T09:00:00.000Z',
    priseParId: 'dr-1',
    prisePar: { id: 'dr-1', prenom: 'Hassan', nom: 'Benali', role: 'MEDECIN' },
    consultation: { id: 'c1', dateConsultation: '2026-01-01T09:00:00.000Z' },
    poids: 72,
    imc: null,
    alertes: [],
  },
];

function afficher(role: 'MEDECIN' | 'SECRETAIRE', id = 'sec-1') {
  useAuthStore.setState({ user: { id, email: 'x@cabinet.ma', nom: 'X', prenom: 'Y', role } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OngletConstantes patient={{ id: 'p1', dateNaissance: '1980-01-01' }} />
    </QueryClientProvider>,
  );
}

beforeEach(() => get.mockReset());

describe('OngletConstantes', () => {
  it('aucune prise : message', async () => {
    get.mockResolvedValue({ data: [] });
    afficher('MEDECIN', 'dr-1');
    expect(await screen.findByText(/Aucune constante enregistrée/)).toBeInTheDocument();
  });

  it('dernières valeurs, pastille et historique', async () => {
    get.mockResolvedValue({ data: prises });
    afficher('MEDECIN', 'dr-1');
    expect(await screen.findByText('39,5 °C')).toBeInTheDocument();
    expect(screen.getByText('72 kg')).toBeInTheDocument();
    expect(screen.getAllByText('élevée').length).toBeGreaterThan(0);
    expect(screen.getByText(/prise par Fatima Alaoui \(secrétaire\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'consultation' })).toHaveAttribute('href', '/consultations/c1');
    expect(get).toHaveBeenCalledWith('/constantes/patient/p1');
  });

  it('la secrétaire ne modifie que sa prise du jour', async () => {
    get.mockResolvedValue({ data: prises });
    afficher('SECRETAIRE', 'sec-1');
    await screen.findByText('39,5 °C');
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Supprimer' })).toHaveLength(1);
  });
});
