'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

const TABS = ['Profil', 'Consultations', 'Ordonnances', 'Documents', 'RDV'];

export default function PatientDetailPage({ params }: { params: { id: string } }) {
  const [tab, setTab] = useState(0);
  const { user } = useAuthStore();

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', params.id],
    queryFn: () => apiClient.get(`/patients/${params.id}`).then(r => r.data),
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement de la fiche...</div>;
  if (!patient) return <div className="p-8 text-center text-red-500">Patient introuvable</div>;

  const canCreateConsultation = user?.role !== 'SECRETAIRE';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/patients" className="text-gray-400 hover:text-gray-600 text-sm">← Retour</Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{patient.prenom} {patient.nom}</h1>
            <p className="text-gray-500 text-sm">
              {patient.telephone} · {patient.ville || '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href={`/patients/${params.id}/modifier`}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition">
            Modifier
          </Link>
          {canCreateConsultation && (
            <Link href={`/consultations/nouvelle?patientId=${params.id}`}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
              + Consultation
            </Link>
          )}
        </div>
      </div>

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
          {tab === 1 && <ConsultationsTab consultations={patient.consultations} patientId={params.id} canCreate={canCreateConsultation} />}
          {tab === 2 && <OrdonnancesTab ordonnances={patient.ordonnances} />}
          {tab === 3 && <DocumentsTab patientId={params.id} />}
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

function ConsultationsTab({ consultations, patientId, canCreate }: { consultations: any[]; patientId: string; canCreate: boolean }) {
  if (!consultations?.length) return (
    <div className="text-center py-8">
      <p className="text-gray-500 mb-4">Aucune consultation enregistrée</p>
      {canCreate && (
        <Link href={`/consultations/nouvelle?patientId=${patientId}`}
          className="text-blue-600 underline text-sm">
          Créer une consultation
        </Link>
      )}
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

function DocumentsTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ['documents', patientId],
    queryFn: () => apiClient.get(`/documents/patient/${patientId}`).then(r => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      form.append('patientId', patientId);
      return apiClient.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success('Document ajouté');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Erreur lors de l\'upload'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', patientId] });
      queryClient.invalidateQueries({ queryKey: ['patient', patientId] });
      toast.success('Document supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).forEach(f => uploadMutation.mutate(f));
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return '📄';
    if (type.startsWith('image/')) return '🖼️';
    return '📎';
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-4">
      {/* Zone de drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        } ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-2xl mb-2">📁</p>
        <p className="text-sm font-medium text-gray-700">
          {uploadMutation.isPending ? 'Envoi en cours...' : 'Glisser-déposer ou cliquer pour ajouter'}
        </p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF · max 10 Mo</p>
      </div>

      {/* Liste des documents */}
      {isLoading ? (
        <p className="text-center text-gray-400 py-4">Chargement...</p>
      ) : documents.length === 0 ? (
        <p className="text-center text-gray-400 py-4">Aucun document</p>
      ) : (
        <div className="space-y-2">
          {documents.map((d: any) => (
            <div key={d.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 group">
              <span className="text-xl shrink-0">{getFileIcon(d.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{d.nom}</p>
                <p className="text-xs text-gray-400">
                  {new Date(d.createdAt).toLocaleDateString('fr-MA')}
                  {d.taille ? ` · ${formatSize(d.taille)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 text-xs hover:underline px-2 py-1 rounded hover:bg-blue-50"
                >
                  Ouvrir
                </a>
                <button
                  onClick={() => {
                    if (confirm(`Supprimer "${d.nom}" ?`)) deleteMutation.mutate(d.id);
                  }}
                  className="text-red-400 text-xs hover:text-red-600 px-2 py-1 rounded hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
