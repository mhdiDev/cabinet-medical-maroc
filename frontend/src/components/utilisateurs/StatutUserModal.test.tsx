import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatutUserModal } from './StatutUserModal';
import type { Utilisateur } from './types';

const medecin = (rdvAVenir: number): Utilisateur => ({
  id: 'u1',
  nom: 'Benali',
  prenom: 'Mohammed',
  email: 'dr.benali@cabinet.ma',
  role: 'MEDECIN',
  estTitulaire: false,
  actif: true,
  doitChangerMdp: false,
  telephone: null,
  rdvAVenir,
});

function afficher(rdvAVenir: number) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <StatutUserModal utilisateur={medecin(rdvAVenir)} onClose={() => {}} />
    </QueryClientProvider>,
  );
}

describe('StatutUserModal : avertissement des rendez-vous à venir', () => {
  it('accorde le verbe au singulier pour un seul rendez-vous', () => {
    afficher(1);
    screen.getByText("1 rendez-vous à venir reste dans l'agenda.");
  });

  it('accorde le verbe au pluriel pour plusieurs rendez-vous', () => {
    afficher(3);
    screen.getByText("3 rendez-vous à venir restent dans l'agenda.");
  });

  it("n'affiche rien sans rendez-vous à venir", () => {
    afficher(0);
    expect(screen.queryByText(/rendez-vous à venir/)).toBeNull();
  });
});
