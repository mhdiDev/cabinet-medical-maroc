'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

export default function OrdonnanceDetailPage({ params }: { params: { id: string } }) {
  const { data: ordonnance, isLoading } = useQuery({
    queryKey: ['ordonnance', params.id],
    queryFn: () => apiClient.get(`/ordonnances/${params.id}`).then((r) => r.data),
  });

  const handlePdf = () => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    window.open(`${base}/ordonnances/${params.id}/pdf`, '_blank');
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement...</div>;
  if (!ordonnance) return <div className="p-8 text-center text-red-500">Ordonnance introuvable</div>;

  const patient = ordonnance.patient as any;
  const medicaments = ordonnance.medicaments as any[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/ordonnances" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Ordonnances
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">
              Ordonnance du {new Date(ordonnance.createdAt).toLocaleDateString('fr-MA')}
            </h1>
            <p className="text-sm text-gray-500">
              {patient?.prenom} {patient?.nom} · {ordonnance.medecinNom}
            </p>
          </div>
        </div>
        <button
          onClick={handlePdf}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 w-full sm:w-auto"
        >
          Télécharger PDF
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Médecin</p>
          <p className="text-gray-900 font-medium">{ordonnance.medecinNom}</p>
          {ordonnance.medecinSpec && (
            <p className="text-sm text-gray-500">{ordonnance.medecinSpec}</p>
          )}
          {ordonnance.medecinRPPM && (
            <p className="text-xs text-gray-400">RPPM : {ordonnance.medecinRPPM}</p>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Patient</p>
          <Link href={`/patients/${ordonnance.patientId}`} className="text-blue-600 hover:underline font-medium">
            {patient?.prenom} {patient?.nom}
          </Link>
          {patient?.dateNaissance && (
            <p className="text-sm text-gray-500">
              Né(e) le {new Date(patient.dateNaissance).toLocaleDateString('fr-MA')}
            </p>
          )}
        </div>

        <hr className="border-gray-100" />

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Médicaments prescrits</p>
          <div className="space-y-3">
            {medicaments.map((m, i) => (
              <div key={m.id} className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">
                  {i + 1}. {m.medicament?.nom || m.nomLibre}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">Posologie : {m.posologie}</p>
                {m.duree && <p className="text-sm text-gray-500">Durée : {m.duree}</p>}
                <p className="text-sm text-gray-500">Quantité : {m.quantite}</p>
              </div>
            ))}
          </div>
        </div>

        {ordonnance.notes && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
            <p className="text-sm text-gray-600 italic">{ordonnance.notes}</p>
          </div>
        )}

        {ordonnance.consultationId && (
          <div className="pt-2">
            <Link
              href={`/consultations/${ordonnance.consultationId}`}
              className="text-blue-600 text-sm hover:underline"
            >
              Voir la consultation associée →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
