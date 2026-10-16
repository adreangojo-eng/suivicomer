import React, { useState, useEffect } from 'react';
import { UserProfile, Business, BusinessMember, Loading, Carriere } from './types';
import { authService } from './services/authService';
import { syncEngine, SyncEngineStatus } from './services/syncEngine';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CarrieresView } from './components/CarrieresView';
import { AgreeDashboard } from './components/AgreeDashboard';
import { SecretaryDashboard } from './components/SecretaryDashboard';
import { CommercialDashboard } from './components/CommercialDashboard';
import { LoadingFormModal } from './components/LoadingFormModal';
import { BonRangeModal } from './components/BonRangeModal';
import { CommercialsModal } from './components/CommercialsModal';
import { SecretariesModal } from './components/SecretariesModal';
import { PaymentModal } from './components/PaymentModal';
import { ConflictsModal } from './components/ConflictsModal';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [member, setMember] = useState<BusinessMember | null>(null);
  const [activeCarriere, setActiveCarriere] = useState<Carriere | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // État du moteur de synchronisation
  const [syncStatus, setSyncStatus] = useState<SyncEngineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    conflictCount: 0,
    lastSyncedAt: null,
    lastError: null,
  });

  // Modales
  const [showLoadingModal, setShowLoadingModal] = useState(false);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [showCommercialsModal, setShowCommercialsModal] = useState(false);
  const [showSecretariesModal, setShowSecretariesModal] = useState(false);
  const [paymentModalLoading, setPaymentModalLoading] = useState<Loading | null>(null);
  const [showConflictsModal, setShowConflictsModal] = useState(false);

  // Clé pour forcer le rafraîchissement des dashboards
  const [dashboardKey, setDashboardKey] = useState(0);

  // Charger la session (en ligne ou cache offline)
  useEffect(() => {
    authService.getCurrentSession().then((session) => {
      setUser(session.user);
      setBusiness(session.business);
      setMember(session.member);
      setLoadingSession(false);
    });

    // Écouter le moteur de synchronisation
    const unsubscribe = syncEngine.subscribe((status) => {
      setSyncStatus(status);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthenticated = (
    u: UserProfile,
    b: Business,
    m: BusinessMember,
    carriere?: Carriere
  ) => {
    setUser(u);
    setBusiness(b);
    setMember(m);
    if (carriere) {
      setActiveCarriere(carriere);
    } else {
      // Pour un agréé qui vient de s'inscrire ou de se connecter sans carrière par défaut,
      // on laisse activeCarriere à null pour qu'il arrive directement sur la page obligatoire "Créer une carrière"
      setActiveCarriere(null);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setBusiness(null);
    setMember(null);
    setActiveCarriere(null);
  };

  const handleRefresh = () => {
    setDashboardKey((prev) => prev + 1);
  };

  if (loadingSession) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          background: 'var(--slate-100)',
        }}
      >
        <RefreshCw size={36} color="var(--primary-600)" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '1rem', color: 'var(--slate-600)', fontWeight: 600 }}>
          Initialisation de SUIVICOMER...
        </p>
      </div>
    );
  }

  if (!user || !business || !member) {
    return <AuthModal onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="app-container">
      <Navbar
        user={user}
        business={business}
        carriere={activeCarriere}
        syncStatus={syncStatus}
        onChangeCarriere={() => setActiveCarriere(null)}
        onManualSync={() => syncEngine.syncPendingOperations()}
        onOpenConflicts={() => setShowConflictsModal(true)}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {/* BANNIÈRE D'AVERTISSEMENT MODE HORS LIGNE SI ACTIF */}
        {!syncStatus.isOnline && (
          <div className="banner-alert warning">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} />
              <span>
                <strong>Mode Hors Ligne Actif :</strong> Vous pouvez continuer d'enregistrer vos chargements normalement. Vos données sont sécurisées dans le terminal et seront synchronisées automatiquement dès le retour du réseau.
              </span>
            </div>
          </div>
        )}

        {/* 1. ESPACE AGRÉÉ : SI AUCUNE CARRIÈRE SÉLECTIONNÉE -> PAGE OBLIGATOIRE "MES CARRIÈRES / CRÉER UNE NOUVELLE CARRIÈRE" */}
        {user.role === 'agree' && !activeCarriere && (
          <CarrieresView
            business={business}
            user={user}
            onSelectCarriere={(carriere) => setActiveCarriere(carriere)}
          />
        )}

        {/* 2. ESPACE AGRÉÉ : LORSQU'UNE CARRIÈRE EST CHOISIE -> DASHBOARD DE CETTE CARRIÈRE */}
        {user.role === 'agree' && activeCarriere && (
          <AgreeDashboard
            key={`${activeCarriere.id}_${dashboardKey}`}
            user={user}
            business={business}
            member={member}
            carriere={activeCarriere}
            onChangeCarriere={() => setActiveCarriere(null)}
            onOpenLoadingModal={() => setShowLoadingModal(true)}
            onOpenRangeModal={() => setShowRangeModal(true)}
            onOpenCommercialsModal={() => setShowCommercialsModal(true)}
            onOpenSecretariesModal={() => setShowSecretariesModal(true)}
            onOpenPaymentModal={(loading) => setPaymentModalLoading(loading)}
          />
        )}

        {/* 3. ESPACE SECRÉTARIAT */}
        {user.role === 'secretaire' && (
          <SecretaryDashboard
            key={dashboardKey}
            user={user}
            business={business}
            member={member}
            onOpenLoadingModal={() => setShowLoadingModal(true)}
            onOpenPaymentModal={(loading) => setPaymentModalLoading(loading)}
          />
        )}

        {/* 4. ESPACE COMMERCIAL */}
        {user.role === 'commercial' && (
          <CommercialDashboard
            key={dashboardKey}
            user={user}
            business={business}
            member={member}
          />
        )}
      </main>

      {/* MODALES D'INTERACTION */}
      {showLoadingModal && (
        <LoadingFormModal
          business={business}
          carriere={activeCarriere}
          user={user}
          onClose={() => setShowLoadingModal(false)}
          onSuccess={() => {
            setShowLoadingModal(false);
            handleRefresh();
          }}
        />
      )}

      {showRangeModal && (
        <BonRangeModal
          business={business}
          carriere={activeCarriere}
          user={user}
          onClose={() => setShowRangeModal(false)}
          onSuccess={() => {
            setShowRangeModal(false);
            handleRefresh();
          }}
        />
      )}

      {showCommercialsModal && (
        <CommercialsModal
          business={business}
          carriere={activeCarriere}
          onClose={() => setShowCommercialsModal(false)}
          onUpdated={handleRefresh}
        />
      )}

      {showSecretariesModal && (
        <SecretariesModal
          business={business}
          onClose={() => setShowSecretariesModal(false)}
          onUpdated={handleRefresh}
        />
      )}

      {paymentModalLoading && (
        <PaymentModal
          loading={paymentModalLoading}
          member={member}
          onClose={() => setPaymentModalLoading(null)}
          onSuccess={() => {
            setPaymentModalLoading(null);
            handleRefresh();
          }}
        />
      )}

      {showConflictsModal && (
        <ConflictsModal
          business={business}
          onClose={() => setShowConflictsModal(false)}
          onResolved={handleRefresh}
        />
      )}
    </div>
  );
};

export default App;
