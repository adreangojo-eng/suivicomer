import React, { useState } from 'react';
import { authService } from '../services/authService';
import { dataService } from '../services/dataService';
import { UserRole, UserProfile, Business, BusinessMember, Carriere } from '../types';
import { offlineStorage } from '../services/offlineDb';
import { Truck, ShieldCheck, User, Building, Lock, Mail, Phone, Key, ArrowRight } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: (user: UserProfile, business: Business, member: BusinessMember, carriere?: Carriere) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated }) => {
  const [tab, setTab] = useState<'login' | 'commercial_login' | 'register'>('login');

  // Formulaire de connexion Agréé / Secrétaire
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulaire de connexion Commercial
  const [commIdentifier, setCommIdentifier] = useState('');
  const [commPassword, setCommPassword] = useState('');

  // Formulaire d'inscription Agréé
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleQuickDemo = async (role: UserRole) => {
    setLoading(true);
    setErrorMsg(null);

    const busId = 'bus_demo_carriere';
    const demoBusiness: Business = {
      id: busId,
      name: 'Carrière de Granulats Ivoire',
      owner_id: 'usr_agree_demo',
      address: 'Route d\'Alépé, Carrière Nord',
      phone: '+225 07 10 20 30 40',
      created_at: new Date().toISOString(),
    };

    // Assurer qu'au moins une carrière de démonstration existe
    const demoCarriere: Carriere = {
      id: 'carr_demo_nord',
      business_id: busId,
      name: 'Carrière Principale Nord - PK 24',
      location: 'Route d\'Alépé, Kilomètre 24',
      phone: '+225 07 10 20 30 40',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    await offlineStorage.saveCarrieres([demoCarriere]);

    let userProfile: UserProfile;
    let member: BusinessMember;

    if (role === 'agree') {
      userProfile = {
        id: 'usr_agree_demo',
        email: 'directeur@carriere-ivoire.ci',
        full_name: 'Amadou Diallo (Agréé)',
        role: 'agree',
        phone: '+225 07 10 20 30 40',
        created_at: new Date().toISOString(),
      };
      member = {
        id: 'mem_agree_demo',
        business_id: busId,
        user_id: userProfile.id,
        role: 'agree',
        is_active: true,
        can_edit_payments: true,
        created_at: new Date().toISOString(),
      };
    } else if (role === 'secretaire') {
      userProfile = {
        id: 'usr_sec_demo',
        email: 'secretaire@carriere-ivoire.ci',
        full_name: 'Fatou Traoré (Secrétaire)',
        role: 'secretaire',
        phone: '+225 05 55 66 77 88',
        created_at: new Date().toISOString(),
      };
      member = {
        id: 'mem_sec_demo',
        business_id: busId,
        carriere_id: demoCarriere.id,
        user_id: userProfile.id,
        role: 'secretaire',
        is_active: true,
        can_edit_payments: true,
        created_at: new Date().toISOString(),
      };
    } else {
      userProfile = {
        id: 'usr_comm_demo',
        email: 'koffi.serge@carriere-ivoire.ci',
        full_name: 'Koffi Serge (Commercial)',
        role: 'commercial',
        phone: '+225 01 22 33 44 55',
        created_at: new Date().toISOString(),
      };
      member = {
        id: 'mem_comm_demo',
        business_id: busId,
        carriere_id: demoCarriere.id,
        user_id: userProfile.id,
        role: 'commercial',
        is_active: true,
        can_edit_payments: false,
        created_at: new Date().toISOString(),
      };

      // Créer également l'enregistrement commercial pour la démo
      await offlineStorage.saveCommercials([{
        id: 'comm_koffi_demo',
        business_id: busId,
        carriere_id: demoCarriere.id,
        user_id: userProfile.id,
        full_name: 'Koffi Serge',
        phone: '+225 01 22 33 44 55',
        access_code: 'COMM-1001',
        password: '1234',
        is_active: true,
        created_at: new Date().toISOString()
      }]);
    }

    await offlineStorage.setMeta('cached_profile', userProfile);
    await offlineStorage.setMeta('cached_business', demoBusiness);
    await offlineStorage.setMeta('cached_member', member);

    onAuthenticated(userProfile, demoBusiness, member, role !== 'agree' ? demoCarriere : undefined);
    setLoading(false);
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
          <div className="banner-alert" style={{ marginBottom: '1rem' }}>
            <span>{errorMsg}</span>
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
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
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
              <input
                type="password"
                className="form-input"
                placeholder="••••"
                value={commPassword}
                onChange={(e) => setCommPassword(e.target.value)}
                required
              />
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
                <input
                  type="password"
                  className="form-input"
                  placeholder="Min. 8 caractères"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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
          </form>
        )}

        {/* DÉMONSTRATION EN 1 CLIC */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--slate-200)',
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--slate-500)',
              textAlign: 'center',
              marginBottom: '0.65rem',
              letterSpacing: '0.04em',
            }}
          >
            Accès Rapide Test & Démonstration
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => handleQuickDemo('agree')}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.5rem 0.25rem', flexDirection: 'column', gap: '0.2rem' }}
            >
              <ShieldCheck size={18} color="#0369a1" />
              <span>Agréé</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('secretaire')}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.5rem 0.25rem', flexDirection: 'column', gap: '0.2rem' }}
            >
              <User size={18} color="#7c3aed" />
              <span>Secrétaire</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('commercial')}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.5rem 0.25rem', flexDirection: 'column', gap: '0.2rem' }}
            >
              <Building size={18} color="#b45309" />
              <span>Commercial</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
