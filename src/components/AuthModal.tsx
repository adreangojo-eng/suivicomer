import React, { useState } from 'react';
import { authService } from '../services/authService';
import { dataService } from '../services/dataService';
import { UserRole, UserProfile, Business, BusinessMember, Carriere } from '../types';
import { offlineStorage } from '../services/offlineDb';
import { Truck, ShieldCheck, User, Building, Lock, Mail, Phone, Key, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: (user: UserProfile, business: Business, member: BusinessMember, carriere?: Carriere) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<'login' | 'commercial_login' | 'register'>('login');

  // Formulaire de connexion Agréé / Secrétaire
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Formulaire de connexion Commercial
  const [commIdentifier, setCommIdentifier] = useState('');
  const [commPassword, setCommPassword] = useState('');
  const [showCommPassword, setShowCommPassword] = useState(false);

  // Formulaire d'inscription Agréé
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await authService.login(loginEmail, loginPassword);
      if (res.success) {
        const session = await authService.getCurrentSession();
        if (session.user && session.business && session.member) {
          onAuthenticated(session.user, session.business, session.member);
        }
      } else {
        setErrorMsg(res.error || 'Identifiants invalides');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleCommercialLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!commIdentifier.trim()) {
      setErrorMsg("Veuillez renseigner votre code d'accès commercial ou votre numéro de téléphone.");
      return;
    }

    setLoading(true);
    try {
      const res = await dataService.loginCommercial(commIdentifier, commPassword);
      if (res.success && res.commercial) {
        const commUser: UserProfile = {
          id: res.commercial.user_id || res.commercial.id,
          full_name: res.commercial.full_name,
          role: 'commercial',
          phone: res.commercial.phone,
          created_at: res.commercial.created_at,
        };

        const commBusiness: Business = {
          id: res.commercial.business_id,
          name: res.carriere ? `${res.carriere.name}` : 'Entreprise Agréé',
          owner_id: 'agree_owner',
          created_at: new Date().toISOString(),
        };

        const commMember: BusinessMember = {
          id: `mem_${res.commercial.id}`,
          business_id: res.commercial.business_id,
          carriere_id: res.commercial.carriere_id,
          user_id: commUser.id,
          role: 'commercial',
          is_active: true,
          can_edit_payments: false,
          created_at: new Date().toISOString(),
        };

        await offlineStorage.setMeta('cached_profile', commUser);
        await offlineStorage.setMeta('cached_business', commBusiness);
        await offlineStorage.setMeta('cached_member', commMember);

        onAuthenticated(commUser, commBusiness, commMember, res.carriere);
      } else {
        setErrorMsg(res.error || 'Identifiants commercial incorrects');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de se connecter');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterAgree = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName || !businessName || !email || !password) {
      setErrorMsg('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.registerAgree({
        email,
        password,
        fullName,
        businessName,
        phone,
      });

      if (res.success) {
        const session = await authService.getCurrentSession();
        if (session.user && session.business && session.member) {
          // L'Agréé est maintenant créé. Le système va l'amener sur la page obligatoire
          // "Créer une nouvelle carrière" !
          onAuthenticated(session.user, session.business, session.member);
        }
      } else {
        setErrorMsg(res.error || 'Erreur lors de la création du compte');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '520px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem auto',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)',
            }}
          >
            <Truck size={30} color="white" />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800 }}>SUIVICOMER</h2>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Gestion des carrières, des bons et suivi des chargements
          </p>
        </div>

        {/* 3 Onglets : Connexion Direction / Espace Commercial / Inscription Agréé */}
        <div
          style={{
            display: 'flex',
            background: 'var(--slate-100)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            gap: '2px',
          }}
        >
          <button
            type="button"
            onClick={() => { setTab('login'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '0.55rem 0.25rem',
              border: 'none',
              background: tab === 'login' ? 'white' : 'transparent',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.78rem',
              color: tab === 'login' ? 'var(--slate-900)' : 'var(--slate-500)',
              boxShadow: tab === 'login' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
            }}
          >
            Agréé / Secrétaire
          </button>
          <button
            type="button"
            onClick={() => { setTab('commercial_login'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '0.55rem 0.25rem',
              border: 'none',
              background: tab === 'commercial_login' ? 'white' : 'transparent',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.78rem',
              color: tab === 'commercial_login' ? 'var(--slate-900)' : 'var(--slate-500)',
              boxShadow: tab === 'commercial_login' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
            }}
          >
            Espace Commercial
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setErrorMsg(null); }}
            style={{
              flex: 1,
              padding: '0.55rem 0.25rem',
              border: 'none',
              background: tab === 'register' ? 'white' : 'transparent',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.78rem',
              color: tab === 'register' ? 'var(--slate-900)' : 'var(--slate-500)',
              boxShadow: tab === 'register' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
            }}
          >
            Créer un Agréé
          </button>
        </div>

        {errorMsg && (
          <div
            className="banner-alert"
            style={{
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              borderLeft: '4px solid #ef4444',
            }}
          >
            <span>{errorMsg}</span>
            {tab === 'login' && errorMsg.includes('compte') && (
              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMsg(null); }}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.75rem',
                  alignSelf: 'flex-start',
                  fontWeight: 600,
                  marginTop: '0.2rem',
                }}
              >
                Créer mon compte Agréé maintenant &rarr;
              </button>
            )}
          </div>
        )}

        {/* 1. CONNEXION DIRECTION & SECRÉTARIAT */}
        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email professionnel</label>
              <input
                type="email"
                className="form-input"
                placeholder="direction@carriere.ci"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: '2.5rem' }}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--slate-400)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem',
                  }}
                  title={showLoginPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>

            <div
              style={{
                textAlign: 'center',
                marginTop: '1.25rem',
                fontSize: '0.84rem',
                color: 'var(--slate-600)',
                borderTop: '1px solid var(--slate-100)',
                paddingTop: '1rem',
              }}
            >
              Pas encore de compte Agréé ?{' '}
              <button
                type="button"
                onClick={() => { setTab('register'); setErrorMsg(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-600)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Créer un compte Agréé
              </button>
            </div>
          </form>
        )}

        {/* 2. ESPACE CONNEXION COMMERCIAL (ACCÈS DIRECT PAR CODE OU TÉLÉPHONE) */}
        {tab === 'commercial_login' && (
          <form onSubmit={handleCommercialLogin}>
            <div className="form-group">
              <label className="form-label">Code d'accès ou N° de Téléphone du Commercial *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: COMM-1001 ou 0122334455"
                  value={commIdentifier}
                  onChange={(e) => setCommIdentifier(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Code PIN / Mot de passe (par défaut 1234) *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCommPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingRight: '2.5rem' }}
                  placeholder="••••"
                  value={commPassword}
                  onChange={(e) => setCommPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCommPassword(!showCommPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--slate-400)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.25rem',
                  }}
                  title={showCommPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  tabIndex={-1}
                >
                  {showCommPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
              💡 Vos identifiants vous sont remis directement par l'agréé lors de votre enregistrement dans la carrière.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {loading ? 'Connexion...' : 'Accéder à mes bons et chargements'}
            </button>
          </form>
        )}

        {/* 3. INSCRIPTION AGRÉÉ ET ENTREPRISE */}
        {tab === 'register' && (
          <form onSubmit={handleRegisterAgree}>
            <div className="form-group">
              <label className="form-label">Nom et Prénom de l'Agréé *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Amadou Diallo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nom de l'entreprise *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Société des Granulats Ivoiriens"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Numéro de téléphone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+225 07..."
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email professionnel *</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="contact@societe.ci"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mot de passe *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    className="form-input"
                    style={{ paddingRight: '2.5rem' }}
                    placeholder="Min. 8 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--slate-400)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.25rem',
                    }}
                    title={showRegisterPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    tabIndex={-1}
                  >
                    {showRegisterPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.74rem', color: 'var(--primary-700)', fontWeight: 600, marginBottom: '0.85rem' }}>
              ✓ Dès la création de votre compte, vous serez redirigé vers l'espace obligatoire de création de votre première carrière.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {loading ? 'Création en cours...' : 'Créer mon compte Agréé'}
            </button>

            <div
              style={{
                textAlign: 'center',
                marginTop: '1.25rem',
                fontSize: '0.84rem',
                color: 'var(--slate-600)',
                borderTop: '1px solid var(--slate-100)',
                paddingTop: '1rem',
              }}
            >
              Vous avez déjà un compte ?{' '}
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-600)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Se connecter
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
