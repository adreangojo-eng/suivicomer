import React, { useState, useEffect } from 'react';
import { Commercial, Business, Carriere, UserProfile } from '../types';
import { dataService } from '../services/dataService';
import { validateRange } from '../utils/calculations';
import { Layers, X, AlertCircle } from 'lucide-react';

interface BonRangeModalProps {
  business: Business;
  carriere?: Carriere | null;
  user: UserProfile;
  onClose: () => void;
  onSuccess: () => void;
}

export const BonRangeModal: React.FC<BonRangeModalProps> = ({
  business,
  carriere,
  user,
  onClose,
  onSuccess,
}) => {
  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [selectedCommercialId, setSelectedCommercialId] = useState<string>('');
  const [startNum, setStartNum] = useState<string>('');
  const [endNum, setEndNum] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    dataService.getCommercials(business.id, carriere?.id).then((comms) => {
      const active = comms.filter((c) => c.is_active);
      setCommercials(active);
      if (active.length > 0) {
        setSelectedCommercialId(active[0].id);
      }
    });
  }, [business.id, carriere?.id]);

  const numStart = parseInt(startNum, 10);
  const numEnd = parseInt(endNum, 10);

  const rangeVal = validateRange(numStart, numEnd);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedCommercialId) {
      setErrorMsg('Veuillez sélectionner un commercial.');
      return;
    }

    if (!rangeVal.valid) {
      setErrorMsg(rangeVal.error || 'Plage de numéros invalide.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await dataService.attributeBonRange({
        businessId: business.id,
        carriereId: carriere?.id,
        commercialId: selectedCommercialId,
        startNum: numStart,
        endNum: numEnd,
        userId: user.id,
      });

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || "Erreur lors de l'attribution de la plage.");
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
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Attribuer une Plage de Bons</h3>
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
          <div className="form-group">
            <label className="form-label">Commercial bénéficiaire *</label>
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

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Numéro de début *</label>
              <input
                type="number"
                min="1"
                step="1"
                className="form-input"
                placeholder="Ex: 2000"
                value={startNum}
                onChange={(e) => setStartNum(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Numéro de fin *</label>
              <input
                type="number"
                min="1"
                step="1"
                className="form-input"
                placeholder="Ex: 2050"
                value={endNum}
                onChange={(e) => setEndNum(e.target.value)}
                required
              />
            </div>
          </div>

          {/* APERÇU ET CONTRÔLE DE LA PLAGE */}
          <div className="summary-calc-box">
            <div className="calc-row">
              <span style={{ color: 'var(--slate-500)' }}>Plage inclusive demandée :</span>
              <span style={{ fontWeight: 700 }}>
                {startNum && endNum ? `${startNum} → ${endNum}` : '-'}
              </span>
            </div>
            <div className="calc-row total">
              <span>Total de bons à générer :</span>
              <span style={{ color: rangeVal.valid ? 'var(--primary-700)' : 'var(--unpaid-text)' }}>
                {rangeVal.valid ? `${rangeVal.count} bons individuels` : 'Plage invalide'}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
            ℹ️ Règle absolue d'intégrité : Chaque numéro de bon sera créé individuellement avec le statut <strong>Disponible</strong>. Aucun chevauchement avec une plage existante ne sera autorisé.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
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
              disabled={submitting || !rangeVal.valid || commercials.length === 0}
              className="btn btn-primary"
              style={{ flex: 2 }}
            >
              {submitting ? 'Génération...' : "Valider l'attribution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
