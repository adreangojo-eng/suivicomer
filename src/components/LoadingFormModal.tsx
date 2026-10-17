import React, { useState, useEffect } from 'react';
import {
  Commercial,
  LoadingVoucher,
  ProductItem,
  UserProfile,
  Business,
  Carriere,
  PAYMENT_REFERENCE_OPTIONS,
} from '../types';
import { dataService } from '../services/dataService';
import {
  calculateTotalAmount,
  calculateRemainingDue,
  derivePaymentStatus,
  formatFCFA
} from '../utils/calculations';
import { Truck, X, Plus, AlertCircle, Building2, Phone, Banknote, RefreshCw } from 'lucide-react';
import { ProductsModal } from './ProductsModal';

interface LoadingFormModalProps {
  business: Business;
  carriere?: Carriere | null;
  user: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const LoadingFormModal: React.FC<LoadingFormModalProps> = ({
  business,
  carriere,
  user,
  onClose,
  onSuccess,
}) => {
  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [selectedCommercialId, setSelectedCommercialId] = useState<string>('');
  const [availableVouchers, setAvailableVouchers] = useState<LoadingVoucher[]>([]);
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>('');

  // Produits dynamiques et tarification automatique
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showProductsModal, setShowProductsModal] = useState(false);

  const [loadingDate, setLoadingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [product, setProduct] = useState<string>('Sable 0/5');
  const [truckPlate, setTruckPlate] = useState<string>('');
  const [tonnage, setTonnage] = useState<string>('15');
  const [pricePerTon, setPricePerTon] = useState<string>('8000');
  const [amountPaid, setAmountPaid] = useState<string>('0');
  const [paymentRef, setPaymentRef] = useState<string>('Espèces');

  const [submitting, setSubmitting] = useState(false);
  const [loadingVouchersState, setLoadingVouchersState] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Charger les produits personnalisés et leurs tarifs pré-enregistrés
  const loadProductsList = async () => {
    try {
      const items = await dataService.getProducts(business.id, carriere?.id);
      setProducts(items);
      if (items.length > 0) {
        setProduct(items[0].name);
        setPricePerTon(items[0].default_price_per_ton.toString());
      }
    } catch {}
  };

  useEffect(() => {
    loadProductsList();
  }, [business.id, carriere?.id]);

  // Charger les commerciaux actifs de la carrière
  useEffect(() => {
    dataService.getCommercials(business.id, carriere?.id).then((comms) => {
      const active = comms.filter((c) => c.is_active);
      setCommercials(active);
      if (active.length > 0) {
        setSelectedCommercialId(active[0].id);
      }
    });
  }, [business.id, carriere?.id]);

  // Charger les bons disponibles lorsque le commercial sélectionné change
  const refreshVouchers = async (commId: string) => {
    if (!commId) {
      setAvailableVouchers([]);
      setSelectedVoucherId('');
      return;
    }

    setLoadingVouchersState(true);
    try {
      const vouchers = await dataService.getAvailableVouchersForCommercial(
        business.id,
        commId,
        carriere?.id
      );
      setAvailableVouchers(vouchers);
      if (vouchers.length > 0) {
        setSelectedVoucherId(vouchers[0].id);
      } else {
        setSelectedVoucherId('');
      }
    } finally {
      setLoadingVouchersState(false);
    }
  };

  useEffect(() => {
    refreshVouchers(selectedCommercialId);
  }, [business.id, selectedCommercialId, carriere?.id]);

  // Gestion du changement de produit -> remplit automatiquement le prix pré-enregistré
  const handleProductChange = (chosenName: string) => {
    setProduct(chosenName);
    const found = products.find((p) => p.name === chosenName);
    if (found && found.default_price_per_ton !== undefined) {
      setPricePerTon(found.default_price_per_ton.toString());
    }
  };

  // Calculs financiers instantanés
  const numTonnage = parseFloat(tonnage) || 0;
  const numPrice = parseFloat(pricePerTon) || 0;
  const numPaid = parseFloat(amountPaid) || 0;

  const totalAmount = calculateTotalAmount(numTonnage, numPrice);
  const remainingDue = calculateRemainingDue(totalAmount, numPaid);
  const paymentStatus = derivePaymentStatus(totalAmount, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedCommercialId) {
      setErrorMsg('Veuillez sélectionner un commercial.');
      return;
    }

    if (!selectedVoucherId) {
      setErrorMsg("Aucun bon disponible pour ce commercial. Veuillez d'abord attribuer une plage de bons.");
      return;
    }

    const selectedVoucher = availableVouchers.find((v) => v.id === selectedVoucherId);
    if (!selectedVoucher) {
      setErrorMsg('Bon sélectionné invalide.');
      return;
    }

    if (!truckPlate.trim()) {
      setErrorMsg("La plaque d'immatriculation du camion est obligatoire.");
      return;
    }

    if (numTonnage <= 0) {
      setErrorMsg('Le tonnage doit être strictement supérieur à 0.');
      return;
    }

    if (numPrice < 0) {
      setErrorMsg('Le prix par tonne ne peut pas être négatif.');
      return;
    }

    if (numPaid < 0 || numPaid > totalAmount) {
      setErrorMsg(`Le montant payé doit être entre 0 et le total (${formatFCFA(totalAmount)}).`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await dataService.createLoading({
        businessId: business.id,
        carriereId: carriere?.id,
        commercialId: selectedCommercialId,
        voucherId: selectedVoucher.id,
        voucherNumber: selectedVoucher.voucher_number,
        loadingDate,
        product,
        truckPlate,
        tonnage: numTonnage,
        pricePerTon: numPrice,
        amountPaid: numPaid,
        paymentRef: paymentRef.trim() || undefined,
        userId: user.id,
      });

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || "Erreur lors de l'enregistrement du chargement.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-card" style={{ maxWidth: '640px' }}>
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'var(--primary-100)',
                  color: 'var(--primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Truck size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Nouveau Chargement</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                  {carriere ? `Carrière : ${carriere.name}` : business.name}
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

          <form onSubmit={handleSubmit}>
            {/* ÉTAPE 1 : Commercial & Bon */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Commercial concerné *</label>
                <select
                  className="form-select"
                  value={selectedCommercialId}
                  onChange={(e) => setSelectedCommercialId(e.target.value)}
                  required
                >
                  {commercials.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Numéro du Bon * ({availableVouchers.length} dispo.)
                  </label>
                  <button
                    type="button"
                    onClick={() => refreshVouchers(selectedCommercialId)}
                    title="Actualiser les bons disponibles"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-600)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                    }}
                  >
                    <RefreshCw size={12} className={loadingVouchersState ? 'spin' : ''} />
                    <span>Actualiser</span>
                  </button>
                </div>

                {availableVouchers.length > 0 ? (
                  <select
                    className="form-select"
                    value={selectedVoucherId}
                    onChange={(e) => setSelectedVoucherId(e.target.value)}
                    required
                  >
                    {availableVouchers.map((v) => (
                      <option key={v.id} value={v.id}>
                        Bon n° {v.voucher_number} (Disponible)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: '#fef2f2',
                      border: '1.5px solid #fecaca',
                      borderRadius: 'var(--radius-md)',
                      color: '#991b1b',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                    }}
                  >
                    {loadingVouchersState
                      ? 'Recherche des bons en cours...'
                      : '0 bon disponible pour ce commercial. Veuillez lui attribuer une plage de bons.'}
                  </div>
                )}
              </div>
            </div>

            {/* ÉTAPE 2 : Date & Plaque du camion */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date du chargement *</label>
                <input
                  type="date"
                  className="form-input"
                  value={loadingDate}
                  onChange={(e) => setLoadingDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Plaque d'immatriculation du camion *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: LT-8899-AA"
                  value={truckPlate}
                  onChange={(e) => setTruckPlate(e.target.value.toUpperCase())}
                  required
                />
              </div>
            </div>

            {/* ÉTAPE 3 : Produit avec auto-remplissage du prix pré-enregistré */}
            <div className="form-row">
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Produit sélectionné *</label>
                  <button
                    type="button"
                    onClick={() => setShowProductsModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-600)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                    }}
                  >
                    <Plus size={13} />
                    <span>Nouveau produit / Tarifs</span>
                  </button>
                </div>

                <select
                  className="form-select"
                  value={product}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({formatFCFA(p.default_price_per_ton)} / T)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tonnage chargé (en tonnes) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  className="form-input"
                  value={tonnage}
                  onChange={(e) => setTonnage(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* ÉTAPE 4 : Prix par tonne (auto-rempli) & Montant déjà payé */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Prix par tonne (FCFA) *{' '}
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary-600)', fontWeight: 600 }}>
                    (auto-rempli selon produit)
                  </span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-input"
                  value={pricePerTon}
                  onChange={(e) => setPricePerTon(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Montant déjà payé (FCFA)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={totalAmount}
                  className="form-input"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            </div>

            {/* ÉTAPE 5 : Référence du versement (3 options interactives en accès direct) */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '0.45rem' }}>
                Référence / Mode de versement *
              </label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                {/* Option 1 : Versé dans le compte */}
                <button
                  type="button"
                  onClick={() => setPaymentRef('Versé dans le compte')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.65rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: paymentRef.startsWith('Versé dans le compte')
                      ? '2px solid var(--primary-600)'
                      : '1.5px solid var(--slate-200)',
                    background: paymentRef.startsWith('Versé dans le compte')
                      ? 'var(--primary-50)'
                      : 'white',
                    color: paymentRef.startsWith('Versé dans le compte')
                      ? 'var(--primary-800)'
                      : 'var(--slate-700)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Building2 size={16} color={paymentRef.startsWith('Versé dans le compte') ? 'var(--primary-600)' : 'var(--slate-400)'} />
                  <span>Versé dans le compte</span>
                </button>

                {/* Option 2 : Dépôt par téléphone */}
                <button
                  type="button"
                  onClick={() => setPaymentRef('Dépôt par téléphone')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.65rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: paymentRef.startsWith('Dépôt par téléphone')
                      ? '2px solid var(--primary-600)'
                      : '1.5px solid var(--slate-200)',
                    background: paymentRef.startsWith('Dépôt par téléphone')
                      ? 'var(--primary-50)'
                      : 'white',
                    color: paymentRef.startsWith('Dépôt par téléphone')
                      ? 'var(--primary-800)'
                      : 'var(--slate-700)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Phone size={16} color={paymentRef.startsWith('Dépôt par téléphone') ? 'var(--primary-600)' : 'var(--slate-400)'} />
                  <span>Dépôt par téléphone</span>
                </button>

                {/* Option 3 : Espèces */}
                <button
                  type="button"
                  onClick={() => setPaymentRef('Espèces')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.65rem 0.5rem',
                    borderRadius: 'var(--radius-md)',
                    border: paymentRef.startsWith('Espèces')
                      ? '2px solid var(--primary-600)'
                      : '1.5px solid var(--slate-200)',
                    background: paymentRef.startsWith('Espèces')
                      ? 'var(--primary-50)'
                      : 'white',
                    color: paymentRef.startsWith('Espèces')
                      ? 'var(--primary-800)'
                      : 'var(--slate-700)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Banknote size={16} color={paymentRef.startsWith('Espèces') ? 'var(--primary-600)' : 'var(--slate-400)'} />
                  <span>Espèces</span>
                </button>
              </div>

              {/* Champ texte complémentaire pour précision optionnelle */}
              <input
                type="text"
                className="form-input"
                placeholder="Précision optionnelle (ex: Virement UBA, Orange Money, etc.)"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>

            {/* RÉCAPITULATIF FINANCIER EN DIRECT */}
            <div className="summary-calc-box">
              <div className="calc-row">
                <span style={{ color: 'var(--slate-500)' }}>Montant Total (Tonnage × Prix) :</span>
                <span style={{ fontWeight: 700 }}>{formatFCFA(totalAmount)}</span>
              </div>
              <div className="calc-row">
                <span style={{ color: 'var(--slate-500)' }}>Montant déjà payé :</span>
                <span style={{ fontWeight: 700, color: 'var(--paid-text)' }}>
                  {formatFCFA(numPaid)}
                </span>
              </div>
              <div className="calc-row total">
                <span>Reste à payer :</span>
                <span style={{ color: remainingDue > 0 ? 'var(--unpaid-text)' : 'var(--paid-text)' }}>
                  {formatFCFA(remainingDue)}
                </span>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>Statut calculé :</span>
                <span className={`payment-badge ${paymentStatus}`}>
                  {paymentStatus === 'paye'
                    ? 'Entièrement Payé'
                    : paymentStatus === 'partiellement_paye'
                    ? 'Partiellement Payé'
                    : 'Non Payé'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting || availableVouchers.length === 0}
                className="btn btn-primary"
                style={{ flex: 2 }}
              >
                {submitting ? 'Enregistrement...' : 'Enregistrer le chargement'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showProductsModal && (
        <ProductsModal
          business={business}
          carriere={carriere}
          user={user}
          onClose={() => setShowProductsModal(false)}
          onProductsUpdated={loadProductsList}
        />
      )}
    </>
  );
};
