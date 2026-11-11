import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormulaireConstantes } from './FormulaireConstantes';
import { SAISIE_VIDE, type ErreursSaisie } from '@/lib/constantes/saisie';

function Hote({ dateNaissance = '1980-01-01', erreurs = {}, tailleConnue }: { dateNaissance?: string; erreurs?: ErreursSaisie; tailleConnue?: number }) {
  const [saisie, setSaisie] = useState(SAISIE_VIDE);
  return (
    <FormulaireConstantes saisie={saisie} onChange={setSaisie} erreurs={erreurs} dateNaissance={dateNaissance} tailleConnue={tailleConnue} />
  );
}

describe('FormulaireConstantes', () => {
  it('chaque champ a un libellé relié', () => {
    render(<Hote />);
    for (const libelle of ['Tension haute (systolique)', 'Tension basse (diastolique)', 'Pouls', 'SpO2', 'Température', 'Poids', 'Taille', 'Glycémie', 'Périmètre crânien', 'Tour de taille']) {
      expect(screen.getByLabelText(libelle)).toBeInTheDocument();
    }
  });

  it('pastille en direct : fièvre élevée, puis critique', async () => {
    render(<Hote />);
    const temperature = screen.getByLabelText('Température');
    await userEvent.type(temperature, '39,5');
    expect(screen.getByText('élevée')).toBeInTheDocument();
    await userEvent.clear(temperature);
    await userEvent.type(temperature, '40');
    expect(screen.getByText('élevée (critique)')).toBeInTheDocument();
  });

  it('IMC calculé avec le poids et la taille', async () => {
    render(<Hote />);
    await userEvent.type(screen.getByLabelText('Poids'), '72');
    await userEvent.type(screen.getByLabelText('Taille'), '170');
    expect(screen.getByTestId('imc')).toHaveTextContent('24,9');
  });

  it('IMC avec la dernière taille connue chez l adulte', async () => {
    render(<Hote tailleConnue={170} />);
    await userEvent.type(screen.getByLabelText('Poids'), '72');
    expect(screen.getByTestId('imc')).toHaveTextContent('24,9');
  });

  it('enfant : pas de pastille de tension', async () => {
    render(<Hote dateNaissance="2018-01-01" />);
    await userEvent.type(screen.getByLabelText('Tension haute (systolique)'), '150');
    await userEvent.type(screen.getByLabelText('Tension basse (diastolique)'), '95');
    expect(screen.queryByText('élevée')).not.toBeInTheDocument();
  });

  it('affiche les erreurs reçues sous le champ', () => {
    render(<Hote erreurs={{ temperature: 'Entre 30 et 45 °C' }} />);
    expect(screen.getByLabelText('Température')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Entre 30 et 45 °C')).toBeInTheDocument();
  });
});
