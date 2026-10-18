import React, { useState, useEffect, useMemo } from 'react';
import {
  Commercial,
  Business,
  Carriere,
  Loading,
  LoadingVoucher,
  BonRange,
  PaymentStatus,
  BusinessMember
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
  X,
  Users,
  Truck,
  Layers,
  DollarSign,
  Package,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Phone,
  Key,
  ShieldCheck,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { PaymentModal } from './PaymentModal';

interface CommercialDetailModalProps {
  commercial: Commercial;
  business: Business;
  carriere?: Carriere | null;
  currentUserMember?: BusinessMember;
  onClose: () => void;
  onUpdated?: () => void;
}

export const CommercialDetailModal: React.FC<CommercialDetailModalProps> = ({
  commercial,
  business,
  carriere,
  currentUserMember,
  onClose,
  onUpdated,
}) => {
  const [loadings, setLoadings] = useState<Loading[]>([]);
  const [vouchers, setVouchers] = useState<LoadingVoucher[]>([]);
  const [ranges, setRanges] = useState<BonRange[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProdFilter, setSelectedProdFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Gestion du paiement
  const [paymentModalLoading, setPaymentModalLoading] = useState<Loading | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [l, v, r] = await Promise.all([
        dataService.getLoadings(business.id, commercial.id, carriere?.id),
        dataService.getVouchers(business.id, commercial.id, carriere?.id),
        dataService.getBonRanges(business.id, carriere?.id),
      ]);
      setLoadings(l);
      setVouchers(v);
      setRanges(r.filter((range) => range.commercial_id === commercial.id));
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [business.id, commercial.id, carriere?.id]);

  const copyCredentials = () => {
    const text = `Accès SUIVICOMER (${carriere?.name || business.name}) :\nIdentifiant / Code : ${
      commercial.access_code || commercial.phone
    }\nMot de passe : ${commercial.password || commercial.pin || '1234'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // 1. Calculs des KPI globaux du commercial
  const totalAssignedVouchers = vouchers.length;
  const totalUsedVouchers = vouchers.filter((v) => v.status === 'utilise').length;
  const totalAvailableVouchers = vouchers.filter(
    (v) => v.status === 'disponible' && !v.is_local_reserved
  ).length;

  const totalTonnage = loadings.reduce((sum, l) => sum + Number(l.tonnage || 0), 0);
  const totalInvoiced = loadings.reduce((sum, l) => sum + Number(l.total_amount || 0), 0);
  const totalPaid = loadings.reduce((sum, l) => sum + Number(l.amount_paid || 0), 0);
  const totalRemainingDue = Math.max(0, totalInvoiced - totalPaid);

  const unpaidCount = loadings.filter(
    (l) => derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)) === 'non_paye'
  ).length;
  const partialCount = loadings.filter(
    (l) => derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)) === 'partiellement_paye'
  ).length;
  const paidCount = loadings.filter(
    (l) => derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)) === 'paye'
  ).length;

  // 2. Répartition par produit
  const productBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { count: number; tonnage: number; invoiced: number; paid: number; due: number }
    >();

    loadings.forEach((l) => {
      const prodName = l.product || 'Produit non spécifié';
      const existing = map.get(prodName) || {
        count: 0,
        tonnage: 0,
        invoiced: 0,
        paid: 0,
        due: 0,
      };

      const inv = Number(l.total_amount || 0);
      const pd = Number(l.amount_paid || 0);

      existing.count += 1;
      existing.tonnage += Number(l.tonnage || 0);
      existing.invoiced += inv;
      existing.paid += pd;
      existing.due += Math.max(0, inv - pd);

      map.set(prodName, existing);
    });

    return Array.from(map.entries()).map(([name, stats]) => ({
      name,
      ...stats,
    }));
  }, [loadings]);

  // 3. Filtrage dynamique des chargements
  const filteredLoadings = useMemo(() => {
    return loadings.filter((l) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const matchVoucher = l.voucher_number?.toString().includes(q);
        const matchPlate = (l.truck_plate || '').toLowerCase().includes(q);
        const matchClient = (l.client_name || '').toLowerCase().includes(q);
        const matchRef = (l.payment_ref || '').toLowerCase().includes(q);
        const matchProd = (l.product || '').toLowerCase().includes(q);
        if (!matchVoucher && !matchPlate && !matchClient && !matchRef && !matchProd) return false;
      }
      if (selectedProdFilter && !matchesProduct(l.product, selectedProdFilter)) {
        return false;
      }
      if (selectedStatusFilter) {
        const status = derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid));
        if (status !== selectedStatusFilter) return false;
      }
      return true;
    });
  }, [loadings, searchQuery, selectedProdFilter, selectedStatusFilter]);

  // Liste de tous les produits distincts pour le filtre
  const distinctProducts = useMemo(() => {
    return Array.from(new Set(loadings.map((l) => l.product).filter(Boolean)));
  }, [loadings]);

  return (
    <>
      <div className="modal-overlay" style={{ zIndex: 1100, overflowY: 'auto', padding: '1.5rem 0.75rem' }}>
        <div
          className="modal-card"
          style={{
            maxWidth: '1060px',
            width: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            padding: 0,
          }}
        >
          {/* HEADER MODAL */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--slate-200)',
              background: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {commercial.full_name ? commercial.full_name.charAt(0).toUpperCase() : 'C'}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>
                    {commercial.full_name}
                  </h2>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.55rem',
                      borderRadius: '4px',
                      background: commercial.is_active ? 'var(--paid-bg)' : 'var(--slate-200)',
                      color: commercial.is_active ? 'var(--paid-text)' : 'var(--slate-600)',
                    }}
                  >
                    {commercial.is_active ? '● Actif' : '○ Inactif'}
                  </span>
                  {commercial.is_secretary && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '4px',
                        background: '#fef3c7',
                        color: '#92400e',
                      }}
                    >
                      ⭐ Secrétaire
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--slate-500)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    marginTop: '0.2rem',
                  }}
                >
                  <span>
                    Identifiant :{' '}
                    <strong style={{ color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      {commercial.access_code || commercial.phone || '-'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    PIN : <strong>{commercial.password || commercial.pin || '1234'}</strong>
                  </span>
                  {carriere && (
                    <>
                      <span>•</span>
                      <span>
                        Carrière : <strong>{carriere.name}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={copyCredentials}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', minHeight: '34px' }}
                title="Copier les identifiants d'accès"
              >
                {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                <span>{copied ? 'Copié !' : 'Partager Accès'}</span>
              </button>

              <button
                type="button"
                onClick={loadData}
                disabled={loadingData}
                className="btn btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', minHeight: '34px' }}
                title="Actualiser les données"
              >
                <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} />
                <span>Actualiser</span>
              </button>

              <button type="button" onClick={onClose} className="close-btn" style={{ marginLeft: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>
          </div>

          {/* CORPS DE LA MODALE AVEC SCROLL */}
          <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, background: 'var(--slate-50)' }}>
            {/* INDICATEURS KPI DU COMMERCIAL (TABLEAU DE BORD EXCLUSIF) */}
            <div className="metrics-grid" style={{ marginBottom: '1.25rem' }}>
              <div className="kpi-card indigo">
                <div className="kpi-label">Bons Disponibles</div>
                <div className="kpi-value">{totalAvailableVouchers}</div>
                <div className="kpi-sub">
                  Attribués : {totalAssignedVouchers} • Utilisés : {totalUsedVouchers}
                </div>
              </div>

              <div className="kpi-card teal">
                <div className="kpi-label">Total Chargements</div>
                <div className="kpi-value">{loadings.length}</div>
                <div className="kpi-sub">Tonnage total : {formatTonnage(totalTonnage)}</div>
              </div>

              <div className="kpi-card teal">
                <div className="kpi-label">Montant Facturé</div>
                <div className="kpi-value">{formatFCFA(totalInvoiced)}</div>
                <div className="kpi-sub">Total de ses chargements</div>
              </div>

              <div className="kpi-card emerald">
                <div className="kpi-label">Total Déjà Payé</div>
                <div className="kpi-value">{formatFCFA(totalPaid)}</div>
                <div className="kpi-sub">Encaissé / versé</div>
              </div>

              <div className="kpi-card rose">
                <div className="kpi-label">Reste à Payer</div>
                <div className="kpi-value">{formatFCFA(totalRemainingDue)}</div>
                <div className="kpi-sub">Solde restant dû de ses clients</div>
              </div>

              <div className="kpi-card amber">
                <div className="kpi-label">Partiellement Payés</div>
                <div className="kpi-value">{partialCount}</div>
                <div className="kpi-sub">Acompte déjà versé</div>
              </div>

              <div className="kpi-card rose">
                <div className="kpi-label">Non Payés</div>
                <div className="kpi-value">{unpaidCount}</div>
                <div className="kpi-sub">En attente de paiement</div>
              </div>

              <div className="kpi-card emerald">
                <div className="kpi-label">Soldés à 100%</div>
                <div className="kpi-value">{paidCount}</div>
                <div className="kpi-sub">Entièrement réglés</div>
              </div>
            </div>

            {/* RÉPARTITION PAR PRODUIT CHARGÉ */}
            <div className="card-section" style={{ marginBottom: '1.25rem', background: 'white' }}>
              <div className="section-header">
                <div className="section-title">
                  <Package size={18} color="var(--primary-600)" />
                  <span>Produits Chargés par ce Commercial ({productBreakdown.length})</span>
                </div>
                {selectedProdFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedProdFilter('')}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
                  >
                    Effacer filtre produit
                  </button>
                )}
              </div>

              {productBreakdown.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--slate-400)', fontSize: '0.85rem' }}>
                  Aucun produit chargé par ce commercial pour le moment.
                </div>
              ) : (
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>Chargements</th>
                        <th>Tonnage Total</th>
                        <th>Total Facturé</th>
                        <th>Total Payé</th>
                        <th>Reste Dû</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productBreakdown.map((p) => {
                        const isFiltered = matchesProduct(p.name, selectedProdFilter);
                        return (
                          <tr
                            key={p.name}
                            style={{
                              background: selectedProdFilter && isFiltered ? 'var(--primary-50)' : undefined,
                            }}
                          >
                            <td style={{ fontWeight: 700, color: 'var(--slate-900)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <Package size={15} color="var(--primary-600)" />
                                <span>{p.name}</span>
                              </div>
                            </td>
                            <td>{p.count}</td>
                            <td style={{ fontWeight: 600 }}>{formatTonnage(p.tonnage)}</td>
                            <td style={{ fontWeight: 600 }}>{formatFCFA(p.invoiced)}</td>
                            <td style={{ color: 'var(--paid-text)', fontWeight: 600 }}>{formatFCFA(p.paid)}</td>
                            <td style={{ color: p.due > 0 ? 'var(--unpaid-text)' : 'var(--slate-500)', fontWeight: 700 }}>
                              {formatFCFA(p.due)}
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => setSelectedProdFilter(selectedProdFilter === p.name ? '' : p.name)}
                                className="btn btn-secondary"
                                style={{
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.72rem',
                                  minHeight: '28px',
                                  background: selectedProdFilter === p.name ? 'var(--primary-600)' : undefined,
                                  color: selectedProdFilter === p.name ? 'white' : undefined,
                                }}
                              >
                                <Filter size={12} />
                                <span>{selectedProdFilter === p.name ? 'Filtre actif' : 'Filtrer ce produit'}</span>
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

            {/* PLAGES DE BONS ATTRIBUÉES */}
            {ranges.length > 0 && (
              <div className="card-section" style={{ marginBottom: '1.25rem', background: 'white' }}>
                <div className="section-header">
                  <div className="section-title">
                    <Layers size={18} color="var(--primary-600)" />
                    <span>Plages de Bons Attribuées ({ranges.length})</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {ranges.map((r) => {
                    const rangeVouchers = vouchers.filter((v) => v.range_id === r.id);
                    const used = rangeVouchers.filter((v) => v.status === 'utilise').length;
                    const avail = rangeVouchers.filter((v) => v.status === 'disponible' && !v.is_local_reserved).length;
                    return (
                      <div
                        key={r.id}
                        style={{
                          border: '1px solid var(--slate-200)',
                          borderRadius: '8px',
                          padding: '0.75rem 1rem',
                          background: 'var(--slate-50)',
                        }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--primary-700)', fontSize: '0.95rem' }}>
                          Bons #{r.start_num} à #{r.end_num}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--slate-600)', marginTop: '0.35rem' }}>
                          Total : <strong>{r.total_count}</strong> bons • Utilisés :{' '}
                          <strong style={{ color: 'var(--primary-800)' }}>{used}</strong> • Restants :{' '}
                          <strong style={{ color: avail > 0 ? 'var(--paid-text)' : 'var(--unpaid-text)' }}>{avail}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* HISTORIQUE DÉTAILLÉ DES CHARGEMENTS DE CE COMMERCIAL */}
            <div className="card-section" style={{ background: 'white' }}>
              <div className="section-header">
                <div className="section-title">
                  <Truck size={18} color="var(--primary-600)" />
                  <span>Historique des Chargements ({filteredLoadings.length} / {loadings.length})</span>
                </div>
              </div>

              {/* FILTRES & RECHERCHE */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.65rem',
                  marginBottom: '1rem',
                }}
              >
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

                <select
                  className="form-select"
                  value={selectedProdFilter}
                  onChange={(e) => setSelectedProdFilter(e.target.value)}
                >
                  <option value="">Tous les produits</option>
                  {distinctProducts.map((p) => (
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
                  <option value="non_paye">Non Payé ({unpaidCount})</option>
                  <option value="partiellement_paye">Partiellement Payé ({partialCount})</option>
                  <option value="paye">Entièrement Payé ({paidCount})</option>
                </select>
              </div>

              {/* BOUTONS / ONGLETS DE FILTRAGE RAPIDE DU STATUT */}
              <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '20px',
                    border: '1.5px solid',
                    borderColor: selectedStatusFilter === '' ? 'var(--primary-600)' : 'var(--slate-200)',
                    background: selectedStatusFilter === '' ? 'var(--primary-50)' : 'white',
                    color: selectedStatusFilter === '' ? 'var(--primary-700)' : 'var(--slate-600)',
                    cursor: 'pointer',
                  }}
                >
                  Tous ({loadings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'non_paye' ? '' : 'non_paye')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
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
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
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
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
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

              {/* TABLEAU DES CHARGEMENTS DE CE COMMERCIAL */}
              {filteredLoadings.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <Truck className="empty-icon" />
                  <div className="empty-title">Aucun chargement trouvé</div>
                  <div className="empty-desc">
                    {loadings.length === 0
                      ? `Aucun chargement n'a encore été enregistré pour le commercial ${commercial.full_name}.`
                      : 'Aucun chargement ne correspond aux critères de filtre sélectionnés.'}
                  </div>
                  {(searchQuery || selectedProdFilter || selectedStatusFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedProdFilter('');
                        setSelectedStatusFilter('');
                      }}
                      className="btn btn-secondary"
                      style={{ marginTop: '0.75rem' }}
                    >
                      Réinitialiser tous les filtres
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
                            <td style={{ fontWeight: 800, color: 'var(--primary-700)' }}>#{l.voucher_number}</td>
                            <td style={{ fontWeight: 600 }}>{l.product}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{l.truck_plate}</td>
                            <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                              {l.payment_ref || l.client_name || '-'}
                            </td>
                            <td>{formatTonnage(l.tonnage)}</td>
                            <td>{formatFCFA(l.price_per_ton)}</td>
                            <td style={{ fontWeight: 700 }}>{formatFCFA(l.total_amount)}</td>
                            <td style={{ color: 'var(--paid-text)', fontWeight: 600 }}>{formatFCFA(l.amount_paid)}</td>
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
                                {status === 'paye' ? 'Payé' : status === 'partiellement_paye' ? 'Partiel' : 'Non payé'}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => setPaymentModalLoading(l)}
                                className="btn btn-secondary"
                                style={{ padding: '0.3rem 0.55rem', minHeight: '30px', fontSize: '0.74rem' }}
                                title="Mettre à jour le paiement"
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
          </div>
        </div>
      </div>

      {/* SOUS-MODAL DE MISE À JOUR DE PAIEMENT */}
      {paymentModalLoading && (
        <PaymentModal
          loading={paymentModalLoading}
          member={
            currentUserMember || {
              id: 'temp_member',
              business_id: business.id,
              user_id: 'agree_user',
              role: 'agree',
              is_active: true,
              can_edit_payments: true,
              created_at: new Date().toISOString(),
            }
          }
          onClose={() => setPaymentModalLoading(null)}
          onSuccess={() => {
            setPaymentModalLoading(null);
            loadData();
            if (onUpdated) onUpdated();
          }}
        />
      )}
    </>
  );
};
