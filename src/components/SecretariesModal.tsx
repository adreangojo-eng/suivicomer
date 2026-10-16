import React, { useState, useEffect } from 'react';
import { BusinessMember, Business } from '../types';
import { dataService } from '../services/dataService';
import { ShieldCheck, X, Check, Lock, Unlock, AlertCircle } from 'lucide-react';

interface SecretariesModalProps {
  business: Business;
  onClose: () => void;
  onUpdated: () => void;
}

export const SecretariesModal: React.FC<SecretariesModalProps> = ({
  business,
  onClose,
  onUpdated,
}) => {
  const [secretaries, setSecretaries] = useState<BusinessMember[]>([]);

  const loadData = () => {
    dataService.getSecretaries(business.id).then(setSecretaries);
  };

  useEffect(() => {
    loadData();
  }, [business.id]);

  const handleTogglePaymentPermission = async (id: string, current: boolean) => {
    await dataService.toggleSecretaryPaymentPermission(id, !current);
    loadData();
    onUpdated();
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
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Gestion des Secrétaires</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                Contrôle des permissions et des modifications de paiements
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: 'var(--slate-600)' }}>
          Les secrétaires ont accès à la saisie rapide des chargements. L'agréé peut configurer individuellement pour chaque secrétaire le droit de modifier les montants payés.
        </div>

        {secretaries.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem 1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--slate-700)' }}>
              Aucun secrétaire invité pour le moment
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
              Lorsqu'un compte secrétaire est créé par l'agréé, il apparaît ici avec ses droits configurables.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {secretaries.map((sec) => (
              <div
                key={sec.id}
                style={{
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {sec.profile?.full_name || 'Secrétaire'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    Statut : {sec.is_active ? 'Actif' : 'Inactif'} • Modification paiement :{' '}
                    <strong style={{ color: sec.can_edit_payments ? 'var(--paid-text)' : 'var(--unpaid-text)' }}>
                      {sec.can_edit_payments ? 'Autorisée' : 'Interdite'}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTogglePaymentPermission(sec.id, sec.can_edit_payments)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.75rem', minHeight: '36px' }}
                >
                  {sec.can_edit_payments ? (
                    <>
                      <Lock size={14} color="#dc2626" />
                      <span>Interdire modification</span>
                    </>
                  ) : (
                    <>
                      <Unlock size={14} color="#16a34a" />
                      <span>Autoriser modification</span>
                    </>
                  )}
                </button>
              </div>
            ))}
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
