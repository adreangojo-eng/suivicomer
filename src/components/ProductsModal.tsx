import React, { useState, useEffect } from 'react';
import { Business, Carriere, ProductItem, UserProfile } from '../types';
import { dataService } from '../services/dataService';
import { formatFCFA } from '../utils/calculations';
import { Package, Plus, Trash2, X, AlertCircle, CheckCircle2, Tag } from 'lucide-react';

interface ProductsModalProps {
  business: Business;
  carriere?: Carriere | null;
  user: UserProfile;
  onClose: () => void;
  onProductsUpdated?: () => void;
}

export const ProductsModal: React.FC<ProductsModalProps> = ({
  business,
  carriere,
  user,
  onClose,
  onProductsUpdated,
}) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulaire d'ajout
  const [name, setName] = useState('');
  const [pricePerTon, setPricePerTon] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const items = await dataService.getProducts(business.id, carriere?.id);
      setProducts(items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [business.id, carriere?.id]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('Veuillez renseigner le nom du produit.');
      return;
    }

    const price = parseFloat(pricePerTon);
    if (isNaN(price) || price < 0) {
      setErrorMsg('Veuillez renseigner un prix par tonne valide (nombre positif).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await dataService.createProduct({
        businessId: business.id,
        carriereId: carriere?.id,
        name: trimmedName,
        defaultPricePerTon: price,
      });

      if (res.success) {
        setSuccessMsg(`Produit "${trimmedName}" ajouté avec succès à ${formatFCFA(price)} / tonne.`);
        setName('');
        setPricePerTon('');
        await loadProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        setErrorMsg(res.error || "Impossible d'ajouter ce produit.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string, prodName: string) => {
    if (!window.confirm(`Confirmez-vous la suppression du produit "${prodName}" ?`)) return;

    try {
      const res = await dataService.deleteProduct(id);
      if (res.success) {
        await loadProducts();
        if (onProductsUpdated) onProductsUpdated();
      } else {
        setErrorMsg(res.error || 'Erreur lors de la suppression.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur inattendue.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--primary-100)',
                color: 'var(--primary-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Catalogue des Produits & Tarifs</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                {carriere ? `Carrière : ${carriere.name}` : business.name} • Tarification par tonne
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="banner-alert" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            className="banner-alert"
            style={{
              marginBottom: '1rem',
              background: 'var(--paid-bg)',
              borderColor: 'var(--paid-border)',
              color: 'var(--paid-text)',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* FORMULAIRE D'AJOUT RAPIDE */}
        <form
          onSubmit={handleAddProduct}
          style={{
            background: 'var(--slate-50)',
            border: '1.5px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.65rem', color: 'var(--slate-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Tag size={16} color="var(--primary-600)" />
            <span>Ajouter un nouveau produit & fixer son prix</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px auto', gap: '0.75rem', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Nom du produit *</label>
              <input
                type="text"
                className="form-input"
                placeholder="ex: Sable 0/5, Gravier 0/14..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Prix / Tonne (FCFA) *</label>
              <input
                type="number"
                min="0"
                step="100"
                className="form-input"
                placeholder="ex: 8500"
                value={pricePerTon}
                onChange={(e) => setPricePerTon(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ minHeight: '42px', padding: '0 1rem', whiteSpace: 'nowrap' }}
            >
              <Plus size={16} />
              <span>{submitting ? 'Ajout...' : 'Ajouter'}</span>
            </button>
          </div>
        </form>

        {/* LISTE DES PRODUITS DISPONIBLES */}
        <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
            Produits enregistrés ({products.length})
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)' }}>
              Chargement des produits...
            </div>
          ) : products.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.5rem' }}>
              <Package className="empty-icon" />
              <div className="empty-title">Aucun produit configuré</div>
              <div className="empty-desc">Ajoutez votre premier produit avec son prix par tonne ci-dessus.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {products.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'white',
                    border: '1.5px solid var(--slate-200)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'var(--slate-100)',
                        color: 'var(--slate-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      📦
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{p.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                        Pré-enregistré pour la carrière
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '1rem',
                        color: 'var(--primary-700)',
                        background: 'var(--primary-50)',
                        padding: '0.25rem 0.65rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--primary-200)',
                      }}
                    >
                      {formatFCFA(p.default_price_per_ton)} <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>/ T</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id, p.name)}
                      className="btn btn-secondary"
                      title="Supprimer ce produit"
                      style={{
                        padding: '0.35rem 0.5rem',
                        color: 'var(--unpaid-text)',
                        borderColor: 'var(--unpaid-border)',
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} className="btn btn-primary" style={{ width: '100%' }}>
            Fermer & Retourner au suivi
          </button>
        </div>
      </div>
    </div>
  );
};
