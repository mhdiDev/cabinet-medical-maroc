import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PriseConstantesModal } from './PriseConstantesModal';
import { apiClient } from '@/lib/api';

jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const { get, post, patch } = apiClient as unknown as Record<'get' | 'post' | 'patch', jest.Mock>;

const patient = { id: 'p1', dateNaissance: '1980-01-01' };
const priseExistante: any = {
  id: 'k1',
  patientId: 'p1',
  consultationId: null,
  datePrise: '2026-11-11T09:00:00.000Z',
  createdAt: '2026-11-11T09:00:00.000Z',
  priseParId: 'sec-1',
  prisePar: { id: 'sec-1', prenom: 'Fatima', nom: 'Alaoui', role: 'SECRETAIRE' },
  consultation: null,
  poids: 70,
  taille: 170,
  imc: 24.2,
  alertes: [],
};

async function afficher(prise?: any) {
  const onClose = jest.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PriseConstantesModal patient={patient} prise={prise} onClose={onClose} />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(get).toHaveBeenCalled());
  await act(async () => {});
  return onClose;
}

beforeEach(() => {
  get.mockReset().mockResolvedValue({ data: [] });
  post.mockReset().mockResolvedValue({ data: {} });
  patch.mockReset().mockResolvedValue({ data: {} });
});

describe('PriseConstantesModal', () => {
  it('création : envoie les valeurs saisies', async () => {
    await afficher();
    await userEvent.type(screen.getByLabelText('Poids'), '72');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/constantes', { patientId: 'p1', poids: 72 }));
  });

  it('modification : une valeur effacée part à null', async () => {
    await afficher(priseExistante);
    await userEvent.clear(screen.getByLabelText('Taille'));
    const poids = screen.getByLabelText('Poids');
    await userEvent.clear(poids);
    await userEvent.type(poids, '71');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/constantes/k1', expect.objectContaining({ poids: 71, taille: null })),
    );
  });

  it('valeur hors bornes : erreur affichée, rien envoyé', async () => {
    await afficher();
    await userEvent.type(screen.getByLabelText('Température'), '375');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByLabelText('Température')).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(screen.getByLabelText('Température').getAttribute('aria-describedby')!.split(' ').pop()!)).toHaveTextContent(/\S/);
    expect(post).not.toHaveBeenCalled();
  });

  it('formulaire vide : rien envoyé', async () => {
    await afficher();
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(post).not.toHaveBeenCalled();
  });
});
