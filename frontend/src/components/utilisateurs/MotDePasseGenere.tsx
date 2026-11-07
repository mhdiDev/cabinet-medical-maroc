'use client';
import toast from 'react-hot-toast';
import type { Utilisateur } from './types';

interface Props {
  titre: string;
  utilisateur: Pick<Utilisateur, 'prenom' | 'nom' | 'email'>;
  motDePasse: string;
  onClose: () => void;
}

// navigator.clipboard n'existe qu'en contexte sécurisé (HTTPS) : repli sur execCommand en HTTP
async function copierDansPressePapiers(texte: string): Promise<boolean> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texte);
      return true;
    } catch {
      // on tente le repli ci-dessous
    }
  }
  const focusPrecedent = document.activeElement as HTMLElement | null;
  const champ = document.createElement('textarea');
  champ.value = texte;
  champ.readOnly = true;
  champ.style.cssText = 'position: fixed; top: 0; left: -9999px';
  document.body.appendChild(champ);
  champ.select();
  champ.setSelectionRange(0, texte.length);
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(champ);
    focusPrecedent?.focus();
  }
}

// Affiché une seule fois : le serveur ne conserve que le hash
export function MotDePasseGenere({ titre, utilisateur, motDePasse, onClose }: Props) {
  const copier = async () => {
    if (await copierDansPressePapiers(motDePasse)) {
      toast.success('Mot de passe copié');
    } else {
      toast.error('Copie impossible : sélectionnez le mot de passe');
    }
  };

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">{titre}</h2>
      <p className="text-sm text-gray-500 mb-4">
        {utilisateur.prenom} {utilisateur.nom} — {utilisateur.email}
      </p>
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
        <code
          data-testid="mot-de-passe-genere"
          className="flex-1 font-mono text-xl tracking-wider text-gray-900 select-all break-all"
        >
          {motDePasse}
        </code>
        <button
          type="button"
          onClick={copier}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition"
        >
          Copier
        </button>
      </div>
      <p className="text-sm text-orange-800 bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
        Notez-le maintenant : il ne sera plus affiché. L&apos;utilisateur devra le changer à sa
        première connexion.
      </p>
      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
        >
          J&apos;ai noté le mot de passe
        </button>
      </div>
    </div>
  );
}
