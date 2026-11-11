import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NouvelleConsultationPage from './page';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

let recherche = new URLSearchParams();
const back = jest.fn();
const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, back, replace: jest.fn() }),
  useSearchParams: () => recherche,
}));
jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
const get = apiClient.get as jest.Mock;

const tazi = {
  id: 'p-tazi',
  nom: 'Tazi',
  prenom: 'Ahmed',
  dateNaissance: '1980-01-01T00:00:00.000Z',
  telephone: '0612345678',
  allergies: ['Pénicilline'],
};

function afficher(query: string) {
  recherche = new URLSearchParams(query);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NouvelleConsultationPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  useAuthStore.setState({
    user: { id: 'u1', email: 'dr@cabinet.ma', nom: 'Benali', prenom: 'Hassan', role: 'MEDECIN' },
  });
});

describe('Nouvelle consultation : patient passé dans l adresse', () => {
  it('affiche le patient comme sélectionné, avec ses allergies', async () => {
    get.mockResolvedValue({ data: tazi });
    afficher('patientId=p-tazi');
    expect(screen.getByText('Chargement du patient…')).toBeInTheDocument();
    expect(await screen.findByText('Ahmed Tazi')).toBeInTheDocument();
    expect(screen.getByText(/Allergies : Pénicilline/)).toBeInTheDocument();
    expect(screen.getByTitle('Changer de patient')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/patients/p-tazi');
  });

  it('patient introuvable : champ de recherche et message discret', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    afficher('patientId=inconnu');
    expect(await screen.findByText('Patient introuvable, recherchez-le ci-dessous')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Rechercher par nom ou téléphone...')).toBeInTheDocument();
  });

  it('sans patient dans l adresse : champ de recherche, aucune requête', () => {
    afficher('');
    expect(screen.getByPlaceholderText('Rechercher par nom ou téléphone...')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
