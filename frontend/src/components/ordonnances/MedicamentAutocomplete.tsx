'use client';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface MedicamentOption {
  id: string;
  nom: string;
  denomination?: string;
  dosage?: string;
  forme?: string;
  ppv?: number;
  princepsGenerique?: string;
  tauxRemboursement?: string;
}

interface Props {
  value: string;
  onChange: (value: string, medicament?: MedicamentOption) => void;
  placeholder?: string;
}

export function MedicamentAutocomplete({ value, onChange, placeholder }: Props) {
  const [input, setInput] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer en cliquant dehors
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['medicaments-search', input],
    queryFn: () =>
      apiClient
        .get('/medicaments/search', { params: { q: input, limit: 12 } })
        .then(r => r.data as MedicamentOption[]),
    enabled: input.trim().length >= 2,
    staleTime: 10000,
  });

  const handleSelect = (med: MedicamentOption) => {
    const label = med.dosage ? `${med.nom} ${med.dosage}` : med.nom;
    setInput(label);
    onChange(label, med);
    setOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    onChange(e.target.value, undefined);
    setOpen(true);
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={handleChange}
          onFocus={() => input.length >= 2 && setOpen(true)}
          placeholder={placeholder || 'Nom du médicament ou DCI...'}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none pr-8"
        />
        {isFetching && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {open && input.trim().length >= 2 && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
          {results.length === 0 && !isFetching ? (
            <div className="px-4 py-3">
              <p className="text-sm text-gray-500">
                Aucun médicament trouvé pour «&nbsp;{input}&nbsp;»
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Ce nom sera utilisé tel quel dans l'ordonnance.
              </p>
            </div>
          ) : (
            results.map((med) => (
              <button
                key={med.id}
                type="button"
                onClick={() => handleSelect(med)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition border-b border-gray-50 last:border-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {med.nom}
                      {med.dosage && (
                        <span className="text-gray-500 font-normal"> — {med.dosage}</span>
                      )}
                    </p>
                    {med.denomination && (
                      <p className="text-xs text-gray-400 truncate">DCI: {med.denomination}</p>
                    )}
                    {med.forme && (
                      <p className="text-xs text-gray-400">{med.forme}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {med.ppv != null && (
                      <p className="text-xs font-medium text-green-700">{med.ppv} MAD</p>
                    )}
                    <div className="flex gap-1 justify-end mt-0.5">
                      {med.princepsGenerique && (
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            med.princepsGenerique === 'G'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {med.princepsGenerique === 'G' ? 'Générique' : 'Princeps'}
                        </span>
                      )}
                      {med.tauxRemboursement && med.tauxRemboursement !== '0%' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                          {med.tauxRemboursement}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
