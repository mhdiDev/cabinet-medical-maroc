/**
 * Avis UX automatique : Claude analyse la capture mobile de chaque écran.
 * Utilisé seulement si ANTHROPIC_API_KEY est défini (secret GitHub).
 */
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import type { Ecran } from '../lib/controles';

export interface AvisUx {
  ecran: string;
  projet: string;
  capture: string;
  texte: string;
}

const CONSIGNE = `Tu es ergonome d'interfaces. Voici la capture pleine page d'un écran mobile d'une application
de gestion de cabinet médical au Maroc, utilisée par des médecins et des secrétaires, souvent entre deux patients.
Les données affichées sont fictives.

Donne ton avis en français, en Markdown, avec exactement ces rubriques en liste :
- **Lisibilité** : taille et contraste des textes, densité.
- **Hiérarchie visuelle** : ce qui attire l'œil en premier, et si c'est la bonne chose.
- **Étapes pour les actions fréquentes** : combien de gestes pour l'action principale de l'écran, et comment en retirer.
- **Cohérence des boutons** : couleurs, tailles, libellés, placement par rapport aux autres écrans habituels.
- **Suggestions** : 2 à 4 changements concrets (quel élément, quoi changer), du plus utile au moins utile.

Sois bref (150 mots au plus) et concret. Ne commente que ce qui est visible sur la capture.`;

export async function analyserCaptures(ecrans: Ecran[], dossier: string): Promise<AvisUx[]> {
  const client = new Anthropic();
  // Un seul profil mobile par écran suffit pour l'avis : on garde l'iPhone 13, sinon le premier
  const parEcran = new Map<string, Ecran>();
  for (const e of ecrans) {
    if (!parEcran.has(e.ecran) || e.projet === 'mobile-iphone-13') parEcran.set(e.ecran, e);
  }

  const avis: AvisUx[] = [];
  for (const e of parEcran.values()) {
    const image = fs.readFileSync(path.join(dossier, e.capture)).toString('base64');
    try {
      const reponse = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        // Si une demande est refusée par un filtre de sécurité, l'API bascule sur un autre modèle
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image } },
              { type: 'text', text: `${CONSIGNE}\n\nÉcran : ${e.ecran} (${e.url}).` },
            ],
          },
        ],
      } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming);
      const texte =
        reponse.stop_reason === 'refusal'
          ? '_Analyse refusée par le modèle pour cet écran._'
          : reponse.content
              .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
              .map((b) => b.text)
              .join('\n')
              .trim();
      avis.push({ ecran: e.ecran, projet: e.projet, capture: e.capture, texte: texte || '_Pas de réponse._' });
    } catch (err) {
      avis.push({ ecran: e.ecran, projet: e.projet, capture: e.capture, texte: `_Analyse impossible : ${(err as Error).message}_` });
    }
  }
  return avis;
}
