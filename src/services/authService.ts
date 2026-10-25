import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { offlineStorage } from './offlineDb';
import { UserProfile, Business, BusinessMember } from '../types';

export interface AuthState {
  user: UserProfile | null;
  business: Business | null;
  member: BusinessMember | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string;
}
import { isUuid, generateUuid } from '../utils/uuid';
export { isUuid, generateUuid };

const EMPTY_STATE: AuthState = {
  user: null,
  business: null,
  member: null,
  isAuthenticated: false,
  isLoading: false,
};

export class AuthService {
  /**
   * Récupère l'état courant de la session.
   * - En ligne avec session Supabase : la base fait foi (et le compte Agréé est réparé si incomplet).
   * - Hors ligne : cache local, uniquement s'il est cohérent (identifiants UUID réels).
   */
  async getCurrentSession(): Promise<AuthState> {
    if (!isSupabaseConfigured) {
      return this.getOfflineCachedSession();
    }

    let sessionUser: User | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      sessionUser = data.session?.user ?? null;
    } catch {
      sessionUser = null;
    }

    if (sessionUser && navigator.onLine) {
      try {
        const remote = await this.loadRemoteState(sessionUser);
        if (remote) return remote;
        return {
          ...EMPTY_STATE,
          error:
            "Votre compte est incomplet (profil ou entreprise introuvable). Veuillez vous reconnecter ou contacter le support.",
        };
      } catch {
        // Erreur réseau : on retombe sur le cache, uniquement s'il appartient au même utilisateur
        const cached = await this.getOfflineCachedSession();
        if (cached.user?.id === sessionUser.id) return cached;
        return EMPTY_STATE;
      }
    }

    const cached = await this.getOfflineCachedSession();

    // Hors ligne : on fait confiance au cache validé
    if (!navigator.onLine) return cached;

