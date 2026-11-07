import { useEffect, useRef } from 'react';

/**
 * Comportement commun des modales : Échap ferme (sauf si `bloque`) et le focus
 * va sur le premier élément portant `data-autofocus` dans le conteneur.
 */
export function useModale(onClose: () => void, bloque: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !bloque) onClose();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onClose, bloque]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  return ref;
}
