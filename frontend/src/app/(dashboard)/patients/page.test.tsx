import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PatientsPage from './page';
import { apiClient } from '@/lib/api';

let recherche = new URLSearchParams('q=tazi&date=2026-11-10');
const replace = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => recherche,
  useRouter: () => ({ replace, push: jest.fn() }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PatientsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  get.mockReset();
  replace.mockReset();
  recherche = new URLSearchParams('q=tazi&date=2026-11-10');
  get.mockResolvedValue({ data: { data: [], meta: { total: 0, page: 1, limit: 20, pages: 0 } } });
});

describe('Page Patients : filtres de l adresse', () => {
  it('lit q et date, affiche la pastille et sait retirer la date', async () => {
    afficher();
    expect(await screen.findByText('0 patient(s)')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/patients', {
      params: { q: 'tazi', date: '2026-11-10', page: 1, limit: 20 },
    });
    expect(screen.getByDisplayValue('tazi')).toBeInTheDocument();
    expect(screen.getByText('Vus en consultation le 10/11/2026')).toBeInTheDocument();

    await userEvent.setup({ delay: null }).click(screen.getByLabelText('Retirer le filtre de date'));
    expect(await screen.findByText('0 patient(s)')).toBeInTheDocument();
    expect(get).toHaveBeenLastCalledWith('/patients', {
      params: { q: 'tazi', date: undefined, page: 1, limit: 20 },
    });
    expect(screen.queryByText(/Vus en consultation/)).not.toBeInTheDocument();
  });

  it('retirer la pastille met l adresse à jour sans la date', async () => {
    afficher();
    await screen.findByText('0 patient(s)');
    await userEvent.setup({ delay: null }).click(screen.getByLabelText('Retirer le filtre de date'));
    await screen.findByText('0 patient(s)');
    expect(replace).toHaveBeenLastCalledWith('/patients?q=tazi', { scroll: false });
  });

  it('ignore une date invalide de l adresse', async () => {
    recherche = new URLSearchParams('q=tazi&date=pas-une-date');
    afficher();
    await screen.findByText('0 patient(s)');
    expect(get).toHaveBeenCalledWith('/patients', {
      params: { q: 'tazi', date: undefined, page: 1, limit: 20 },
    });
    expect(screen.queryByText(/Vus en consultation/)).not.toBeInTheDocument();
  });

  it('affiche une erreur quand le chargement échoue', async () => {
    get.mockRejectedValue(new Error('boom'));
    afficher();
    expect(await screen.findByText('Erreur lors du chargement des patients')).toBeInTheDocument();
  });
});
