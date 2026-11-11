// frontend/src/components/dashboard/RecherchePatient.tsx
'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { heureCabinet } from '@/lib/fuseau';
import { analyserRecherche } from './analyser-recherche';

const LIMITE = 8;

interface ConsultationDuJour {
  id: string;
  dateConsultation: string;
  medecin: { nom: string; prenom: string };
}

interface PatientTrouve {
  id: string;
  nom: string;
  prenom: string;
  dateNaissance: string;
  telephone: string;
  consultationsDuJour?: ConsultationDuJour[];
}

function age(dateNaissance: string): number {
  const n = new Date(dateNaissance);
  const auj = new Date();
  let a = auj.getFullYear() - n.getUTCFullYear();
  if (auj.getMonth() < n.getUTCMonth() || (auj.getMonth() === n.getUTCMonth() && auj.getDate() < n.getUTCDate())) a--;
  return a;
}

export function RecherchePatient({ peutCreerConsultation }: { peutCreerConsultation: boolean }) {
  const router = useRouter();
  const idListe = useId();
  const zone = useRef<HTMLDivElement>(null);
  const [texte, setTexte] = useState('');
  const [saisie, setSaisie] = useState(''); // texte retenu après 300 ms sans frappe
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setSaisie(texte), 300);
    return () => clearTimeout(t);
  }, [texte]);

  useEffect(() => setActif(-1), [saisie]);

  useEffect(() => {
    const fermer = (e: MouseEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', fermer);
    return () => document.removeEventListener('mousedown', fermer);
  }, []);

  const recherche = analyserRecherche(saisie);
  const criteres = recherche.type === 'requete' ? { q: recherche.q, date: recherche.date } : null;

  const { data, isError, isFetching } = useQuery({
    queryKey: ['recherche-accueil', criteres],
    queryFn: () =>
      apiClient
        .get('/patients', {
          params: {
            ...(criteres?.q && { q: criteres.q }),
            ...(criteres?.date && { date: criteres.date }),
            limit: LIMITE,
          },
        })
        .then((r) => r.data as { data: PatientTrouve[]; meta: { total: number } }),
    enabled: !!criteres,
    staleTime: 5000,
  });

  const patients = criteres && data ? data.data : [];
  const total = criteres && data ? data.meta.total : 0;
  const visible = ouvert && recherche.type !== 'vide';
  const listeAffichee = !!criteres && !isError && patients.length > 0;
  const actifValide = visible && listeAffichee && actif >= 0 && actif < patients.length ? actif : -1;

  const lienTous = criteres
    ? `/patients?${new URLSearchParams({
        ...(criteres.q && { q: criteres.q }),
        ...(criteres.date && { date: criteres.date }),
      }).toString()}`
    : '';

  const ouvrirFiche = (p: PatientTrouve) => {
    setOuvert(false);
    router.push(`/patients/${p.id}`);
  };

  const auClavier = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOuvert(false);
      setActif(-1);
      return;
    }
    if (patients.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => (i >= patients.length - 1 ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setOuvert(true);
      setActif((i) => (i <= 0 || i >= patients.length ? patients.length - 1 : i - 1));
    } else if (e.key === 'Enter' && actifValide >= 0) {
      e.preventDefault();
      ouvrirFiche(patients[actifValide]);
    }
  };

  let annonce = '';
  if (recherche.type === 'aide' || recherche.type === 'erreur') annonce = recherche.message;
  else if (criteres && isError) annonce = 'Recherche impossible, réessayez';
  else if (criteres && data) annonce = patients.length === 0 ? 'Aucun patient trouvé' : `${total} patient${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}`;

  const message = (texteMessage: string, classe = 'text-gray-500') => (
    <p aria-hidden className={`px-4 py-3 text-sm ${classe}`}>{texteMessage}</p>
  );

  return (
    <div ref={zone} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden>🔍</span>
        <input
          type="text"
          role="combobox"
          aria-label="Rechercher un patient"
          aria-expanded={visible}
          aria-controls={visible && listeAffichee ? idListe : undefined}
          aria-activedescendant={actifValide >= 0 ? `${idListe}-${actifValide}` : undefined}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={auClavier}
          placeholder="Nom, prénom, téléphone ou date (JJ/MM/AAAA)"
          className="w-full pl-10 pr-10 py-3 bg-white border border-gray-300 rounded-xl shadow-sm text-base sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Recherche en cours">
            <span className="block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </div>

      <div role="status" aria-live="polite" className="sr-only">{visible ? annonce : ''}</div>

      {visible && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {recherche.type === 'aide' && message(recherche.message)}
          {recherche.type === 'erreur' && message(recherche.message, 'text-red-600')}
          {criteres && isError && message('Recherche impossible, réessayez', 'text-red-600')}
          {criteres && !isError && data && patients.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center justify-between gap-3">
              <span aria-hidden>Aucun patient trouvé</span>
              <Link href="/patients/nouveau" className="text-blue-600 hover:underline">Créer un patient</Link>
            </div>
          )}
          {criteres && !isError && patients.length > 0 && (
            <>
              {criteres.date && (
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-gray-500 uppercase">
                  Patients vus le {criteres.date.split('-').reverse().join('/')}
                </p>
              )}
              <ul id={idListe} role="listbox" aria-label="Patients trouvés" className="divide-y divide-gray-50">
                {patients.map((p, i) => (
                  <li key={p.id} role="presentation" className="flex items-center gap-3 pr-4">
                    <div
                      id={`${idListe}-${i}`}
                      role="option"
                      aria-selected={i === actifValide}
                      onClick={() => ouvrirFiche(p)}
                      onMouseEnter={() => setActif(i)}
                      className={`flex-1 min-w-0 cursor-pointer px-4 py-3 ${i === actifValide ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <p className="font-medium text-gray-900 truncate">{p.prenom} {p.nom}</p>
                      <p className="text-xs text-gray-500">
                        {age(p.dateNaissance)} ans · {p.telephone}
                      </p>
                      {p.consultationsDuJour?.map((c) => (
                        <p key={c.id} className="text-xs text-blue-700">
                          {heureCabinet(c.dateConsultation)} · Dr {c.medecin.nom}
                        </p>
                      ))}
                    </div>
                    {peutCreerConsultation && (
                      <Link
                        href={`/consultations/nouvelle?patientId=${p.id}`}
                        aria-label={`+ Consultation pour ${p.prenom} ${p.nom}`}
                        className="shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        + Consultation
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              {total > LIMITE && (
                <Link href={lienTous} className="block px-4 py-2 text-sm text-blue-600 hover:bg-gray-50 border-t border-gray-100">
                  Voir tous les résultats ({total})
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
