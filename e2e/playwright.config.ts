import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { BASE_URL, DOSSIER_JOUR } from './lib/config';

// Chromium fourni par Playwright (npx playwright install chromium), en local comme sur GitHub :
// le Chrome installé sur un Mac est bien plus lent à piloter (versions décalées)
const chrome = {};

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: path.join(DOSSIER_JOUR, 'donnees', 'playwright'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(DOSSIER_JOUR, 'rapport-html'), open: 'never' }],
    ['json', { outputFile: path.join(DOSSIER_JOUR, 'donnees', 'resultats.json') }],
  ],
  use: {
    baseURL: BASE_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'], ...chrome, viewport: { width: 1440, height: 900 } } },
    // iPhone 13 en émulation dans Chromium (taille, densité, tactile, agent utilisateur)
    { name: 'mobile-iphone-13', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', ...chrome } },
    { name: 'mobile-pixel-7', use: { ...devices['Pixel 7'], ...chrome } },
  ],
});
