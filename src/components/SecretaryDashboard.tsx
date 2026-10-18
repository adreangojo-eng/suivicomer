import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  Business,
  BusinessMember,
  Loading,
  Commercial,
  AVAILABLE_PRODUCTS
} from '../types';
import { dataService } from '../services/dataService';
import { formatFCFA, formatTonnage, formatDateFr, matchesProduct, derivePaymentStatus } from '../utils/calculations';
import {
  Truck,
  Plus,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw
} from 'lucide-react';

interface SecretaryDashboardProps {
  user: UserProfile;
  business: Business;
  member: BusinessMember;
  onOpenLoadingModal: () => void;
  onOpenPaymentModal: (loading: Loading) => void;
}

export const SecretaryDashboard: React.FC<SecretaryDashboardProps> = ({
  user,
  business,
  member,
  onOpenLoadingModal,
  onOpenPaymentModal,
}) => {
  const [loadings, setLoadings] = useState<Loading[]>([]);
  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommFilter, setSelectedCommFilter] = useState('');
  const [selectedProdFilter, setSelectedProdFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  const refreshData = async () => {
    setLoadingData(true);
    try {
      const [l, c] = await Promise.all([
        dataService.getLoadings(business.id),
        dataService.getCommercials(business.id),
      ]);
      setLoadings(l);
      setCommercials(c);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [business.id]);

  const filteredLoadings = loadings.filter((l) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const matchVoucher = l.voucher_number?.toString().includes(q);
      const matchPlate = (l.truck_plate || '').toLowerCase().includes(q);
      const matchClient = (l.client_name || '').toLowerCase().includes(q);
      const matchRef = (l.payment_ref || '').toLowerCase().includes(q);
      const matchComm = (l.commercial_name || '').toLowerCase().includes(q);
      const matchProd = (l.product || '').toLowerCase().includes(q);
      if (!matchVoucher && !matchPlate && !matchClient && !matchRef && !matchComm && !matchProd) return false;
    }
    if (selectedCommFilter) {
      const selectedComm = commercials.find((c) => c.id === selectedCommFilter);
      const matchId = l.commercial_id === selectedCommFilter;
      const matchName =
        selectedComm &&
        l.commercial_name &&
        l.commercial_name.toLowerCase().trim() === selectedComm.full_name.toLowerCase().trim();
      if (!matchId && !matchName) return false;
    }
    if (selectedProdFilter && !matchesProduct(l.product, selectedProdFilter)) return false;
    if (selectedStatusFilter) {
      const status = derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid));
      if (status !== selectedStatusFilter) return false;
    }
    return true;
  });

  return (
    <div>
      {/* BOUTON D'ACTION RAPIDE GÉANT POUR MOBILE */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--slate-900), #172554)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.5rem',
          color: 'white',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white', marginBottom: '0.4rem' }}>
          Poste de Saisie — Secrétariat
        </h2>
        <p style={{ color: 'var(--slate-300)', fontSize: '0.85rem', maxWidth: '500px', marginBottom: '1.25rem' }}>
          Enregistrement immédiat des camions en pesée et chargement. Fonctionne à 100% sans connexion internet.
        </p>

        <button
          onClick={onOpenLoadingModal}
          className="btn btn-primary"
          style={{
            fontSize: '1.05rem',
            padding: '0.9rem 2rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 14px rgba(20, 184, 166, 0.4)',
          }}
        >
          <Plus size={22} />
          <span>Enregistrer un Chargement</span>
        </button>
      </div>

      {/* HISTORIQUE DU SECRÉTARIAT */}
      <div className="card-section">
        <div className="section-header">
          <div className="section-title">
            <Truck size={18} color="var(--primary-600)" />
            <span>Chargements Enregistrés ({filteredLoadings.length})</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={refreshData}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', minHeight: '32px' }}
              title="Rafraîchir"
              disabled={loadingData}
            >
              <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} />
              <span>Actualiser</span>
            </button>
            <div style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
              Permission paiement :{' '}
              <strong style={{ color: member.can_edit_payments ? 'var(--paid-text)' : 'var(--unpaid-text)' }}>
                {member.can_edit_payments ? 'Active' : "Désactivée"}
              </strong>
            </div>
          </div>
        </div>

        {/* FILTRES & RECHERCHE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Recherche (bon, plaque, client)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2rem' }}
            />
            <Search size={16} color="var(--slate-400)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>

          <select
            className="form-select"
            value={selectedCommFilter}
            onChange={(e) => setSelectedCommFilter(e.target.value)}
          >
            <option value="">Tous les commerciaux</option>
            {commercials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={selectedProdFilter}
            onChange={(e) => setSelectedProdFilter(e.target.value)}
          >
            <option value="">Tous les produits</option>
            {Array.from(new Set([...AVAILABLE_PRODUCTS, ...loadings.map((l) => l.product).filter(Boolean)])).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="form-select"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts de paiement</option>
            <option value="non_paye">Non Payé</option>
            <option value="partiellement_paye">Partiellement Payé</option>
            <option value="paye">Entièrement Payé</option>
          </select>
        </div>

        {filteredLoadings.length === 0 ? (
          <div className="empty-state">
            <Truck className="empty-icon" />
            <div className="empty-title">Aucun chargement enregistré</div>
            <div className="empty-desc">
              Utilisez le bouton ci-dessus pour enregistrer le premier camion de la journée.
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bon N°</th>
                  <th>Commercial</th>
                  <th>Produit</th>
                  <th>Plaque</th>
                  <th>Versement</th>
                  <th>Tonnage</th>
                  <th>Prix/t</th>
                  <th>Total Facturé</th>
                  <th>Montant Payé</th>
                  <th>Reste Dû</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoadings.map((l) => (
                  <tr key={l.id}>
                    <td>{formatDateFr(l.loading_date)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary-700)' }}>
                      #{l.voucher_number}
                    </td>
                    <td>{l.commercial_name || '-'}</td>
                    <td>{l.product}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{l.truck_plate}</td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                      {l.payment_ref || l.client_name || '-'}
                    </td>
                    <td>{formatTonnage(l.tonnage)}</td>
                    <td>{formatFCFA(l.price_per_ton)}</td>
                    <td style={{ fontWeight: 700 }}>{formatFCFA(l.total_amount)}</td>
                    <td style={{ color: 'var(--paid-text)', fontWeight: 600 }}>
                      {formatFCFA(l.amount_paid)}
                    </td>
                    <td style={{ color: l.remaining_due > 0 ? 'var(--unpaid-text)' : 'var(--slate-500)', fontWeight: 700 }}>
                      {formatFCFA(l.remaining_due)}
                    </td>
                    <td>
                      <span className={`payment-badge ${l.payment_status}`}>
                        {l.payment_status === 'paye'
                          ? 'Payé'
                          : l.payment_status === 'partiellement_paye'
                          ? 'Partiel'
                          : 'Non payé'}
                      </span>
                    </td>
                    <td>
                      {member.can_edit_payments ? (
                        <button
                          onClick={() => onOpenPaymentModal(l)}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.55rem', minHeight: '30px', fontSize: '0.74rem' }}
                          title="Modifier le montant payé"
                        >
                          <DollarSign size={13} />
                          <span>Paiement</span>
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--slate-400)' }}>Lecture seule</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
