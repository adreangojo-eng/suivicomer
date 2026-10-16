import React from 'react';
import { UserProfile, Business, Carriere } from '../types';
import { SyncEngineStatus } from '../services/syncEngine';
import { Truck, Wifi, WifiOff, RefreshCw, AlertTriangle, LogOut, Pickaxe, ChevronDown } from 'lucide-react';

interface NavbarProps {
  user: UserProfile;
  business: Business | null;
  carriere?: Carriere | null;
  syncStatus: SyncEngineStatus;
  onChangeCarriere?: () => void;
  onManualSync: () => void;
  onOpenConflicts: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  business,
  carriere,
  syncStatus,
  onChangeCarriere,
  onManualSync,
  onOpenConflicts,
  onLogout,
}) => {
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'agree':
        return 'Agréé';
      case 'secretaire':
        return 'Secrétaire';
      case 'commercial':
        return 'Commercial';
      default:
        return role;
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-wrapper">
          <div className="brand-icon">
            <Truck size={22} color="white" />
          </div>
          <div>
            <div className="brand-title">SUIVICOMER</div>
            <div className="brand-subtitle">
              {business?.name || 'Gestion des Bons & Chargements'}
            </div>
          </div>
        </div>

        {/* SÉLECTEUR DE CARRIÈRE ACTIVE POUR L'AGRÉÉ */}
        {user.role === 'agree' && carriere && (
          <button
            onClick={onChangeCarriere}
            className="btn btn-secondary"
            style={{
              padding: '0.35rem 0.85rem',
              minHeight: '36px',
              fontSize: '0.82rem',
              background: 'rgba(255, 255, 255, 0.12)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
            title="Changer de carrière ou en créer une nouvelle"
          >
            <Pickaxe size={15} color="#34d399" />
            <span style={{ fontWeight: 700 }}>{carriere.name}</span>
            <ChevronDown size={14} color="var(--slate-300)" />
          </button>
        )}

        {/* NOM DE LA CARRIÈRE POUR SECRÉTAIRE OU COMMERCIAL */}
        {user.role !== 'agree' && carriere && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.82rem',
              color: 'var(--slate-200)',
              fontWeight: 600,
            }}
          >
            <Pickaxe size={15} color="#34d399" />
            <span>{carriere.name}</span>
          </div>
        )}

        <div className="nav-right">
          {/* Badge Conflits s'il y en a */}
          {syncStatus.conflictCount > 0 && (
            <button
              onClick={onOpenConflicts}
              className="status-pill offline"
              title="Des conflits de synchronisation nécessitent votre intervention"
            >
              <AlertTriangle size={14} />
              <span>{syncStatus.conflictCount} conflit(s)</span>
            </button>
          )}

          {/* Badge Réseau / Mode Hors Ligne */}
          <button
            onClick={onManualSync}
            className={`status-pill ${syncStatus.isOnline ? 'online' : 'offline'}`}
            title={
              syncStatus.isOnline
                ? `En ligne — ${syncStatus.pendingCount} en attente de synchronisation`
                : 'Mode Hors Ligne actif — vos saisies sont enregistrées localement'
            }
          >
            {syncStatus.isOnline ? (
              <Wifi size={14} />
            ) : (
              <WifiOff size={14} />
            )}
            <span>
              {syncStatus.isOnline ? 'En ligne' : 'Hors ligne'}
              {syncStatus.pendingCount > 0 && ` (${syncStatus.pendingCount})`}
            </span>
            {syncStatus.isSyncing && (
              <RefreshCw size={12} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
            )}
          </button>

          {/* Badge Rôle */}
          <span className={`role-badge ${user.role}`}>
            {getRoleLabel(user.role)}
          </span>

          {/* Déconnexion */}
          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.75rem', minHeight: '36px' }}
            title="Se déconnecter"
          >
            <LogOut size={16} />
            <span style={{ display: 'none' }}>Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
};
