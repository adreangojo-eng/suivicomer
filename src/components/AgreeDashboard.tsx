import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  Business,
  BusinessMember,
  Carriere,
  DashboardMetrics,
  Loading,
  Commercial,
  ProductType,
  PaymentStatus,
  AVAILABLE_PRODUCTS
} from '../types';
import { dataService } from '../services/dataService';
import { formatFCFA, formatTonnage, formatDateFr } from '../utils/calculations';
import {
  Users,
  Layers,
  Truck,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Plus,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Pickaxe,
  ArrowLeft,
  Package
} from 'lucide-react';

interface AgreeDashboardProps {
  user: UserProfile;
  business: Business;
  member: BusinessMember;
  carriere: Carriere;
  onChangeCarriere: () => void;
  onOpenLoadingModal: () => void;
  onOpenRangeModal: () => void;
  onOpenCommercialsModal: () => void;
  onOpenSecretariesModal: () => void;
  onOpenProductsModal: () => void;
  onOpenPaymentModal: (loading: Loading) => void;
}

export const AgreeDashboard: React.FC<AgreeDashboardProps> = ({
  user,
  business,
  member,
  carriere,
  onChangeCarriere,
  onOpenLoadingModal,
  onOpenRangeModal,
  onOpenCommercialsModal,
  onOpenSecretariesModal,
  onOpenProductsModal,
  onOpenPaymentModal,
}) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadings, setLoadings] = useState<Loading[]>([]);
  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtres et recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCommFilter, setSelectedCommFilter] = useState('');
  const [selectedProdFilter, setSelectedProdFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  const refreshAll = async () => {
    setLoadingData(true);
    try {
      const [m, l, c] = await Promise.all([
        dataService.computeDashboardMetrics(business.id, undefined, carriere.id),
        dataService.getLoadings(business.id, undefined, carriere.id),
        dataService.getCommercials(business.id, carriere.id),
      ]);
      setMetrics(m);
      setLoadings(l);
      setCommercials(c);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [business.id, carriere.id]);

  // Filtrage des chargements
  const filteredLoadings = loadings.filter((l) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchVoucher = l.voucher_number.toString().includes(q);
      const matchPlate = l.truck_plate.toLowerCase().includes(q);
      const matchClient = (l.client_name || '').toLowerCase().includes(q);
      const matchRef = (l.payment_ref || '').toLowerCase().includes(q);
      if (!matchVoucher && !matchPlate && !matchClient && !matchRef) return false;
    }
    if (selectedCommFilter && l.commercial_id !== selectedCommFilter) return false;
    if (selectedProdFilter && l.product !== selectedProdFilter) return false;
    if (selectedStatusFilter && l.payment_status !== selectedStatusFilter) return false;
    return true;
  });

  return (
    <div>
      {/* BANNIÈRE DE LA CARRIÈRE ACTIVE */}
      <div
        style={{
          background: 'white',
          border: '1.5px solid var(--slate-200)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--primary-100)',
              color: 'var(--primary-700)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pickaxe size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--slate-400)', fontWeight: 700 }}>
              Carrière en cours de suivi
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--slate-900)' }}>
              {carriere.name} {carriere.location ? `— ${carriere.location}` : ''}
            </div>
          </div>
        </div>

        <button
          onClick={onChangeCarriere}
          className="btn btn-secondary"
          style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
        >
          <ArrowLeft size={15} />
          <span>Changer de Carrière / Toutes mes carrières</span>
        </button>
      </div>

      {/* BARRE D'ACTIONS RAPIDES EN TÊTE */}
      <div className="actions-bar">
        <button onClick={onOpenLoadingModal} className="btn btn-primary">
          <Plus size={18} />
          <span>Nouveau Chargement</span>
        </button>
        <button onClick={onOpenRangeModal} className="btn btn-secondary">
          <Layers size={18} />
          <span>Attribuer une Plage de Bons</span>
        </button>
        <button onClick={onOpenCommercialsModal} className="btn btn-secondary">
          <Users size={18} />
          <span>Commerciaux ({commercials.length})</span>
        </button>
        <button onClick={onOpenSecretariesModal} className="btn btn-secondary">
          <ShieldCheck size={18} />
          <span>Secrétaires & Permissions</span>
        </button>
        <button onClick={onOpenProductsModal} className="btn btn-secondary">
          <Package size={18} />
          <span>Produits & Tarifs</span>
        </button>
      </div>

      {/* INDICATEURS FINANCIERS ET LOGISTIQUES (KPI) */}
      <div className="metrics-grid">
        <div className="kpi-card teal">
          <div className="kpi-label">Commerciaux Actifs</div>
          <div className="kpi-value">{metrics?.activeCommercialsCount ?? 0}</div>
          <div className="kpi-sub">Dans cette carrière : {commercials.length}</div>
        </div>

        <div className="kpi-card indigo">
          <div className="kpi-label">Bons Disponibles</div>
          <div className="kpi-value">{metrics?.totalVouchersAvailable ?? 0}</div>
          <div className="kpi-sub">
            Attribués : {metrics?.totalVouchersAssigned ?? 0} • Utilisés : {metrics?.totalVouchersUsed ?? 0}
          </div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-label">Total Chargements</div>
          <div className="kpi-value">{metrics?.totalLoadingsCount ?? 0}</div>
          <div className="kpi-sub">Tonnage : {formatTonnage(metrics?.totalTonnageLoaded ?? 0)}</div>
        </div>

        <div className="kpi-card teal">
          <div className="kpi-label">Montant Facturé</div>
          <div className="kpi-value">{formatFCFA(metrics?.totalAmountInvoiced ?? 0)}</div>
          <div className="kpi-sub">Chiffre d'affaires de la carrière</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-label">Total Déjà Payé</div>
          <div className="kpi-value">{formatFCFA(metrics?.totalAmountPaid ?? 0)}</div>
          <div className="kpi-sub">Encaissé sur site</div>
        </div>

        <div className="kpi-card rose">
          <div className="kpi-label">Montant Restant Dû</div>
          <div className="kpi-value">{formatFCFA(metrics?.totalAmountRemaining ?? 0)}</div>
          <div className="kpi-sub">À recouvrer auprès des clients</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-label">Partiellement Payés</div>
          <div className="kpi-value">{metrics?.partiallyPaidLoadingsCount ?? 0}</div>
          <div className="kpi-sub">Chargements avec acompte versé</div>
        </div>

        <div className="kpi-card rose">
          <div className="kpi-label">Non Payés</div>
          <div className="kpi-value">{metrics?.unpaidLoadingsCount ?? 0}</div>
          <div className="kpi-sub">En attente de versement</div>
        </div>
      </div>

      {/* RÉSUMÉ DES COMMERCIAUX */}
      <div className="card-section">
        <div className="section-header">
          <div className="section-title">
            <Users size={18} color="var(--primary-600)" />
            <span>Commerciaux de la Carrière ({commercials.length})</span>
          </div>
          <button onClick={onOpenCommercialsModal} className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '34px' }}>
            Gérer les commerciaux
          </button>
        </div>

        {commercials.length === 0 ? (
          <div className="empty-state">
            <Users className="empty-icon" />
            <div className="empty-title">Aucun commercial dans cette carrière</div>
            <div className="empty-desc">
              Ajoutez les commerciaux assignés à cette carrière pour pouvoir leur distribuer des plages de bons numérotés.
            </div>
            <button onClick={onOpenCommercialsModal} className="btn btn-primary">
              <Plus size={16} />
              <span>Ajouter un commercial à cette carrière</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Nom du Commercial</th>
                  <th>Téléphone / Code d'accès</th>
                  <th>Statut</th>
                  <th>Chargements</th>
                  <th>Tonnage Total</th>
                  <th>Total Facturé</th>
                  <th>Total Payé</th>
                  <th>Reste Dû</th>
                </tr>
              </thead>
              <tbody>
                {commercials.map((c) => {
                  const commLoadings = loadings.filter((l) => l.commercial_id === c.id);
                  const tonnage = commLoadings.reduce((sum, l) => sum + Number(l.tonnage), 0);
                  const invoiced = commLoadings.reduce((sum, l) => sum + Number(l.total_amount), 0);
                  const paid = commLoadings.reduce((sum, l) => sum + Number(l.amount_paid), 0);
                  const due = invoiced - paid;

                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.full_name}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-700)' }}>
                          {c.access_code || c.phone || '-'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c.is_active ? 'var(--paid-text)' : 'var(--slate-400)' }}>
                          {c.is_active ? '● Actif' : '○ Inactif'}
                        </span>
                      </td>
                      <td>{commLoadings.length}</td>
                      <td>{formatTonnage(tonnage)}</td>
                      <td style={{ fontWeight: 600 }}>{formatFCFA(invoiced)}</td>
                      <td style={{ color: 'var(--paid-text)', fontWeight: 600 }}>{formatFCFA(paid)}</td>
                      <td style={{ color: due > 0 ? 'var(--unpaid-text)' : 'var(--slate-500)', fontWeight: 700 }}>
                        {formatFCFA(due)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HISTORIQUE ET SUIVI DES CHARGEMENTS DE LA CARRIÈRE */}
      <div className="card-section">
        <div className="section-header">
          <div className="section-title">
            <Truck size={18} color="var(--primary-600)" />
            <span>Historique des Chargements ({filteredLoadings.length})</span>
          </div>
          <button onClick={onOpenLoadingModal} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', minHeight: '36px' }}>
            <Plus size={16} />
            <span>Nouveau chargement</span>
          </button>
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
            {AVAILABLE_PRODUCTS.map((p) => (
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

        {/* TABLEAU DES CHARGEMENTS */}
        {filteredLoadings.length === 0 ? (
          <div className="empty-state">
            <Truck className="empty-icon" />
            <div className="empty-title">Aucun chargement dans cette carrière</div>
            <div className="empty-desc">
              {loadings.length === 0
                ? "Aucun chargement n'a encore été enregistré pour cette carrière. Utilisez le bouton ci-dessus pour saisir le tout premier chargement."
                : "Aucun chargement ne correspond aux filtres de recherche sélectionnés."}
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
                  <th>Montant Total</th>
                  <th>Déjà Payé</th>
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
                      <button
                        onClick={() => onOpenPaymentModal(l)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.55rem', minHeight: '30px', fontSize: '0.74rem' }}
                        title="Modifier le montant payé"
                      >
                        <DollarSign size={13} />
                        <span>Paiement</span>
                      </button>
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
