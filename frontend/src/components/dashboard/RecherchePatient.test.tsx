// frontend/src/components/dashboard/RecherchePatient.test.tsx
import { act, render, screen, waitFor } from '@testing-library/react';
import { configure } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecherchePatient } from './RecherchePatient';
import { apiClient } from '@/lib/api';

// user-event s'appuie sur @testing-library/dom 10, RTL sur la 9 : sans ceci, ses événements ne sont pas enveloppés dans act()
configure({
  eventWrapper: (cb) => {
    let resultat;
    act(() => {
      resultat = cb();
    });
    return resultat;
  },
});

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('@/lib/api', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;

const tazi = { id: 'p-tazi', nom: 'Tazi', prenom: 'Ahmed', dateNaissance: '1980-01-01T00:00:00.000Z', telephone: '0612345678' };
const alami = { id: 'p-alami', nom: 'Alami', prenom: 'Sara', dateNaissance: '1994-06-15T00:00:00.000Z', telephone: '0698765432' };

function reponse(data: object[], total = data.length) {
  get.mockResolvedValue({ data: { data, meta: { total } } });
}

function afficher(peutCreerConsultation = true) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RecherchePatient peutCreerConsultation={peutCreerConsultation} />
    </QueryClientProvider>,
  );
  return screen.getByRole('combobox');
}

beforeEach(() => {
  get.mockReset();
  push.mockReset();
});

describe('RecherchePatient', () => {
  it('cherche par nom et affiche âge et téléphone', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(), 'tazi');
    expect(await screen.findByText('Ahmed Tazi')).toBeInTheDocument();
    expect(screen.getByText(/0612345678/)).toBeInTheDocument();
    expect(get).toHaveBeenLastCalledWith('/patients', { params: { q: 'tazi', limit: 8 } });
  });

  it('cherche par date et affiche heure et médecin', async () => {
    reponse([
      { ...tazi, consultationsDuJour: [{ id: 'c1', dateConsultation: '2026-11-10T08:30:00.000Z', medecin: { nom: 'Benali', prenom: 'Hassan' } }] },
    ]);
    await userEvent.type(afficher(), '10/11/2026');
    expect(await screen.findByText('Patients vus le 10/11/2026')).toBeInTheDocument();
    expect(screen.getByText('09:30 · Dr Benali')).toBeInTheDocument();
    expect(get).toHaveBeenLastCalledWith('/patients', { params: { date: '2026-11-10', limit: 8 } });
  });

  it('clic sur un patient : ouvre la fiche', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(), 'tazi');
    await userEvent.click(await screen.findByText('Ahmed Tazi'));
    expect(push).toHaveBeenCalledWith('/patients/p-tazi');
  });

  it('clavier : flèche bas puis Entrée ouvre la fiche, Échap ferme', async () => {
    reponse([tazi, alami]);
    const champ = afficher();
    await userEvent.type(champ, 'a');
    await userEvent.type(champ, 'h');
    await screen.findByText('Sara Alami');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(push).toHaveBeenCalledWith('/patients/p-alami');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('« + Consultation » pour le médecin, masqué pour la secrétaire', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(true), 'tazi');
    const lien = await screen.findByRole('link', { name: '+ Consultation pour Ahmed Tazi' });
    expect(lien).toHaveAttribute('href', '/consultations/nouvelle?patientId=p-tazi');
  });

  it('secrétaire : pas de « + Consultation »', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(false), 'tazi');
    await screen.findByText('Ahmed Tazi');
    expect(screen.queryByRole('link', { name: /Consultation/ })).toBeNull();
  });

  it('aucun résultat : message et lien de création', async () => {
    reponse([]);
    await userEvent.type(afficher(), 'zzz');
    expect(await screen.findByText('Aucun patient trouvé')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un patient' })).toHaveAttribute('href', '/patients/nouveau');
  });

  it('plus de 8 résultats : lien vers tous les résultats', async () => {
    reponse([tazi], 12);
    await userEvent.type(afficher(), 'tazi 10/11/2026');
    expect(await screen.findByRole('link', { name: 'Voir tous les résultats (12)' })).toHaveAttribute(
      'href',
      '/patients?q=tazi&date=2026-11-10',
    );
  });

  it('date en cours de frappe : aide, sans requête', async () => {
    await userEvent.type(afficher(), '10/11');
    expect(await screen.findByText('Date au format JJ/MM/AAAA')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('date impossible : message', async () => {
    await userEvent.type(afficher(), '31/02/2026');
    expect(await screen.findByText('Date invalide')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('erreur réseau : message', async () => {
    get.mockRejectedValue(new Error('réseau'));
    await userEvent.type(afficher(), 'tazi');
    await waitFor(() => expect(screen.getByText('Recherche impossible, réessayez')).toBeInTheDocument());
  });
});
