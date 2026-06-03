'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

const TABS = ['Profil', 'Consultations', 'Ordonnances', 'Documents', 'RDV'];

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState(0);

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', params.id],
    queryFn: () => apiClient.get(`/patients/${params.id}`).then(r => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement de la fiche...</div>;
  if (!patient) return <div className="p-8 text-center text-red-500">Patient introuvable</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/patients" className="text-gray-400 hover:text-gray-600 text-sm">← Retour</Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{patient.prenom} {patient.nom}</h1>
            <p className="text-gray-500 text-sm">
              CIN: {patient.cin || 'N/A'} · {patient.telephone} · {patient.ville || '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href={`/patients/${params.id}/modifier`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
            Modifier
          </Link>
          <Link href={`/consultations/nouvelle?patientId=${params.id}`}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
            + Consultation
          </Link>
        </div>
      </div>

      {/* Alertes médicales */}
      {(patient.allergies?.length > 0 || patient.antecedents) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
          {patient.allergies?.length > 0 && (
            <p className="text-red-700 text-sm">
              <strong>⚠️ Allergies:</strong> {patient.allergies.join(', ')}
            </p>
          )}
          {patient.antecedents && (
            <p className="text-red-700 text-sm">
              <strong>Antécédents:</strong> {patient.antecedents}
            </p>
          )}
        </div>
      )}

      {/* Résumé infos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Date de naissance', value: new Date(patient.dateNaissance).toLocaleDateString('fr-MA') },
          { label: 'Sexe', value: patient.sexe === 'MASCULIN' ? 'Masculin' : 'Féminin' },
          { label: 'Groupe sanguin', value: patient.groupeSanguin || 'N/A' },
          { label: 'N° Assurance', value: patient.numeroAssurance || 'N/A' },
          { label: 'Assuré', value: patient.estAssure ? 'Oui' : 'Non' },
        ].map(info => (
          <div key={info.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500">{info.label}</p>
            <p className="font-semibold text-gray-900 mt-1">{info.value}</p>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition ${
                tab === i ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          {tab === 0 && <ProfileTab patient={patient} />}
          {tab === 1 && <ConsultationsTab consultations={patient.consultations} patientId={params.id} />}
          {tab === 2 && <OrdonnancesTab ordonnances={patient.ordonnances} />}
          {tab === 3 && <DocumentsTab documents={patient.documents} />}
          {tab === 4 && <RdvTab rdvList={patient.rendezVous} />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ patient }: { patient: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {[
        ['Email', patient.email || '—'],
        ['Adresse', patient.adresse || '—'],
        ['Code postal', patient.codePostal || '—'],
        ['Ville', patient.ville || '—'],
      ].map(([label, value]) => (
        <div key={label}>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ConsultationsTab({ consultations, patientId }: { consultations: any[]; patientId: string }) {
  if (!consultations?.length) return (
    <div className="text-center py-8">
      <p className="text-gray-500 mb-4">Aucune consultation enregistrée</p>
      <Link href={`/consultations/nouvelle?patientId=${patientId}`}
        className="text-blue-600 underline text-sm">
        Créer une consultation
      </Link>
    </div>
  );
  return (
    <div className="space-y-3">
      {consultations.map((c: any) => (
        <Link key={c.id} href={`/consultations/${c.id}`}
          className="block p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{c.motif || 'Consultation générale'}</p>
              <p className="text-sm text-gray-500">Dr {c.medecin?.prenom} {c.medecin?.nom}</p>
            </div>
            <p className="text-sm text-gray-400">
              {new Date(c.dateConsultation).toLocaleDateString('fr-MA')}
            </p>
          </div>
          {c.diagnostic && (
            <p className="text-sm text-gray-600 mt-2 truncate">Diag: {c.diagnostic}</p>
          )}
        </Link>
      ))}
    </div>
  );
}

function OrdonnancesTab({ ordonnances }: { ordonnances: any[] }) {
  const downloadPdf = async (id: string) => {
    const res = await apiClient.get(`/ordonnances/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  if (!ordonnances?.length) return (
    <p className="text-center text-gray-500 py-8">Aucune ordonnance</p>
  );
  return (
    <div className="space-y-3">
      {ordonnances.map((o: any) => (
        <div key={o.id}
          className="p-4 border border-gray-100 rounded-lg flex items-center justify-between hover:bg-gray-50">
          <div>
            <p className="font-medium text-sm">
              Ordonnance du {new Date(o.createdAt).toLocaleDateString('fr-MA')}
            </p>
            <p className="text-xs text-gray-500">{o.medecinNom}</p>
          </div>
          <button onClick={() => downloadPdf(o.id)}
            className="text-blue-600 text-sm hover:underline flex items-center gap-1">
            📄 PDF
          </button>
        </div>
      ))}
    </div>
  );
}

function DocumentsTab({ documents }: { documents: any[] }) {
  if (!documents?.length) return <p className="text-center text-gray-500 py-8">Aucun document</p>;
  return (
    <div className="space-y-2">
      {documents.map((d: any) => (
        <div key={d.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
          <span className="text-lg">📎</span>
          <span className="flex-1 text-sm text-gray-800">{d.nom}</span>
          <span className="text-xs text-gray-400">{d.type}</span>
          <a href={d.url} target="_blank" rel="noreferrer"
            className="text-blue-600 text-sm hover:underline">Ouvrir</a>
        </div>
      ))}
    </div>
  );
}

function RdvTab({ rdvList }: { rdvList: any[] }) {
  const STATUS_LABELS: Record<string, string> = {
    EN_ATTENTE: 'En attente', CONFIRME: 'Confirmé', ARRIVE: 'Arrivé',
    FACTURE: 'Facturé', ANNULE: 'Annulé',
  };
  const STATUS_COLORS: Record<string, string> = {
    EN_ATTENTE: 'bg-yellow-100 text-yellow-700', CONFIRME: 'bg-blue-100 text-blue-700',
    ARRIVE: 'bg-green-100 text-green-700', FACTURE: 'bg-purple-100 text-purple-700',
    ANNULE: 'bg-red-100 text-red-700',
  };

  if (!rdvList?.length) return <p className="text-center text-gray-500 py-8">Aucun rendez-vous</p>;
  return (
    <div className="space-y-3">
      {rdvList.map((rdv: any) => (
        <div key={rdv.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
          <div className="min-w-[110px]">
            <p className="text-sm font-medium">{new Date(rdv.dateHeure).toLocaleDateString('fr-MA')}</p>
            <p className="text-xs text-gray-500">
              {new Date(rdv.dateHeure).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <p className="flex-1 text-sm text-gray-700">{rdv.motif || 'Consultation'}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[rdv.statut] || ''}`}>
            {STATUS_LABELS[rdv.statut] || rdv.statut}
          </span>
        </div>
      ))}
    </div>
  );
}
