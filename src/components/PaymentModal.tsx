import React, { useState } from 'react';
import { Loading, BusinessMember } from '../types';
import { dataService } from '../services/dataService';
import { calculateRemainingDue, derivePaymentStatus, formatFCFA } from '../utils/calculations';
import { DollarSign, X, AlertCircle } from 'lucide-react';

interface PaymentModalProps {
  loading: Loading;
  member: BusinessMember;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  loading,
  member,
  onClose,
  onSuccess,
}) => {
  const [amountPaid, setAmountPaid] = useState<string>(loading.amount_paid.toString());
  const [paymentRef, setPaymentRef] = useState<string>(loading.payment_ref || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const numPaid = parseFloat(amountPaid) || 0;
  const remainingDue = calculateRemainingDue(loading.total_amount, numPaid);
  const paymentStatus = derivePaymentStatus(loading.total_amount, numPaid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numPaid < 0 || numPaid > loading.total_amount) {
      setErrorMsg(`Le montant payé doit être entre 0 et ${formatFCFA(loading.total_amount)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await dataService.updatePayment({
        loadingId: loading.id,
        businessId: loading.business_id,
        amountPaid: numPaid,
        paymentRef: paymentRef.trim() || undefined,
        userRole: member.role,
        canEditPayments: member.can_edit_payments,
      });

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || 'Erreur lors de la mise à jour du paiement.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'var(--paid-bg)',
                color: 'var(--paid-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Mettre à Jour le Paiement</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                Bon n° {loading.voucher_number} • {loading.client_name}
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
          <div className="summary-calc-box">
            <div className="calc-row">
              <span style={{ color: 'var(--slate-500)' }}>Montant Total du Chargement :</span>
              <span style={{ fontWeight: 800 }}>{formatFCFA(loading.total_amount)}</span>
            </div>
            <div className="calc-row">
              <span style={{ color: 'var(--slate-500)' }}>Produit & Tonnage :</span>
              <span>{loading.product} ({loading.tonnage} t)</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nouveau Montant Déjà Payé (FCFA) *</label>
            <input
              type="number"
              min="0"
              max={loading.total_amount}
              step="1"
              className="form-input"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Référence du versement (optionnel)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ex: Virement bancaire / Espèces reçu par secrétaire"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
            />
          </div>

          <div className="summary-calc-box">
            <div className="calc-row total">
              <span>Nouveau Reste à Payer :</span>
              <span style={{ color: remainingDue > 0 ? 'var(--unpaid-text)' : 'var(--paid-text)' }}>
                {formatFCFA(remainingDue)}
              </span>
            </div>
            <div style={{ marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Nouveau Statut Dérivé :</span>
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
              disabled={submitting}
              className="btn btn-primary"
              style={{ flex: 1.5 }}
            >
              {submitting ? 'Validation...' : 'Enregistrer le paiement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
