import React, { useState, useEffect } from 'react';
import {
  UserProfile,
  Business,
  BusinessMember,
  Loading,
  LoadingVoucher,
  AVAILABLE_PRODUCTS
} from '../types';
import { dataService } from '../services/dataService';
import { formatFCFA, formatTonnage, formatDateFr } from '../utils/calculations';
import {
  Layers,
  Truck,
  DollarSign,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

interface CommercialDashboardProps {
  user: UserProfile;
  business: Business;
  member: BusinessMember;
}

export const CommercialDashboard: React.FC<CommercialDashboardProps> = ({
  user,
  business,
  member,
}) => {
  const [loadings, setLoadings] = useState<Loading[]>([]);
  const [vouchers, setVouchers] = useState<LoadingVoucher[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProdFilter, setSelectedProdFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');

  // Trouver l'ID commercial rattaché à cet utilisateur
  const [commercialId, setCommercialId] = useState<string>('');

  useEffect(() => {
    dataService.getCommercials(business.id).then((comms) => {
      // Rechercher le commercial lié au user
      const matched = comms.find((c) => c.user_id === user.id) || comms[0];
      if (matched) {
        setCommercialId(matched.id);
        refreshData(matched.id);
      } else {
        setLoadingData(false);
      }
    });
  }, [business.id, user.id]);

  const refreshData = async (commId: string) => {
    setLoadingData(true);
    try {
      const [l, v] = await Promise.all([
        dataService.getLoadings(business.id, commId),
        dataService.getVouchers(business.id, commId),
      ]);
      setLoadings(l);
      setVouchers(v);
    } finally {
      setLoadingData(false);
    }
  };

  // Calculs stricts des métriques du commercial
  const totalAssigned = vouchers.length;
  const totalUsed = vouchers.filter((v) => v.status === 'utilise').length;
  const totalAvailable = vouchers.filter((v) => v.status === 'disponible' && !v.is_local_reserved).length;

  const totalTonnage = loadings.reduce((sum, l) => sum + Number(l.tonnage), 0);
  const totalInvoiced = loadings.reduce((sum, l) => sum + Number(l.total_amount), 0);
  const totalPaid = loadings.reduce((sum, l) => sum + Number(l.amount_paid), 0);
  const totalRemaining = Math.max(0, totalInvoiced - totalPaid);

  const unpaidCount = loadings.filter((l) => l.payment_status === 'non_paye').length;
  const partialCount = loadings.filter((l) => l.payment_status === 'partiellement_paye').length;
  const paidCount = loadings.filter((l) => l.payment_status === 'paye').length;

  // Filtrage
  const filteredLoadings = loadings.filter((l) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchVoucher = l.voucher_number.toString().includes(q);
      const matchPlate = l.truck_plate.toLowerCase().includes(q);
      const matchClient = (l.client_name || '').toLowerCase().includes(q);
      const matchRef = (l.payment_ref || '').toLowerCase().includes(q);
      if (!matchVoucher && !matchPlate && !matchClient && !matchRef) return false;
    }
    if (selectedProdFilter && l.product !== selectedProdFilter) return false;
    if (selectedStatusFilter && l.payment_status !== selectedStatusFilter) return false;
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>
          Espace Commercial — {user.full_name}
        </h2>
        <p style={{ color: 'var(--slate-500)', fontSize: '0.85rem' }}>
          Consultation exclusive de vos bons attribués, chargements et règlements
        </p>
      </div>

      {/* KPI DU COMMERCIAL */}
      <div className="metrics-grid">
        <div className="kpi-card indigo">
          <div className="kpi-label">Mes Bons Disponibles</div>
          <div className="kpi-value">{totalAvailable}</div>
          <div className="kpi-sub">
            Attribués : {totalAssigned} • Utilisés : {totalUsed}
          </div>
        </div>

        <div className="kpi-card teal">
          <div className="kpi-label">Mes Chargements</div>
          <div className="kpi-value">{loadings.length}</div>
          <div className="kpi-sub">Tonnage : {formatTonnage(totalTonnage)}</div>
        </div>

        <div className="kpi-card teal">
          <div className="kpi-label">Total Facturé</div>
          <div className="kpi-value">{formatFCFA(totalInvoiced)}</div>
          <div className="kpi-sub">Chiffre d'affaires de vos chargements</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-label">Déjà Réglé</div>
          <div className="kpi-value">{formatFCFA(totalPaid)}</div>
          <div className="kpi-sub">Montants encaissés</div>
        </div>

        <div className="kpi-card rose">
          <div className="kpi-label">Reste à Recouvrer</div>
          <div className="kpi-value">{formatFCFA(totalRemaining)}</div>
          <div className="kpi-sub">Solde restant dû de vos clients</div>
        </div>

        <div className="kpi-card amber">
          <div className="kpi-label">Partiels</div>
          <div className="kpi-value">{partialCount}</div>
          <div className="kpi-sub">Avec acompte</div>
        </div>

        <div className="kpi-card rose">
          <div className="kpi-label">Non Payés</div>
          <div className="kpi-value">{unpaidCount}</div>
          <div className="kpi-sub">Sans aucun versement</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-label">Soldés</div>
          <div className="kpi-value">{paidCount}</div>
          <div className="kpi-sub">Totalement payés</div>
        </div>
      </div>

      {/* HISTORIQUE PERSONNEL DU COMMERCIAL */}
      <div className="card-section">
        <div className="section-header">
          <div className="section-title">
            <Truck size={18} color="var(--primary-600)" />
            <span>Mes Chargements ({filteredLoadings.length})</span>
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

        {filteredLoadings.length === 0 ? (
          <div className="empty-state">
            <Truck className="empty-icon" />
            <div className="empty-title">Aucun chargement pour le moment</div>
            <div className="empty-desc">
              {loadings.length === 0
                ? "Aucun chargement n'a encore été enregistré à votre nom par le secrétaire."
                : "Aucun chargement ne correspond aux filtres de recherche."}
            </div>
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
                  <th>Total Facturé</th>
                  <th>Montant Payé</th>
                  <th>Reste Dû</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoadings.map((l) => (
                  <tr key={l.id}>
                    <td>{formatDateFr(l.loading_date)}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary-700)' }}>
                      #{l.voucher_number}
                    </td>
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
