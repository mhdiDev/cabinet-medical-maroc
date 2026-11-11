// frontend/src/components/dashboard/RecherchePatient.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecherchePatient } from './RecherchePatient';
import { apiClient } from '@/lib/api';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
// next/link met à jour un état de visibilité hors act() (préchargement) : un simple <a> suffit ici
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
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
    const age = new Date().getFullYear() - 1980; // né le 1er janvier : l'anniversaire est déjà passé
    expect(screen.getByText(`${age} ans · 0612345678`)).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
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
    await userEvent.type(champ, 'ah');
    await screen.findByText('Sara Alami');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(push).toHaveBeenCalledWith('/patients/p-alami');
  });

  it('Échap ferme la liste et Entrée ne navigue plus', async () => {
    reponse([tazi, alami]);
    const champ = afficher();
    await userEvent.type(champ, 'ah');
    await screen.findByText('Sara Alami');
    await userEvent.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.keyboard('{Enter}');
    expect(push).not.toHaveBeenCalled();
  });

  it('flèche haut sans sélection : choisit le dernier résultat', async () => {
    reponse([tazi, alami]);
    await userEvent.type(afficher(), 'ah');
    await screen.findByText('Sara Alami');
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(push).toHaveBeenCalledWith('/patients/p-alami');
  });

  it('clic à l\'extérieur ferme la liste', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(), 'tazi');
    await screen.findByRole('listbox');
    await userEvent.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('« + Consultation » pour le médecin', async () => {
    reponse([tazi]);
    await userEvent.type(afficher(true), 'tazi');
    const lien = await screen.findByRole('link', { name: '+ Consultation pour Ahmed Tazi' });
    expect(lien).toHaveAttribute('href', '/consultations/nouvelle?patientId=p-tazi');
  });

  it('annonce le nombre de résultats dans une zone status', async () => {
    reponse([tazi, alami]);
    await userEvent.type(afficher(), 'ah');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 patients trouvés'));
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
    expect(await screen.findAllByText('Aucun patient trouvé')).toHaveLength(2); // message affiché + zone status
    expect(screen.getByRole('status')).toHaveTextContent('Aucun patient trouvé');
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
    expect(await screen.findAllByText('Date au format JJ/MM/AAAA')).toHaveLength(2); // message affiché + zone status
    expect(screen.getByRole('status')).toHaveTextContent('Date au format JJ/MM/AAAA');
    expect(get).not.toHaveBeenCalled();
  });

  it('date impossible : message', async () => {
    await userEvent.type(afficher(), '31/02/2026');
    expect(await screen.findAllByText('Date invalide')).toHaveLength(2); // message affiché + zone status
    expect(screen.getByRole('status')).toHaveTextContent('Date invalide');
    expect(get).not.toHaveBeenCalled();
  });

  it('erreur réseau : message', async () => {
    get.mockRejectedValue(new Error('réseau'));
    await userEvent.type(afficher(), 'tazi');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Recherche impossible, réessayez'));
    expect(screen.getAllByText('Recherche impossible, réessayez')).toHaveLength(2);
  });
});
