import React, { useState, useEffect } from 'react';
import { Commercial, Business, Carriere } from '../types';
import { dataService } from '../services/dataService';
import { Users, X, Plus, Key, Phone, Power, AlertCircle, Copy, Check, Star } from 'lucide-react';

interface CommercialsModalProps {
  business: Business;
  carriere?: Carriere | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const CommercialsModal: React.FC<CommercialsModalProps> = ({
  business,
  carriere,
  onClose,
  onUpdated,
}) => {
  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [password, setPassword] = useState('1234');
  const [isSecretary, setIsSecretary] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = () => {
    dataService.getCommercials(business.id, carriere?.id).then(setCommercials);
  };

  useEffect(() => {
    loadData();
    // Générer un code d'accès aléatoire par défaut pour faciliter la saisie
    setAccessCode(`COMM-${Math.floor(1000 + Math.random() * 9000)}`);
  }, [business.id, carriere?.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Le nom du commercial est requis.');
      return;
    }

    setLoading(true);
    try {
      const res = await dataService.addCommercial({
        businessId: business.id,
        carriereId: carriere?.id,
        fullName,
        phone,
        accessCode,
        password,
        isSecretary,
        canEditPayments: isSecretary,
      });

      if (res.success) {
        setFullName('');
        setPhone('');
        setAccessCode(`COMM-${Math.floor(1000 + Math.random() * 9000)}`);
        setPassword('1234');
        setIsSecretary(false);
        loadData();
        onUpdated();
      } else {
        setErrorMsg(res.error || "Erreur lors de l'ajout.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await dataService.toggleCommercialActive(id, !current);
    loadData();
    onUpdated();
  };

  const handleToggleSecretary = async (id: string, newSec: boolean) => {
    await dataService.toggleCommercialSecretary(id, newSec);
    loadData();
    onUpdated();
  };

  const copyCredentials = (c: Commercial) => {
    const text = `Vos accès SUIVICOMER (${carriere?.name || business.name}) :\nIdentifiant / Code : ${c.access_code || c.phone}\nMot de passe : ${c.password || '1234'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '620px' }}>
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
              <Users size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Gestion des Commerciaux</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--slate-500)' }}>
                {carriere ? `Rattachés à : ${carriere.name}` : business.name}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="banner-alert" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulaire d'ajout avec identifiants pour le commercial */}
        <form
          onSubmit={handleAdd}
          style={{
            background: 'var(--slate-50)',
            padding: '1.15rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--slate-200)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.65rem' }}>
            Ajouter un commercial et générer ses accès
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Nom et Prénom *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Koffi Serge"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Téléphone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="Ex: +225 01 22 33 44"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Code d'accès / Identifiant de connexion</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: COMM-1234"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.72rem' }}>Mot de passe / Code PIN</label>
              <input
                type="text"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              marginBottom: '0.75rem',
              background: isSecretary ? '#fef3c7' : 'white',
              border: isSecretary ? '1px solid #fde68a' : '1px solid var(--slate-200)',
              padding: '0.55rem 0.8rem',
              borderRadius: '8px',
              transition: 'all 0.15s',
            }}
          >
            <input
              type="checkbox"
              id="isSecCheckbox"
              checked={isSecretary}
              onChange={(e) => setIsSecretary(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary-600)', cursor: 'pointer' }}
            />
            <label htmlFor="isSecCheckbox" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--slate-800)', cursor: 'pointer' }}>
              ⭐ Désigner également comme <strong>Secrétaire</strong> (autorisation de modifier les paiements & bons)
            </label>
          </div>

          <div style={{ fontSize: '0.74rem', color: 'var(--slate-500)', marginBottom: '0.75rem' }}>
            ℹ️ Le commercial utilisera ce <strong>Code d'accès</strong> (ou son Téléphone) et son <strong>Code PIN</strong> pour se connecter directement depuis la page d'accueil.
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.65rem' }}
          >
            <Plus size={16} />
            <span>{loading ? 'Création en cours...' : 'Enregistrer le commercial & ses accès'}</span>
          </button>
        </form>

        {/* Liste des commerciaux */}
        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--slate-500)', marginBottom: '0.5rem' }}>
            Commerciaux de la carrière ({commercials.length})
          </div>
          {commercials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-400)', fontSize: '0.85rem' }}>
              Aucun commercial dans cette carrière. Utilisez le formulaire ci-dessus pour ajouter votre premier commercial.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {commercials.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 0.95rem',
                    background: c.is_active ? 'white' : 'var(--slate-100)',
                    border: '1px solid var(--slate-200)',
                    borderRadius: 'var(--radius-md)',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: c.is_active ? 'var(--slate-900)' : 'var(--slate-500)' }}>
                        {c.full_name}
                      </span>
                      {c.is_secretary ? (
                        <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', background: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: 700 }}>
                          ⭐ Secrétaire
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', background: 'var(--slate-100)', color: 'var(--slate-600)', borderRadius: '4px', fontWeight: 600 }}>
                          Commercial
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--slate-500)', marginTop: '0.15rem' }}>
                      Identifiant : <strong style={{ color: 'var(--primary-700)' }}>{c.access_code || c.phone}</strong> • PIN : <strong>{c.password || c.pin || '1234'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleSecretary(c.id, !c.is_secretary)}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.35rem 0.65rem',
                        minHeight: '34px',
                        fontSize: '0.74rem',
                        background: c.is_secretary ? '#fef3c7' : undefined,
                        borderColor: c.is_secretary ? '#fde68a' : undefined,
                        color: c.is_secretary ? '#92400e' : undefined,
                      }}
                      title="Attribuer ou retirer l'autorisation de Secrétaire"
                    >
                      <Star size={14} color={c.is_secretary ? '#d97706' : 'currentColor'} />
                      <span>{c.is_secretary ? 'Secrétaire' : 'Désigner Secrétaire'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => copyCredentials(c)}
                      className="btn btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', minHeight: '34px', fontSize: '0.74rem' }}
                      title="Copier les identifiants pour les envoyer au commercial"
                    >
                      {copiedId === c.id ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                      <span>{copiedId === c.id ? 'Copié !' : 'Partager'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(c.id, c.is_active)}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.35rem 0.65rem',
                        minHeight: '34px',
                        fontSize: '0.74rem',
                        color: c.is_active ? '#dc2626' : '#16a34a',
                      }}
                    >
                      <Power size={14} />
                      <span>{c.is_active ? 'Désactiver' : 'Activer'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
