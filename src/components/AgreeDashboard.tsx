import React, { useState, useEffect, useMemo } from 'react';
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
import {
  formatFCFA,
  formatTonnage,
  formatDateFr,
  derivePaymentStatus,
  calculateRemainingDue,
  matchesProduct
} from '../utils/calculations';
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
  Package,
  RefreshCw,
  Eye,
  X,
  RotateCcw
} from 'lucide-react';
import { CommercialDetailModal } from './CommercialDetailModal';

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

  // Commercial sélectionné pour consultation détaillée (modal)
  const [selectedCommercialForDetail, setSelectedCommercialForDetail] = useState<Commercial | null>(null);

  const refreshAll = async () => {
    setLoadingData(true);
    try {
      const [m, l, c] = await Promise.all([
        dataService.computeDashboardMetrics(business.id, undefined, carriere.id),
        dataService.getLoadings(business.id, undefined, carriere.id),
        dataService.getCommercials(business.id, carriere.id),
      ]);

      // Fusionner tous les commerciaux enregistrés avec ceux présents dans les chargements
      const commMap = new Map<string, Commercial>();
      c.forEach((comm) => commMap.set(comm.id, comm));
      l.forEach((load) => {
        if (load.commercial_id && !commMap.has(load.commercial_id)) {
          commMap.set(load.commercial_id, {
            id: load.commercial_id,
            business_id: business.id,
            carriere_id: carriere.id,
            full_name: load.commercial_name || 'Commercial',
            is_active: true,
            created_at: load.created_at || new Date().toISOString(),
          });
        }
      });
      const allComms = Array.from(commMap.values());

      setMetrics(m);
      setLoadings(l);
      setCommercials(allComms);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [business.id, carriere.id]);

  // Options de produits distincts (fusion des produits réels et du catalogue de base)
  const distinctProductOptions = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    loadings.forEach((l) => {
      const prod = l.product?.trim();
      if (prod && !seen.has(prod)) {
        seen.add(prod);
        list.push(prod);
      }
    });

    AVAILABLE_PRODUCTS.forEach((ap) => {
      const alreadyHas = list.some((item) => matchesProduct(item, ap));
      if (!alreadyHas && !seen.has(ap)) {
        seen.add(ap);
        list.push(ap);
      }
    });

    return list;
  }, [loadings]);

  // Filtrage robuste et dynamique des chargements
  const filteredLoadings = useMemo(() => {
    return loadings.filter((l) => {
      // 1. Recherche par mot-clé (bon, plaque, client, ref, commercial, produit)
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchVoucher = l.voucher_number?.toString().includes(q);
        const matchPlate = (l.truck_plate || '').toLowerCase().includes(q);
        const matchClient = (l.client_name || '').toLowerCase().includes(q);
        const matchRef = (l.payment_ref || '').toLowerCase().includes(q);
        const matchComm = (l.commercial_name || '').toLowerCase().includes(q);
        const matchProd = (l.product || '').toLowerCase().includes(q);
        if (!matchVoucher && !matchPlate && !matchClient && !matchRef && !matchComm && !matchProd) {
          return false;
        }
      }

      // 2. Filtre Commercial (par ID ou nom)
      if (selectedCommFilter) {
        const selectedComm = commercials.find((c) => c.id === selectedCommFilter);
        const matchId = l.commercial_id === selectedCommFilter;
        const matchName =
          selectedComm &&
          l.commercial_name &&
          l.commercial_name.toLowerCase().trim() === selectedComm.full_name.toLowerCase().trim();
        if (!matchId && !matchName) return false;
      }

      // 3. Filtre Produit (comparaison flexible granulométrique et nominale)
      if (selectedProdFilter && !matchesProduct(l.product, selectedProdFilter)) {
        return false;
      }

      // 4. Filtre Statut de paiement (calculé strictement d'après montants)
      if (selectedStatusFilter) {
        const status = derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid));
        if (status !== selectedStatusFilter) return false;
      }

      return true;
    });
  }, [loadings, searchQuery, selectedCommFilter, selectedProdFilter, selectedStatusFilter, commercials]);

  // Calcul des métriques pour les chargements filtrés
  const filteredTonnage = filteredLoadings.reduce((sum, l) => sum + Number(l.tonnage || 0), 0);
  const filteredInvoiced = filteredLoadings.reduce((sum, l) => sum + Number(l.total_amount || 0), 0);
  const filteredPaid = filteredLoadings.reduce((sum, l) => sum + Number(l.amount_paid || 0), 0);
  const filteredDue = Math.max(0, filteredInvoiced - filteredPaid);

  // Nombre de chargements par statut (sur l'ensemble filtré par commercial/produit/recherche)
  const loadingsForStatusCounts = useMemo(() => {
    return loadings.filter((l) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchVoucher = l.voucher_number?.toString().includes(q);
        const matchPlate = (l.truck_plate || '').toLowerCase().includes(q);
        const matchClient = (l.client_name || '').toLowerCase().includes(q);
        const matchRef = (l.payment_ref || '').toLowerCase().includes(q);
        const matchComm = (l.commercial_name || '').toLowerCase().includes(q);
        const matchProd = (l.product || '').toLowerCase().includes(q);
        if (!matchVoucher && !matchPlate && !matchClient && !matchRef && !matchComm && !matchProd) {
          return false;
        }
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
      if (selectedProdFilter && !matchesProduct(l.product, selectedProdFilter)) {
        return false;
      }
      return true;
    });
  }, [loadings, searchQuery, selectedCommFilter, selectedProdFilter, commercials]);

  const unpaidCount = loadingsForStatusCounts.filter(
    (l) => derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)) === 'non_paye'
  ).length;
  const partialCount = loadingsForStatusCounts.filter(
    (l) => derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)) === 'partiellement_paye'
  ).length;
  const paidCount = loadingsForStatusCounts.filter(
    (l) => derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)) === 'paye'
  ).length;

  // Filtrer l'historique par un commercial en particulier et scroller
  const handleFilterByCommercial = (commId: string) => {
    if (selectedCommFilter === commId) {
      setSelectedCommFilter('');
    } else {
      setSelectedCommFilter(commId);
      const el = document.getElementById('loadings-history-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCommFilter('');
    setSelectedProdFilter('');
    setSelectedStatusFilter('');
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedCommFilter || selectedProdFilter || selectedStatusFilter
  );

  const selectedCommObj = commercials.find((c) => c.id === selectedCommFilter);

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
          <div className="kpi-value">{metrics?.activeCommercialsCount ?? commercials.filter((c) => c.is_active).length}</div>
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
          <div className="kpi-value">{metrics?.totalLoadingsCount ?? loadings.length}</div>
          <div className="kpi-sub">Tonnage : {formatTonnage(metrics?.totalTonnageLoaded ?? loadings.reduce((s, l) => s + Number(l.tonnage || 0), 0))}</div>
        </div>

        <div className="kpi-card teal">
          <div className="kpi-label">Montant Facturé</div>
          <div className="kpi-value">{formatFCFA(metrics?.totalAmountInvoiced ?? loadings.reduce((s, l) => s + Number(l.total_amount || 0), 0))}</div>
          <div className="kpi-sub">Chiffre d'affaires de la carrière</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-label">Total Déjà Payé</div>
          <div className="kpi-value">{formatFCFA(metrics?.totalAmountPaid ?? loadings.reduce((s, l) => s + Number(l.amount_paid || 0), 0))}</div>
          <div className="kpi-sub">Encaissé sur site</div>
        </div>

        <div className="kpi-card rose">
          <div className="kpi-label">Montant Restant Dû</div>
          <div className="kpi-value">{formatFCFA(metrics?.totalAmountRemaining ?? Math.max(0, (metrics?.totalAmountInvoiced ?? 0) - (metrics?.totalAmountPaid ?? 0)))}</div>
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

      {/* RÉSUMÉ DES COMMERCIAUX DE LA CARRIÈRE */}
      <div className="card-section">
        <div className="section-header">
          <div className="section-title">
            <Users size={18} color="var(--primary-600)" />
            <span>Commerciaux de la Carrière ({commercials.length})</span>
          </div>
          <button
            onClick={onOpenCommercialsModal}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', minHeight: '34px' }}
          >
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commercials.map((c) => {
                  const commLoadings = loadings.filter(
                    (l) =>
                      l.commercial_id === c.id ||
                      (l.commercial_name && l.commercial_name.toLowerCase().trim() === c.full_name.toLowerCase().trim())
                  );
                  const tonnage = commLoadings.reduce((sum, l) => sum + Number(l.tonnage || 0), 0);
                  const invoiced = commLoadings.reduce((sum, l) => sum + Number(l.total_amount || 0), 0);
                  const paid = commLoadings.reduce((sum, l) => sum + Number(l.amount_paid || 0), 0);
                  const due = Math.max(0, invoiced - paid);
                  const isFiltered = selectedCommFilter === c.id;

                  return (
                    <tr
                      key={c.id}
                      style={{
                        background: isFiltered ? 'var(--primary-50)' : undefined,
                        borderLeft: isFiltered ? '3px solid var(--primary-600)' : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span>{c.full_name}</span>
                          {c.is_secretary && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '0.1rem 0.4rem',
                                background: '#fef3c7',
                                color: '#92400e',
                                borderRadius: '4px',
                                fontWeight: 700,
                              }}
                            >
                              ⭐ Secrétaire
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-700)' }}>
                          {c.access_code || c.phone || '-'}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: c.is_active ? 'var(--paid-text)' : 'var(--slate-400)',
                          }}
                        >
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
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedCommercialForDetail(c)}
                            className="btn btn-primary"
                            style={{
                              padding: '0.28rem 0.55rem',
                              fontSize: '0.72rem',
                              minHeight: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                            title={`Consulter le tableau de bord réservé à ${c.full_name}`}
                          >
                            <Eye size={13} />
                            <span>Consulter</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleFilterByCommercial(c.id)}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.28rem 0.55rem',
                              fontSize: '0.72rem',
                              minHeight: '28px',
                              background: isFiltered ? 'var(--primary-600)' : undefined,
                              color: isFiltered ? 'white' : undefined,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                            title="Filtrer l'historique des chargements sur ce commercial"
                          >
                            <Filter size={13} />
                            <span>{isFiltered ? '● Filtre Actif' : 'Filtrer'}</span>
                          </button>
                        </div>
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
      <div className="card-section" id="loadings-history-section">
        <div className="section-header">
          <div className="section-title">
            <Truck size={18} color="var(--primary-600)" />
            <span>Historique des Chargements ({filteredLoadings.length})</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={refreshAll}
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', minHeight: '36px' }}
              title="Rafraîchir les chargements"
              disabled={loadingData}
            >
              <RefreshCw size={15} className={loadingData ? 'animate-spin' : ''} />
              <span>Actualiser</span>
            </button>
            <button
              onClick={onOpenLoadingModal}
              className="btn btn-primary"
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', minHeight: '36px' }}
            >
              <Plus size={16} />
              <span>Nouveau chargement</span>
            </button>
          </div>
        </div>

        {/* FILTRES & RECHERCHE */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.65rem',
            marginBottom: '0.85rem',
          }}
        >
          {/* 1. Recherche globale */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Recherche (bon, plaque, client)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2rem' }}
            />
            <Search
              size={16}
              color="var(--slate-400)"
              style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }}
            />
          </div>

          {/* 2. Filtre Commercial */}
          <select
            className="form-select"
            value={selectedCommFilter}
            onChange={(e) => setSelectedCommFilter(e.target.value)}
          >
            <option value="">Tous les commerciaux ({commercials.length})</option>
            {commercials.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>

          {/* 3. Filtre Produit */}
          <select
            className="form-select"
            value={selectedProdFilter}
            onChange={(e) => setSelectedProdFilter(e.target.value)}
          >
            <option value="">Tous les produits ({distinctProductOptions.length})</option>
            {distinctProductOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* 4. Filtre Statut de Paiement */}
          <select
            className="form-select"
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts de paiement</option>
            <option value="non_paye">Non Payé ({unpaidCount})</option>
            <option value="partiellement_paye">Partiellement Payé ({partialCount})</option>
            <option value="paye">Entièrement Payé ({paidCount})</option>
          </select>
        </div>

        {/* ONGLETS / CHIPS DE FILTRAGE RAPIDE DU STATUT */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.85rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('')}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '20px',
              border: '1.5px solid',
              borderColor: selectedStatusFilter === '' ? 'var(--primary-600)' : 'var(--slate-200)',
              background: selectedStatusFilter === '' ? 'var(--primary-50)' : 'white',
              color: selectedStatusFilter === '' ? 'var(--primary-700)' : 'var(--slate-600)',
              cursor: 'pointer',
            }}
          >
            Tous ({loadingsForStatusCounts.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'non_paye' ? '' : 'non_paye')}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '20px',
              border: '1.5px solid',
              borderColor: selectedStatusFilter === 'non_paye' ? '#dc2626' : 'var(--slate-200)',
              background: selectedStatusFilter === 'non_paye' ? '#fee2e2' : 'white',
              color: selectedStatusFilter === 'non_paye' ? '#991b1b' : 'var(--slate-600)',
              cursor: 'pointer',
            }}
          >
            ● Non Payés ({unpaidCount})
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedStatusFilter(selectedStatusFilter === 'partiellement_paye' ? '' : 'partiellement_paye')
            }
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '20px',
              border: '1.5px solid',
              borderColor: selectedStatusFilter === 'partiellement_paye' ? '#d97706' : 'var(--slate-200)',
              background: selectedStatusFilter === 'partiellement_paye' ? '#fef3c7' : 'white',
              color: selectedStatusFilter === 'partiellement_paye' ? '#92400e' : 'var(--slate-600)',
              cursor: 'pointer',
            }}
          >
            ● Partiellement Payés ({partialCount})
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'paye' ? '' : 'paye')}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.76rem',
              fontWeight: 700,
              borderRadius: '20px',
              border: '1.5px solid',
              borderColor: selectedStatusFilter === 'paye' ? '#16a34a' : 'var(--slate-200)',
              background: selectedStatusFilter === 'paye' ? '#dcfce7' : 'white',
              color: selectedStatusFilter === 'paye' ? '#166534' : 'var(--slate-600)',
              cursor: 'pointer',
            }}
          >
            ● Entièrement Payés ({paidCount})
          </button>
        </div>

        {/* BANDEAU D'ÉTAT DES FILTRES ACTIFS */}
        {hasActiveFilters && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 0.85rem',
              background: 'var(--slate-100)',
              borderRadius: '8px',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              fontSize: '0.78rem',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--slate-600)' }}>Filtres actifs :</span>

            {selectedCommFilter && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'white',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '16px',
                  border: '1px solid var(--slate-300)',
                  fontWeight: 600,
                  color: 'var(--primary-800)',
                }}
              >
                Commercial : {selectedCommObj?.full_name || 'Sélectionné'}
                <button
                  type="button"
                  onClick={() => setSelectedCommFilter('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedProdFilter && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'white',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '16px',
                  border: '1px solid var(--slate-300)',
                  fontWeight: 600,
                  color: 'var(--primary-800)',
                }}
              >
                Produit : {selectedProdFilter}
                <button
                  type="button"
                  onClick={() => setSelectedProdFilter('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedStatusFilter && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'white',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '16px',
                  border: '1px solid var(--slate-300)',
                  fontWeight: 600,
                  color: 'var(--primary-800)',
                }}
              >
                Statut :{' '}
                {selectedStatusFilter === 'paye'
                  ? 'Entièrement Payé'
                  : selectedStatusFilter === 'partiellement_paye'
                  ? 'Partiellement Payé'
                  : 'Non Payé'}
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {searchQuery && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  background: 'white',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '16px',
                  border: '1px solid var(--slate-300)',
                  fontWeight: 600,
                  color: 'var(--primary-800)',
                }}
              >
                Recherche : "{searchQuery}"
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{
                marginLeft: 'auto',
                fontSize: '0.72rem',
                padding: '0.25rem 0.55rem',
                minHeight: '26px',
              }}
            >
              <RotateCcw size={12} />
              <span>Réinitialiser tout</span>
            </button>
          </div>
        )}

        {/* RÉSUMÉ FINANCIER DU FILTRE ACTIF */}
        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--slate-500)',
            marginBottom: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Affichage de <strong>{filteredLoadings.length}</strong> chargement(s) sur {loadings.length}
          </span>
          {filteredLoadings.length > 0 && (
            <>
              <span>•</span>
              <span>Tonnage : <strong>{formatTonnage(filteredTonnage)}</strong></span>
              <span>•</span>
              <span>Facturé : <strong>{formatFCFA(filteredInvoiced)}</strong></span>
              <span>•</span>
              <span style={{ color: 'var(--paid-text)' }}>Payé : <strong>{formatFCFA(filteredPaid)}</strong></span>
              <span>•</span>
              <span style={{ color: filteredDue > 0 ? 'var(--unpaid-text)' : 'inherit' }}>
                Reste dû : <strong>{formatFCFA(filteredDue)}</strong>
              </span>
            </>
          )}
        </div>

        {/* TABLEAU DES CHARGEMENTS */}
        {filteredLoadings.length === 0 ? (
          <div className="empty-state">
            <Truck className="empty-icon" />
            <div className="empty-title">Aucun chargement ne correspond</div>
            <div className="empty-desc">
              {loadings.length === 0
                ? "Aucun chargement n'a encore été enregistré pour cette carrière. Utilisez le bouton ci-dessus pour saisir le tout premier chargement."
                : "Aucun chargement ne correspond aux critères de recherche et filtres sélectionnés."}
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-secondary"
                style={{ marginTop: '0.75rem' }}
              >
                <RotateCcw size={14} />
                <span>Effacer les filtres</span>
              </button>
            )}
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
                {filteredLoadings.map((l) => {
                  const status = derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid));
                  const remaining = calculateRemainingDue(Number(l.total_amount), Number(l.amount_paid));

                  return (
                    <tr key={l.id}>
                      <td>{formatDateFr(l.loading_date)}</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary-700)' }}>
                        #{l.voucher_number}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            cursor: l.commercial_id ? 'pointer' : 'default',
                            color: l.commercial_id === selectedCommFilter ? 'var(--primary-700)' : 'inherit',
                            textDecoration: l.commercial_id ? 'underline dotted' : 'none',
                          }}
                          onClick={() => l.commercial_id && handleFilterByCommercial(l.commercial_id)}
                          title="Cliquer pour filtrer uniquement sur ce commercial"
                        >
                          {l.commercial_name || '-'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{l.product}</td>
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
                      <td
                        style={{
                          color: remaining > 0 ? 'var(--unpaid-text)' : 'var(--slate-500)',
                          fontWeight: 700,
                        }}
                      >
                        {formatFCFA(remaining)}
                      </td>
                      <td>
                        <span className={`payment-badge ${status}`}>
                          {status === 'paye'
                            ? 'Payé'
                            : status === 'partiellement_paye'
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CONSULTATION DÉTAILLÉE D'UN COMMERCIAL */}
      {selectedCommercialForDetail && (
        <CommercialDetailModal
          commercial={selectedCommercialForDetail}
          business={business}
          carriere={carriere}
          currentUserMember={member}
          onClose={() => setSelectedCommercialForDetail(null)}
          onUpdated={refreshAll}
        />
      )}
    </div>
  );
};
