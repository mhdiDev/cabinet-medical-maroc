import { age, choisirProchainPatient, dateDepuisJour, RdvDuJour, statutSuivant } from './donnees';

function rdv(id: string, h: number, m: number, statut: RdvDuJour['statut']): RdvDuJour {
  return {
    id,
    dateHeure: new Date(2026, 10, 11, h, m).toISOString(),
    dureeMinutes: 30,
    statut,
    patient: { id: `p-${id}`, nom: 'Nom', prenom: 'Prénom', telephone: '0600000000' },
  };
}

describe('choisirProchainPatient', () => {
  const midi = new Date(2026, 10, 11, 12, 0);

  it('privilégie un patient déjà arrivé', () => {
    const liste = [rdv('a', 14, 0, 'CONFIRME'), rdv('b', 11, 0, 'ARRIVE')];
    expect(choisirProchainPatient(liste, midi)?.id).toBe('b');
  });

  it('sinon prend le prochain créneau non terminé', () => {
    const liste = [rdv('passe', 9, 0, 'EN_ATTENTE'), rdv('apres', 15, 0, 'EN_ATTENTE'), rdv('bientot', 14, 0, 'CONFIRME')];
    expect(choisirProchainPatient(liste, midi)?.id).toBe('bientot');
  });

  it('garde un créneau en cours', () => {
    expect(choisirProchainPatient([rdv('encours', 11, 45, 'CONFIRME')], midi)?.id).toBe('encours');
  });

  it('ignore les RDV facturés et renvoie null sans candidat', () => {
    expect(choisirProchainPatient([rdv('f', 14, 0, 'FACTURE')], midi)).toBeNull();
  });
});

describe('age', () => {
  it("compte les années révolues", () => {
    expect(age('1988-11-12', new Date(2026, 10, 11))).toBe(37);
    expect(age('1988-11-11', new Date(2026, 10, 11))).toBe(38);
  });

  it('renvoie null sans date', () => {
    expect(age(null)).toBeNull();
  });
});

describe('statutSuivant', () => {
  it('suit le parcours de l’agenda', () => {
    expect(statutSuivant('EN_ATTENTE')?.statut).toBe('CONFIRME');
    expect(statutSuivant('CONFIRME')?.statut).toBe('ARRIVE');
    expect(statutSuivant('ARRIVE')?.statut).toBe('FACTURE');
    expect(statutSuivant('FACTURE')).toBeNull();
  });
});

describe('dateDepuisJour', () => {
  it('lit AAAA-MM-JJ sans glissement de jour', () => {
    const d = dateDepuisJour('2026-11-09');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 9]);
  });
});
