import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const patch = apiClient.patch as jest.Mock;

const tazi = {
  id: 'p-tazi',
  nom: 'Tazi',
  prenom: 'Ahmed',
  dateNaissance: '1980-01-01T00:00:00.000Z',
  telephone: '0612345678',
  allergies: ['Pénicilline'],
};

function nouveauClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function afficher(query: string, client: QueryClient = nouveauClient()) {
  recherche = new URLSearchParams(query);
  const arbre = () => (
    <QueryClientProvider client={client}>
      <NouvelleConsultationPage />
    </QueryClientProvider>
  );
  const rendu = render(arbre());
  return { ...rendu, rerendre: () => rendu.rerender(arbre()) };
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
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

  it('cache périmé : affiche les allergies de la réponse fraîche, pas celles du cache', async () => {
    const client = nouveauClient();
    client.setQueryData(['patient-preload', 'p-tazi'], { ...tazi, allergies: [] });
    get.mockResolvedValue({ data: tazi });
    afficher('patientId=p-tazi', client);
    expect(await screen.findByText(/Allergies : Pénicilline/)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/patients/p-tazi');
  });

  it('introuvable : le message ne revient pas après un choix manuel puis « Changer »', async () => {
    get.mockImplementation((url: string) =>
      url === '/patients/x'
        ? Promise.reject({ response: { status: 404 } })
        : Promise.resolve({ data: { data: [tazi] } }),
    );
    afficher('patientId=x');
    await screen.findByText(/Patient introuvable/);
    const u = userEvent.setup({ delay: null });
    await u.type(screen.getByPlaceholderText(/Rechercher/), 'Ta');
    await u.click(await screen.findByText('Ahmed Tazi'));
    expect(screen.queryByText(/Patient introuvable/)).toBeNull();
    await u.click(screen.getByTitle('Changer de patient'));
    expect(screen.queryByText(/Patient introuvable/)).toBeNull();
  });

  it('400 : patient introuvable', async () => {
    get.mockRejectedValue({ response: { status: 400 } });
    afficher('patientId=mauvais');
    expect(await screen.findByText('Patient introuvable, recherchez-le ci-dessous')).toBeInTheDocument();
  });

  it('autre erreur : impossible de charger le patient', async () => {
    get.mockRejectedValue({ response: { status: 500 } });
    afficher('patientId=p-tazi');
    expect(await screen.findByText('Impossible de charger le patient, recherchez-le ci-dessous')).toBeInTheDocument();
    expect(screen.queryByText(/Patient introuvable/)).toBeNull();
  });

  it('patientId qui change : le nouveau patient est chargé', async () => {
    const autre = { ...tazi, id: 'p-autre', nom: 'Alaoui', prenom: 'Sara', allergies: [] };
    get.mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/patients/p-tazi' ? tazi : autre }),
    );
    const { rerendre } = afficher('patientId=p-tazi');
    expect(await screen.findByText('Ahmed Tazi')).toBeInTheDocument();
    recherche = new URLSearchParams('patientId=p-autre');
    rerendre();
    expect(await screen.findByText('Sara Alaoui')).toBeInTheDocument();
  });
});

const priseFatima = {
  id: 'k1',
  patientId: 'p-tazi',
  consultationId: null,
  datePrise: '2026-11-11T09:12:00.000Z',
  createdAt: '2026-11-11T09:12:00.000Z',
  priseParId: 'sec-1',
  prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
  consultation: null,
  poids: 72,
  imc: null,
  alertes: [],
};

function reponses(prise: unknown) {
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url.endsWith('/du-jour') ? { prise } : tazi }),
  );
  post.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/constantes' ? { ...priseFatima, id: 'k2' } : { id: 'c1' } }),
  );
}

describe('Nouvelle consultation : constantes', () => {
  it('pré-remplit les constantes prises par la secrétaire et les rattache sans les renvoyer', async () => {
    reponses(priseFatima);
    afficher('patientId=p-tazi');
    expect(await screen.findByText(/Prises à .* par Fatima Alaoui/)).toBeInTheDocument();
    expect(screen.getByLabelText('Poids')).toHaveValue('72');

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/consultations', expect.objectContaining({ constantesId: 'k1' })),
    );
    expect(patch).not.toHaveBeenCalled();
  });

  it('constantes modifiées par le médecin : PATCH avant la consultation', async () => {
    reponses(priseFatima);
    patch.mockResolvedValue({ data: { ...priseFatima, poids: 73 } });
    afficher('patientId=p-tazi');
    const poids = await screen.findByDisplayValue('72');
    await userEvent.clear(poids);
    await userEvent.type(poids, '73');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/consultations', expect.objectContaining({ constantesId: 'k1' })),
    );
    expect(patch).toHaveBeenCalledWith('/constantes/k1', expect.objectContaining({ poids: 73 }));
  });

  it('sans prise du jour : crée la prise puis la consultation', async () => {
    reponses(null);
    afficher('patientId=p-tazi');
    await screen.findByText('Ahmed Tazi');
    await userEvent.type(await screen.findByLabelText('Poids'), '70');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post).toHaveBeenNthCalledWith(1, '/constantes', { patientId: 'p-tazi', poids: 70 });
    expect(post).toHaveBeenNthCalledWith(2, '/consultations', expect.objectContaining({ constantesId: 'k2' }));
  });

  it('bloc vide : aucune prise créée', async () => {
    reponses(null);
    afficher('patientId=p-tazi');
    await screen.findByText('Ahmed Tazi');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/consultations', expect.objectContaining({ constantesId: undefined }));
  });

  it('valeur hors bornes : rien n est envoyé', async () => {
    reponses(null);
    afficher('patientId=p-tazi');
    await screen.findByText('Ahmed Tazi');
    await userEvent.type(await screen.findByLabelText('Température'), '375');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la consultation' }));
    expect(await screen.findByText('Entre 30 et 45 °C')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });
});
