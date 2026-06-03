'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

export default function StockPage() {
  const [showNouvelArticle, setShowNouvelArticle] = useState(false);
  const [mouvementArticle, setMouvementArticle] = useState<{ id: string; nom: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['stock'],
    queryFn: () => apiClient.get('/stock/articles').then(r => r.data),
  });

  const articleMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/stock/articles', data),
    onSuccess: () => {
      toast.success('Article ajouté');
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      setShowNouvelArticle(false);
    },
    onError: () => toast.error('Erreur lors de l\'ajout'),
  });

  const mouvementMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/stock/mouvements', data),
    onSuccess: () => {
      toast.success('Mouvement enregistré');
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setMouvementArticle(null);
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || 'Erreur lors du mouvement'),
  });

  const alertes = (articles as any[]).filter((a: any) => a.alerteStock);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Stock consommables</h1>
        <button
          onClick={() => setShowNouvelArticle(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
        >
          + Nouvel article
        </button>
      </div>

      {alertes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="font-semibold text-orange-800 mb-2">
            ⚠️ {alertes.length} article(s) sous le seuil d'alerte
          </p>
          <div className="flex flex-wrap gap-2">
            {alertes.map((a: any) => (
              <span
                key={a.id}
                className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium"
              >
                {a.nom}: <strong>{a.quantite}</strong> {a.unite} (seuil: {a.seuilAlerte})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Chargement du stock...</div>
        ) : (articles as any[]).length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p>Aucun article en stock</p>
            <button
              onClick={() => setShowNouvelArticle(true)}
              className="mt-3 text-blue-600 underline text-sm"
            >
              Ajouter le premier article
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Article</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Référence</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quantité</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Seuil</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Fournisseur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Prix unit.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(articles as any[]).map((a: any) => (
                <tr key={a.id} className={`hover:bg-gray-50 transition ${a.alerteStock ? 'bg-orange-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{a.nom}</p>
                    {a.description && <p className="text-xs text-gray-400">{a.description}</p>}
                    {a.alerteStock && (
                      <span className="text-xs text-orange-600 font-medium">⚠️ Stock faible</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-500 hidden sm:table-cell">{a.reference || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-lg font-bold ${
                        a.alerteStock ? 'text-orange-600' : 'text-gray-900'
                      }`}
                    >
                      {a.quantite}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">{a.unite}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                    {a.seuilAlerte} {a.unite}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{a.fournisseur || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
                    {a.prixUnitaire ? `${a.prixUnitaire} MAD` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setMouvementArticle({ id: a.id, nom: a.nom })}
                      className="text-blue-600 text-sm hover:underline"
                    >
                      Mouvement
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Modal nouvel article */}
      {showNouvelArticle && (
        <NouvelArticleModal
          onClose={() => setShowNouvelArticle(false)}
          onSubmit={(data) => articleMutation.mutate(data)}
          loading={articleMutation.isPending}
        />
      )}

      {/* Modal mouvement */}
      {mouvementArticle && (
        <MouvementModal
          articleNom={mouvementArticle.nom}
          onClose={() => setMouvementArticle(null)}
          onSubmit={(data) =>
            mouvementMutation.mutate({ ...data, articleId: mouvementArticle.id })
          }
          loading={mouvementMutation.isPending}
        />
      )}
    </div>
  );
}

function NouvelArticleModal({ onClose, onSubmit, loading }: any) {
  const { register, handleSubmit } = useForm<any>({
    defaultValues: { quantite: 0, seuilAlerte: 5, unite: 'unité' },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg mb-4">Nouvel article</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Nom *</label>
            <input
              {...register('nom', { required: true })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Référence</label>
              <input
                {...register('reference')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Unité</label>
              <input
                {...register('unite')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Quantité initiale</label>
              <input
                {...register('quantite')}
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Seuil d'alerte</label>
              <input
                {...register('seuilAlerte')}
                type="number"
                min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Fournisseur</label>
            <input
              {...register('fournisseur')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Prix unitaire (MAD)</label>
            <input
              {...register('prixUnitaire')}
              type="number"
              step="0.01"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {loading ? '...' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MouvementModal({ articleNom, onClose, onSubmit, loading }: any) {
  const [type, setType] = useState('ENTREE');
  const [quantite, setQuantite] = useState(1);
  const [motif, setMotif] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
        <h2 className="font-bold text-lg mb-1">Mouvement de stock</h2>
        <p className="text-sm text-gray-500 mb-4">{articleNom}</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Type de mouvement</label>
            <div className="flex gap-3 mt-2">
              {(['ENTREE', 'SORTIE'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    type === t
                      ? t === 'ENTREE'
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t === 'ENTREE' ? '↑ Entrée' : '↓ Sortie'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Quantité</label>
            <input
              type="number"
              min={1}
              value={quantite}
              onChange={e => setQuantite(parseInt(e.target.value) || 1)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Motif (optionnel)</label>
            <input
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Réapprovisionnement, utilisation acte..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
            Annuler
          </button>
          <button
            onClick={() => onSubmit({ type, quantite, motif: motif || undefined })}
            disabled={loading}
            className={`px-6 py-2 text-white rounded-lg text-sm disabled:opacity-50 transition ${
              type === 'ENTREE' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading ? '...' : type === 'ENTREE' ? 'Valider entrée' : 'Valider sortie'}
          </button>
        </div>
      </div>
    </div>
  );
}
