import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { dataService } from '../services/dataService';
import { UserProfile, Business, BusinessMember, Carriere } from '../types';
import { offlineStorage } from '../services/offlineDb';
import {
  Truck,
  Building,
  Lock,
  Mail,
  Phone,
  Key,
  ArrowRight,
  Eye,
  EyeOff,
  UserCheck,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Users
} from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: (user: UserProfile, business: Business, member: BusinessMember, carriere?: Carriere) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthenticated }) => {
  // Navigation principale : Connexion unique vs Création de compte
  const [mainTab, setMainTab] = useState<'login' | 'register'>('login');

  // Sous-sélection pour l'inscription : Agréé vs Commercial
  const [registerRole, setRegisterRole] = useState<'agree' | 'commercial'>('agree');

  // ==========================================
  // 1. FORMULAIRE DE CONNEXION UNIFIÉE
  // ==========================================
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ==========================================
  // 2. FORMULAIRE D'INSCRIPTION AGRÉÉ
  // ==========================================
  const [agreeFullName, setAgreeFullName] = useState('');
  const [agreeBusinessName, setAgreeBusinessName] = useState('');
  const [agreeEmail, setAgreeEmail] = useState('');
  const [agreePhone, setAgreePhone] = useState('');
  const [agreePassword, setAgreePassword] = useState('');
  const [showAgreePassword, setShowAgreePassword] = useState(false);

  // ==========================================
  // 3. FORMULAIRE D'INSCRIPTION COMMERCIAL
  // ==========================================
  const [commFullName, setCommFullName] = useState('');
  const [commPhone, setCommPhone] = useState('');
  const [commEmail, setCommEmail] = useState('');
  const [commPin, setCommPin] = useState('1234');
  const [commBusinessId, setCommBusinessId] = useState('');
  const [availableBusinesses, setAvailableBusinesses] = useState<Array<{ id: string; name: string; phone?: string }>>([]);

  // États partagés
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Charger la liste des entreprises pour l'auto-inscription des commerciaux
  useEffect(() => {
    dataService.getPublicBusinesses().then((list) => {
      setAvailableBusinesses(list);
      if (list.length > 0 && !commBusinessId) {
        setCommBusinessId(list[0].id);
      }
    });
  }, []);

  // ==========================================
  // GESTIONNAIRE DE CONNEXION UNIFIÉE
  // ==========================================
  const handleUnifiedLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setErrorMsg('Veuillez renseigner votre identifiant et votre mot de passe (ou code PIN).');
      return;
    }

    setLoading(true);

    try {
      // 1. Tenter la connexion par compte Agréé (si l'identifiant ressemble à un email)
      if (cleanId.includes('@')) {
        const agreeRes = await authService.login(cleanId, cleanPass);
        if (agreeRes.success) {
          const session = await authService.getCurrentSession();
          if (session.user && session.business && session.member) {
            onAuthenticated(session.user, session.business, session.member);
            return;
          }
        }
      }

      // 2. Tenter la connexion Commercial (Code d'accès ex: COMM-9811, téléphone ou email commercial)
      const commRes = await dataService.loginCommercial(cleanId, cleanPass);
      if (commRes.success && commRes.commercial) {
        const comm = commRes.commercial;
        const isSec = comm.is_secretary ?? false;
        const canPay = comm.can_edit_payments ?? isSec;

        const commUser: UserProfile = {
          id: comm.user_id || comm.id,
          full_name: comm.full_name,
          role: isSec ? 'secretaire' : 'commercial',
          phone: comm.phone,
          email: comm.email,
          created_at: comm.created_at,
        };

        const commBusiness: Business = commRes.business || {
          id: comm.business_id,
          name: commRes.carriere ? commRes.carriere.name : 'Entreprise Agréé',
          owner_id: 'agree_owner',
          created_at: new Date().toISOString(),
        };

        const commMember: BusinessMember = {
          id: `mem_${comm.id}`,
          business_id: comm.business_id,
          carriere_id: comm.carriere_id,
          user_id: commUser.id,
          role: isSec ? 'secretaire' : 'commercial',
          is_active: true,
          can_edit_payments: canPay,
          created_at: new Date().toISOString(),
        };

        await offlineStorage.setMeta('cached_profile', commUser);
        await offlineStorage.setMeta('cached_business', commBusiness);
        await offlineStorage.setMeta('cached_member', commMember);

        onAuthenticated(commUser, commBusiness, commMember, commRes.carriere);
        return;
      }

      // Si le compte commercial est explicitement désactivé
      if (commRes.error && commRes.error.includes('désactivé')) {
        setErrorMsg(commRes.error);
        return;
      }

      // 3. Si échec de la détection
      setErrorMsg(
        cleanId.includes('@')
          ? "Identifiants incorrects. Vérifiez votre adresse email et votre mot de passe."
          : "Identifiant ou code d'accès commercial incorrect. Vérifiez votre code (ex: COMM-9811), votre numéro de téléphone ou votre code PIN."
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la connexion. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // GESTIONNAIRE D'INSCRIPTION AGRÉÉ
  // ==========================================
  const handleRegisterAgree = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!agreeFullName.trim() || !agreeBusinessName.trim() || !agreeEmail.trim() || !agreePassword) {
      setErrorMsg('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    if (agreePassword.length < 8) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.registerAgree({
        email: agreeEmail,
        password: agreePassword,
        fullName: agreeFullName,
        businessName: agreeBusinessName,
        phone: agreePhone,
      });

      if (res.success && res.needsEmailConfirmation) {
        setInfoMsg(
          `Compte créé avec succès ! Un email de confirmation a été envoyé à ${agreeEmail}. Cliquez sur le lien reçu, puis connectez-vous.`
        );
        setIdentifier(agreeEmail);
        setMainTab('login');
      } else if (res.success) {
        const session = await authService.getCurrentSession();
        if (session.user && session.business && session.member) {
          onAuthenticated(session.user, session.business, session.member);
        } else {
          setInfoMsg('Compte Agréé créé avec succès ! Vous pouvez maintenant vous connecter.');
          setIdentifier(agreeEmail);
          setMainTab('login');
        }
      } else {
        setErrorMsg(res.error || "Erreur lors de la création du compte Agréé.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible de créer le compte');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // GESTIONNAIRE D'INSCRIPTION COMMERCIAL
  // ==========================================
  const handleRegisterCommercial = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!commFullName.trim() || !commPhone.trim()) {
      setErrorMsg('Le nom complet et le numéro de téléphone sont obligatoires.');
      return;
    }

    if (!commBusinessId) {
      setErrorMsg("Veuillez sélectionner l'entreprise / Agréé à laquelle vous êtes rattaché.");
      return;
    }

    setLoading(true);
    try {
      const res = await dataService.registerCommercialSelf({
        businessId: commBusinessId,
        fullName: commFullName,
        phone: commPhone,
        email: commEmail,
        pin: commPin,
      });

      if (res.success && res.commercial) {
        const code = res.accessCode || res.commercial.access_code;
        setInfoMsg(
          `Félicitations ${commFullName} ! Votre compte commercial a été créé. Votre Code d'accès personnel est : ${code}. Notez-le bien pour vous connecter.`
        );
        setIdentifier(code || commPhone);
        setPassword(commPin || '1234');
        setMainTab('login');
      } else {
        setErrorMsg(res.error || "Erreur lors de l'inscription du commercial.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Impossible d\'enregistrer le profil commercial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '520px', padding: '2rem 1.8rem' }}>
        {/* En-tête de marque SUIVICOMER */}
        <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--primary-600), var(--primary-800))',
              color: 'white',
              boxShadow: '0 8px 20px rgba(13, 148, 136, 0.25)',
              marginBottom: '0.75rem',
            }}
          >
            <Truck size={30} />
          </div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: 'var(--slate-900)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            SUIVICOMER
          </h1>
          <p style={{ color: 'var(--slate-500)', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
            Gestion des carrières, des bons et suivi des chargements
          </p>
        </div>

        {/* Navigation Principale Simplifiée (2 Onglets uniques) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'var(--slate-100)',
            padding: '4px',
            borderRadius: '12px',
            marginBottom: '1.25rem',
            gap: '4px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMainTab('login');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            style={{
              padding: '0.65rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mainTab === 'login' ? 'white' : 'transparent',
              color: mainTab === 'login' ? 'var(--primary-700)' : 'var(--slate-600)',
              boxShadow: mainTab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => {
              setMainTab('register');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            style={{
              padding: '0.65rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: mainTab === 'register' ? 'white' : 'transparent',
              color: mainTab === 'register' ? 'var(--primary-700)' : 'var(--slate-600)',
              boxShadow: mainTab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            Créer un compte
          </button>
        </div>

        {/* Bannières d'information et d'erreur */}
        {infoMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              padding: '0.75rem 1rem',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              color: '#065f46',
              fontSize: '0.84rem',
              marginBottom: '1rem',
              lineHeight: 1.4,
            }}
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{infoMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              padding: '0.75rem 1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '0.84rem',
              marginBottom: '1rem',
              lineHeight: 1.4,
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VUE 1 : CONNEXION UNIFIÉE (Détection automatique du rôle) */}
        {/* ========================================================= */}
        {mainTab === 'login' && (
          <form onSubmit={handleUnifiedLogin}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Identifiant (Email, Code commercial ou Téléphone) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="ex: nom@email.com, COMM-9811 ou 679686939"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                  required
                />
                <UserCheck
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--slate-400)',
                  }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Mot de passe ou Code PIN *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  placeholder="Votre mot de passe ou code PIN (ex: 1234)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--slate-400)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--slate-400)',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.8rem',
                fontSize: '0.98rem',
                fontWeight: 700,
                borderRadius: '10px',
                marginBottom: '1rem',
              }}
            >
              <span>{loading ? 'Connexion en cours...' : 'Se connecter à SUIVICOMER'}</span>
              <ArrowRight size={18} />
            </button>

            <div
              style={{
                padding: '0.75rem',
                background: 'var(--slate-50)',
                border: '1px dashed var(--slate-200)',
                borderRadius: '8px',
                fontSize: '0.78rem',
                color: 'var(--slate-600)',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              💡 <strong>Détection automatique :</strong> Que vous soyez <strong>Agréé</strong>,{' '}
              <strong>Commercial</strong> ou <strong>Secrétaire</strong>, l'application détecte
              instantanément votre profil et vos accès.
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* VUE 2 : CRÉATION DE COMPTE (Choix Agréé vs Commercial)    */}
        {/* ========================================================= */}
        {mainTab === 'register' && (
          <div>
            {/* Sélecteur de rôle d'inscription */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.6rem',
                marginBottom: '1.25rem',
              }}
            >
              <button
                type="button"
                onClick={() => setRegisterRole('agree')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.85rem 0.5rem',
                  border: registerRole === 'agree' ? '2px solid var(--primary-600)' : '1px solid var(--slate-200)',
                  background: registerRole === 'agree' ? 'var(--primary-50)' : 'white',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Building
                  size={24}
                  color={registerRole === 'agree' ? 'var(--primary-700)' : 'var(--slate-400)'}
                  style={{ marginBottom: '0.35rem' }}
                />
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: registerRole === 'agree' ? 'var(--primary-800)' : 'var(--slate-700)',
                  }}
                >
                  Je suis un Agréé
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textAlign: 'center', marginTop: '2px' }}>
                  Propriétaire de carrière
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRegisterRole('commercial')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '0.85rem 0.5rem',
                  border: registerRole === 'commercial' ? '2px solid var(--primary-600)' : '1px solid var(--slate-200)',
                  background: registerRole === 'commercial' ? 'var(--primary-50)' : 'white',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Users
                  size={24}
                  color={registerRole === 'commercial' ? 'var(--primary-700)' : 'var(--slate-400)'}
                  style={{ marginBottom: '0.35rem' }}
                />
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: registerRole === 'commercial' ? 'var(--primary-800)' : 'var(--slate-700)',
                  }}
                >
                  Je suis un Commercial
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textAlign: 'center', marginTop: '2px' }}>
                  Vendeur / Suivi des bons
                </span>
              </button>
            </div>

            {/* FORMULAIRE INSCRIPTION AGRÉÉ */}
            {registerRole === 'agree' && (
              <form onSubmit={handleRegisterAgree}>
                <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Nom et Prénom de l'Agréé *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: Paul Biya"
                    value={agreeFullName}
                    onChange={(e) => setAgreeFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Nom de l'Entreprise / Exploitation *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: Carrières du Centre"
                    value={agreeBusinessName}
                    onChange={(e) => setAgreeBusinessName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.6rem', marginBottom: '0.8rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Email de connexion *
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="agree@domaine.com"
                      value={agreeEmail}
                      onChange={(e) => setAgreeEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="6XXXXXXXX"
                      value={agreePhone}
                      onChange={(e) => setAgreePhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Mot de passe (8 caractères min.) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAgreePassword ? 'text' : 'password'}
                      className="form-input"
                      style={{ paddingRight: '2.5rem' }}
                      placeholder="••••••••"
                      value={agreePassword}
                      onChange={(e) => setAgreePassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAgreePassword(!showAgreePassword)}
                      style={{
                        position: 'absolute',
                        right: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--slate-400)',
                      }}
                    >
                      {showAgreePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                  }}
                >
                  <span>{loading ? 'Création en cours...' : 'Créer mon compte Agréé'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}

            {/* FORMULAIRE INSCRIPTION COMMERCIAL */}
            {registerRole === 'commercial' && (
              <form onSubmit={handleRegisterCommercial}>
                <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Nom et Prénom du Commercial *
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: Jean Dupont"
                    value={commFullName}
                    onChange={(e) => setCommFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '0.8rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Entreprise / Agréé de rattachement *
                  </label>
                  {availableBusinesses.length > 0 ? (
                    <select
                      className="form-input"
                      value={commBusinessId}
                      onChange={(e) => setCommBusinessId(e.target.value)}
                      required
                    >
                      {availableBusinesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.phone ? `(${b.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Identifiant de l'entreprise"
                      value={commBusinessId}
                      onChange={(e) => setCommBusinessId(e.target.value)}
                      required
                    />
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                    Sélectionnez l'Agréé qui vous a recruté.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.6rem', marginBottom: '0.8rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      N° Téléphone du Commercial *
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="ex: 679686939"
                      value={commPhone}
                      onChange={(e) => setCommPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Code PIN personnel *
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="ex: 1234"
                      value={commPin}
                      onChange={(e) => setCommPin(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Adresse Email (Optionnelle)
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="commercial@exemple.com"
                    value={commEmail}
                    onChange={(e) => setCommEmail(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    borderRadius: '10px',
                  }}
                >
                  <span>{loading ? 'Création en cours...' : 'Créer mon profil Commercial'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
