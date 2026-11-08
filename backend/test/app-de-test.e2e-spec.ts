import { INestApplication } from '@nestjs/common';
import { AddressInfo } from 'net';
import * as request from 'supertest';
import { createApp } from './helpers';

// Sans serveur à l'écoute, supertest ouvre puis ferme un port éphémère à chaque
// requête. Avec l'agent keep-alive de Node 20, une requête peut alors réutiliser
// une socket que la fermeture précédente a coupée : « read ECONNRESET » au hasard.
describe('Application de test (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('écoute sur un port fixe, réutilisé par toutes les requêtes', async () => {
    const serveur = app.getHttpServer();
    expect(serveur.listening).toBe(true);
    const port = (serveur.address() as AddressInfo).port;

    for (let i = 0; i < 3; i++) {
      expect((await request(serveur).get('/api/health')).status).toBe(200);
    }
    expect(serveur.listening).toBe(true);
    expect((serveur.address() as AddressInfo).port).toBe(port);
  });
});
