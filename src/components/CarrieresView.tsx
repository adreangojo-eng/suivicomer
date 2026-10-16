import React, { useState, useEffect } from 'react';
import { Carriere, Business, UserProfile } from '../types';
import { dataService } from '../services/dataService';
import { offlineStorage } from '../services/offlineDb';
import {
  Pickaxe,
  Plus,
  ArrowRight,
  MapPin,
  Phone,
  Truck,
  Users,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

interface CarrieresViewProps {
  business: Business;
  user: UserProfile;
  onSelectCarriere: (carriere: Carriere) => void;
}

export const CarrieresView: React.FC<CarrieresViewProps> = ({
  business,
  user,
  onSelectCarriere,
}) => {
  const [carrieres, setCarrieres] = useState<Carriere[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Formulaire nouvelle carrière
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await dataService.getCarrieres(business.id);
      setCarrieres(list);
      // Si la liste est vide, ouvrir automatiquement le formulaire de création
      if (list.length === 0) {
        setShowCreateModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [business.id]);

  const handleCreateCarriere = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Le nom de la carrière est obligatoire.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await dataService.createCarriere({
        businessId: business.id,
        name,
        location,
        phone,
      });

      if (res.success && res.carriere) {
        setName('');
        setLocation('');
        setPhone('');
        setShowCreateModal(false);
        await loadData();
        // Sélectionner immédiatement la nouvelle carrière créée
        onSelectCarriere(res.carriere);
      } else {
        setErrorMsg(res.error || 'Erreur lors de la création de la carrière.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur inattendue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* EN-TÊTE BIENVENUE ET MULTI-CARRIÈRES */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--slate-900) 0%, #172554 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem 1.5rem',
          color: 'white',
          marginBottom: '2rem',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, var(--primary-500), var(--primary-700))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1rem',
            boxShadow: '0 4px 14px rgba(20, 184, 166, 0.4)',
          }}
        >
          <Pickaxe size={32} color="white" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '0.4rem' }}>
          Gestion de Vos Carrières — {business.name}
        </h1>
        <p style={{ color: 'var(--slate-300)', fontSize: '0.92rem', maxWidth: '620px', marginBottom: '1.5rem' }}>
          En tant qu'agréé, vous pouvez gérer <strong>plusieurs carrières distinctes</strong> depuis ce même compte. Sélectionnez une carrière existante ou créez-en une nouvelle pour commencer le suivi de ses bons et commerciaux.
        </p>

        <button
          onClick={() => { setShowCreateModal(true); setErrorMsg(null); }}
          className="btn btn-primary"
          style={{
            fontSize: '1rem',
            padding: '0.85rem 1.75rem',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 12px rgba(20, 184, 166, 0.35)',
          }}
        >
          <Plus size={20} />
          <span>Créer une Nouvelle Carrière</span>
        </button>
      </div>

      {/* LISTE DES CARRIÈRES DISPONIBLES */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
          Vos Carrières Enregistrées ({carrieres.length})
        </h2>
        {carrieres.length > 0 && (
          <button
            onClick={() => { setShowCreateModal(true); setErrorMsg(null); }}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
          >
            <Plus size={15} />
            <span>Ajouter une carrière</span>
          </button>
        )}
      </div>

      {carrieres.length === 0 ? (
        <div className="card-section" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Pickaxe size={48} color="var(--slate-400)" style={{ margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Aucune carrière enregistrée pour l'instant
          </h3>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
            Pour commencer le suivi des chargements, vous devez créer au moins une carrière (ex: Carrière Nord, Carrière d'Attinguié...).
          </p>
          <button
            onClick={() => { setShowCreateModal(true); setErrorMsg(null); }}
            className="btn btn-primary"
          >
            <Plus size={18} />
            <span>Créer ma première carrière</span>
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {carrieres.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelectCarriere(c)}
              className="kpi-card teal"
              style={{
                cursor: 'pointer',
                padding: '1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '190px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-100)',
                      color: 'var(--primary-700)',
                    }}
                  >
                    Site de Carrière
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>
                    ● En activité
                  </span>
                </div>

                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--slate-900)' }}>
                  {c.name}
                </h3>

                {c.location && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.82rem',
                      color: 'var(--slate-500)',
                      marginTop: '0.35rem',
                    }}
                  >
                    <MapPin size={15} color="var(--slate-400)" />
                    <span>{c.location}</span>
                  </div>
                )}

                {c.phone && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.82rem',
                      color: 'var(--slate-500)',
                      marginTop: '0.25rem',
                    }}
                  >
                    <Phone size={15} color="var(--slate-400)" />
                    <span>{c.phone}</span>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '1.25rem',
                  paddingTop: '0.85rem',
                  borderTop: '1px solid var(--slate-100)',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary-700)' }}>
                  Ouvrir l'espace de suivi
                </span>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--primary-600)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CRÉATION DE NOUVELLE CARRIÈRE */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
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
                  <Pickaxe size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Créer une Nouvelle Carrière</h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                    Ajoutez un nouveau site d'exploitation pour votre entreprise
                  </p>
                </div>
              </div>
              {carrieres.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="close-btn"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="banner-alert" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateCarriere}>
              <div className="form-group">
                <label className="form-label">Nom de la carrière *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Carrière d'Attinguié 1, Carrière PK 32..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Localisation / Zone</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Route d'Alépé, Km 24"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Téléphone du site / Responsable</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="Ex: +225 07 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '1.25rem' }}>
                ℹ️ Une fois créée, cette carrière aura ses propres commerciaux, ses propres plages de bons numérotés et son propre suivi des chargements.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {carrieres.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Annuler
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ flex: carrieres.length > 0 ? 2 : 1 }}
                >
                  {submitting ? 'Création en cours...' : 'Enregistrer la carrière'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