    // En ligne sans session Supabase : seuls les commerciaux (connexion par code/PIN) restent valides.
    if (cached.user && cached.user.role !== 'commercial') {
      await this.clearSessionCache();
      return EMPTY_STATE;
    }
    return cached;
  }

  /**
   * Charge profil / membre / entreprise depuis Supabase.
   * Si l'utilisateur est un Agréé dont le compte est incomplet, le répare de façon idempotente.
   */
  private async loadRemoteState(authUser: User): Promise<AuthState | null> {
    const fetchState = async () => {
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
      if (profErr) throw profErr;

      const { data: member, error: memErr } = await supabase
        .from('business_members')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (memErr) throw memErr;

      return { profile, member };
    };

    let { profile, member } = await fetchState();

    const metaRole = (authUser.user_metadata?.role as string | undefined) ?? 'agree';
    if ((!profile || !member) && metaRole === 'agree') {
      await this.ensureAgreeAccount(authUser);
      ({ profile, member } = await fetchState());
    }

    if (!profile || !member) return null;

    const { data: business, error: busErr } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', member.business_id)
      .maybeSingle();
    if (busErr) throw busErr;
    if (!business) return null;

    const fullProfile: UserProfile = {
      id: authUser.id,
      email: authUser.email,
      full_name: profile.full_name,
      role: profile.role,
      phone: profile.phone ?? undefined,
      created_at: profile.created_at,
    };

    await offlineStorage.setMeta('cached_profile', fullProfile);
    await offlineStorage.setMeta('cached_business', business);
    await offlineStorage.setMeta('cached_member', member);

    return {
      user: fullProfile,
      business,
      member,
      isAuthenticated: true,
      isLoading: false,
    };
  }

  /**
   * Crée (ou complète) profil + entreprise + rattachement pour un Agréé authentifié.
   * La fonction SQL est idempotente : aucun doublon n'est créé si elle est rappelée.
   */
  private async ensureAgreeAccount(authUser: User): Promise<void> {
    const meta = authUser.user_metadata || {};
    const fullName: string =
      (meta.full_name as string)?.trim() || authUser.email?.split('@')[0] || 'Agréé';
    const businessName: string =
      (meta.business_name as string)?.trim() || `Entreprise ${fullName}`;

    const { error } = await supabase.rpc('create_agree_account', {
      p_full_name: fullName,
      p_business_name: businessName,
      p_phone: (meta.phone as string) || null,
    });
    if (error) throw error;
  }

  private async getOfflineCachedSession(): Promise<AuthState> {
    try {
      const user = await offlineStorage.getMeta<UserProfile>('cached_profile');
      const business = await offlineStorage.getMeta<Business>('cached_business');
      const member = await offlineStorage.getMeta<BusinessMember>('cached_member');

      if (!user || !business || !member) return EMPTY_STATE;

      // Avec Supabase, tout identifiant d'entreprise doit être un vrai UUID.
      // Un cache corrompu (ancien identifiant fabriqué) est purgé.
      if (isSupabaseConfigured && !isUuid(business.id)) {
        await this.clearSessionCache();
        return EMPTY_STATE;
      }

      return { user, business, member, isAuthenticated: true, isLoading: false };
    } catch {
      return EMPTY_STATE;
    }
  }

  private async clearSessionCache(): Promise<void> {
    try {
      await offlineStorage.setMeta('cached_profile', null);
      await offlineStorage.setMeta('cached_business', null);
      await offlineStorage.setMeta('cached_member', null);
    } catch {
      // Ignorer
    }
  }

  /**
   * Inscription d'un nouvel Agréé.
   * Règle de sécurité : seul le rôle 'agree' peut être créé via inscription publique.
   */
  async registerAgree(params: {
    email: string;
    password: string;
    fullName: string;
    businessName: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string; needsEmailConfirmation?: boolean }> {
    if (!isSupabaseConfigured) {
      // Mode local sans projet Supabase (développement uniquement)
      const mockId = generateUuid();
      const now = new Date().toISOString();
      await offlineStorage.setMeta('cached_profile', {
        id: mockId,
        email: params.email,
        full_name: params.fullName,
        role: 'agree',
        phone: params.phone,
        created_at: now,
      } satisfies UserProfile);
      const busId = generateUuid();
      await offlineStorage.setMeta('cached_business', {
        id: busId,
        name: params.businessName,
        owner_id: mockId,
        created_at: now,
      } satisfies Business);
      await offlineStorage.setMeta('cached_member', {
        id: generateUuid(),
        business_id: busId,
        user_id: mockId,
        role: 'agree',
        is_active: true,
        can_edit_payments: true,
        created_at: now,
      } satisfies BusinessMember);
      return { success: true };
    }

    if (params.password.length < 8) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          data: {
            full_name: params.fullName.trim(),
            business_name: params.businessName.trim(),
            phone: params.phone?.trim() || null,
            role: 'agree',
          },
        },
      });

      if (error) {
        const msg = error.message || '';
        if (/already registered|already exists/i.test(msg)) {
          return {
            success: false,
            error: 'Cette adresse email est déjà utilisée. Connectez-vous dans l\'onglet « Agréé / Secrétaire ».',
          };
        }
        if (/rate limit|over_email_send_rate_limit/i.test(msg)) {
          return {
            success: false,
            error: "Limite d'envoi d'emails Supabase atteinte. Pour la débloquer immédiatement : dans votre console Supabase, allez dans Authentication > Providers > Email et décochez 'Confirm email', puis réessayez. Sinon, patientez quelques minutes.",
          };
        }
        if (/Failed to fetch|NetworkError/i.test(msg)) {
          return {
            success: false,
            error: "Impossible de joindre le serveur Supabase (Failed to fetch). Vérifiez votre connexion internet ou l'état de votre projet Supabase.",
          };
        }
        return { success: false, error: msg };
      }

      // Supabase masque les emails déjà inscrits : identities vide = compte existant
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          success: false,
          error: 'Cette adresse email est déjà utilisée. Connectez-vous dans l\'onglet « Agréé / Secrétaire ».',
        };
      }

      if (!data.user) {
        return { success: false, error: "Erreur lors de l'inscription." };
      }

      // Confirmation email requise : pas de session, l'entreprise sera créée à la 1ère connexion
      if (!data.session) {
        return { success: true, needsEmailConfirmation: true };
      }

      await this.ensureAgreeAccount(data.user);
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || '';
      if (/Failed to fetch|NetworkError/i.test(msg)) {
        return {
          success: false,
          error: "Impossible de joindre le serveur Supabase (Failed to fetch). Vérifiez votre connexion internet ou l'état de votre projet Supabase.",
        };
      }
      return { success: false, error: msg || "Impossible de finaliser l'inscription" };
    }
  }

  /**
   * Connexion avec email et mot de passe
   */
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      const cached = await offlineStorage.getMeta<UserProfile>('cached_profile');
      if (cached && cached.email === email) return { success: true };
      return {
        success: false,
        error: "Compte introuvable. Veuillez d'abord créer un compte Agréé dans l'onglet 'Créer un Agréé'.",
      };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        let msg = error.message;
        if (msg.includes('Invalid login credentials')) {
          msg =
            "Identifiants incorrects ou compte inexistant. Si c'est votre première utilisation, veuillez d'abord créer votre compte dans l'onglet 'Créer un Agréé'.";
        } else if (msg.includes('Email not confirmed')) {
          msg =
            "Votre adresse email n'est pas encore confirmée. Vérifiez vos spams ou désactivez la confirmation d'email dans votre console Supabase (Auth > Providers > Email).";
        } else if (/Failed to fetch|NetworkError/i.test(msg)) {
          msg = "Impossible de contacter le serveur Supabase (Failed to fetch). Vérifiez votre connexion internet.";
        }
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err: any) {
      const msg = err?.message || '';
      if (/Failed to fetch|NetworkError/i.test(msg)) {
        return {
          success: false,
          error: "Impossible de contacter le serveur Supabase (Failed to fetch). Vérifiez votre connexion internet.",
        };
      }
      return { success: false, error: msg || 'Échec de connexion' };
    }
  }

  /**
   * Déconnexion sécurisée
   */
  async logout(): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignorer si hors-ligne
      }
    }
    await offlineStorage.clearLocalCache();
  }
}

export const authService = new AuthService();
