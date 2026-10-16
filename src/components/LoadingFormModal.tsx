import React, { useState, useEffect } from 'react';
import {
  Commercial,
  LoadingVoucher,
  ProductType,
  AVAILABLE_PRODUCTS,
  UserProfile,
  Business,
  Carriere
} from '../types';
import { dataService } from '../services/dataService';
import {
  calculateTotalAmount,
  calculateRemainingDue,
  derivePaymentStatus,
  formatFCFA
} from '../utils/calculations';
import { Truck, X, CheckCircle2, AlertCircle } from 'lucide-react';

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

  const [loadingDate, setLoadingDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [product, setProduct] = useState<ProductType>('Gravier 5/15');
  const [truckPlate, setTruckPlate] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [tonnage, setTonnage] = useState<string>('15');
  const [pricePerTon, setPricePerTon] = useState<string>('10000');
  const [amountPaid, setAmountPaid] = useState<string>('0');
  const [paymentRef, setPaymentRef] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Charger les bons disponibles lorsque le commercial change
  useEffect(() => {
    if (!selectedCommercialId) {
      setAvailableVouchers([]);
      setSelectedVoucherId('');
      return;
    }

    dataService
      .getAvailableVouchersForCommercial(business.id, selectedCommercialId, carriere?.id)
      .then((vouchers) => {
        setAvailableVouchers(vouchers);
        if (vouchers.length > 0) {
          setSelectedVoucherId(vouchers[0].id);
        } else {
          setSelectedVoucherId('');
        }
      });
  }, [business.id, selectedCommercialId, carriere?.id]);

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

    if (!clientName.trim()) {
      setErrorMsg('Le nom du client est obligatoire.');
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
        clientName,
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
    <div className="modal-overlay">
      <div className="modal-card">
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
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Numéro du Bon * ({availableVouchers.length} dispo.)
              </label>
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
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Aucun bon disponible pour ce commercial dans cette carrière
                </div>
              )}
            </div>
          </div>

          {/* ÉTAPE 2 : Date & Produit */}
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
              <label className="form-label">Produit *</label>
              <select
                className="form-select"
                value={product}
                onChange={(e) => setProduct(e.target.value as ProductType)}
                required
              >
                {AVAILABLE_PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ÉTAPE 3 : Plaque & Client */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Plaque du camion *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: 1234-AB-01"
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nom du client *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: BTP Ivoire SARL"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* ÉTAPE 4 : Tonnage & Prix par tonne */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Tonnage (en tonnes) *</label>
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

            <div className="form-group">
              <label className="form-label">Prix par tonne (FCFA) *</label>
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
          </div>

          {/* ÉTAPE 5 : Montant déjà payé & Référence de versement */}
          <div className="form-row">
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

            <div className="form-group">
              <label className="form-label">Référence du versement</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Espèces / Virement #1092"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>
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
  );
};
