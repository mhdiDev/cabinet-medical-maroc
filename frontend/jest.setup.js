import '@testing-library/jest-dom';

// user-event s'appuie sur @testing-library/dom 10, RTL sur la 9 (copie imbriquée) : sans ceci,
// les événements de user-event ne sont pas enveloppés dans act() et React affiche des avertissements.
const { act } = require('@testing-library/react');
const { configure } = require('@testing-library/dom');

configure({
  eventWrapper: (cb) => {
    let resultat;
    act(() => {
      resultat = cb();
    });
    return resultat;
  },
});
