import React, { useState, useEffect } from 'react';
import { SyncConflict, LoadingVoucher, Business } from '../types';
import { syncEngine } from '../services/syncEngine';
import { offlineStorage } from '../services/offlineDb';
import { dataService } from '../services/dataService';
import { AlertTriangle, X, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ConflictsModalProps {
  business: Business;
  onClose: () => void;
  onResolved: () => void;
}

export const ConflictsModal: React.FC<ConflictsModalProps> = ({
  business,
  onClose,
  onResolved,
}) => {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [availableVouchers, setAvailableVouchers] = useState<Record<string, LoadingVoucher[]>>({});
  const [selectedReplacements, setSelectedReplacements] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadConflicts = async () => {
    const list = await offlineStorage.getUnresolvedConflicts();
    setConflicts(list);

    // Charger les bons disponibles pour chaque commercial en conflit
    const vouchersMap: Record<string, LoadingVoucher[]> = {};
    for (const c of list) {
      const commId = c.payload?.commercial_id;
      if (commId && !vouchersMap[commId]) {
        const free = await dataService.getAvailableVouchersForCommercial(business.id, commId);
        vouchersMap[commId] = free;
      }
    }
    setAvailableVouchers(vouchersMap);
  };

  useEffect(() => {
    loadConflicts();
  }, [business.id]);

  const handleResolve = async (conflict: SyncConflict) => {
    const commId = conflict.payload?.commercial_id;
    const replacementVoucherId = selectedReplacements[conflict.id];
    const freeList = vouchersMap(commId);

    const chosenVoucher = freeList.find((v) => v.id === replacementVoucherId) || freeList[0];
    if (!chosenVoucher) {
      alert("Aucun autre bon disponible pour ce commercial. Veuillez d'abord lui attribuer une nouvelle plage de bons.");
      return;
    }

    setResolvingId(conflict.id);
    try {
      await syncEngine.resolveConflictWithNewVoucher(conflict.id, chosenVoucher);
      await loadConflicts();
      onResolved();
    } finally {
      setResolvingId(null);
    }
  };

  const vouchersMap = (commId?: string) => {
    if (!commId) return [];
    return availableVouchers[commId] || [];
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
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Résolution des Conflits Réseau</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                Détection de bons déjà consommés pendant une coupure réseau
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        {conflicts.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <CheckCircle2 size={42} color="#10b981" style={{ marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 700, color: 'var(--slate-800)' }}>
              Aucun conflit en cours
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--slate-500)' }}>
              Toutes vos opérations hors ligne ont été synchronisées sans collision.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {conflicts.map((c) => {
              const commId = c.payload?.commercial_id;
              const freeList = vouchersMap(commId);

              return (
                <div
                  key={c.id}
                  style={{
                    border: '1.5px solid #fca5a5',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    background: '#fff5f5',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.9rem' }}>
                    {c.message}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--slate-600)', margin: '0.35rem 0 0.75rem 0' }}>
                    Client : <strong>{c.payload?.client_name}</strong> • Plaque : <strong>{c.payload?.truck_plate}</strong> • Montant : <strong>{c.payload?.total_amount} FCFA</strong>
                  </div>

                  <div style={{ marginTop: '0.5rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>
                      Sélectionner un nouveau bon disponible pour ce chargement :
                    </label>
                    {freeList.length > 0 ? (
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <select
                          className="form-select"
                          style={{ flex: 1, minHeight: '40px' }}
                          value={selectedReplacements[c.id] || freeList[0]?.id}
                          onChange={(e) =>
                            setSelectedReplacements({ ...selectedReplacements, [c.id]: e.target.value })
                          }
                        >
                          {freeList.map((v) => (
                            <option key={v.id} value={v.id}>
                              Bon n° {v.voucher_number} (Disponible)
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={resolvingId === c.id}
                          onClick={() => handleResolve(c)}
                          className="btn btn-primary"
                          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
                        >
                          <RefreshCw size={14} />
                          <span>{resolvingId === c.id ? 'Résolution...' : 'Réassigner & Synchroniser'}</span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                        Aucun bon libre disponible pour ce commercial. Attribuez-lui une nouvelle plage d'abord.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
