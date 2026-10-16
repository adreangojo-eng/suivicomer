import { supabase, isSupabaseConfigured } from './supabaseClient';
import { offlineStorage } from './offlineDb';
import { UserProfile, Business, BusinessMember, UserRole } from '../types';

export interface AuthState {
  user: UserProfile | null;
  business: Business | null;
  member: BusinessMember | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export class AuthService {
  /**
   * Récupère l'état courant de la session (en ligne ou depuis le cache local offline)
   */
  async getCurrentSession(): Promise<AuthState> {
    try {
      if (isSupabaseConfigured && navigator.onLine) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
          return this.getOfflineCachedSession();
        }

        // Récupérer le profil
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          // Récupérer le membre et l'entreprise
          const { data: member } = await supabase
            .from('business_members')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('is_active', true)
            .single();

          let business: Business | null = null;
          if (member?.business_id) {
            const { data: bData } = await supabase
              .from('businesses')
              .select('*')
              .eq('id', member.business_id)
              .single();
            business = bData;
          }

          const fullProfile: UserProfile = {
            id: session.user.id,
            email: session.user.email,
            full_name: profile.full_name,
            role: profile.role,
            phone: profile.phone,
            created_at: profile.created_at,
          };

          // Sauvegarder dans le cache local sécurisé pour le mode hors ligne
          await offlineStorage.setMeta('cached_profile', fullProfile);
          if (business) await offlineStorage.setMeta('cached_business', business);
          if (member) await offlineStorage.setMeta('cached_member', member);

          return {
            user: fullProfile,
            business,
            member: member || null,
            isAuthenticated: true,
            isLoading: false,
          };
        }
      }

      // Si hors ligne ou Supabase non configuré, vérifier le cache offline
      return this.getOfflineCachedSession();
    } catch {
      return this.getOfflineCachedSession();
    }
  }

  private async getOfflineCachedSession(): Promise<AuthState> {
    try {
      const user = await offlineStorage.getMeta<UserProfile>('cached_profile');
      const business = await offlineStorage.getMeta<Business>('cached_business');
      const member = await offlineStorage.getMeta<BusinessMember>('cached_member');

      if (user) {
        return {
          user,
          business,
          member,
          isAuthenticated: true,
          isLoading: false,
        };
      }
    } catch {
      // Ignorer
    }

    return {
      user: null,
      business: null,
      member: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }

  /**
   * Inscription d'un nouvel Agréé (création du compte, du profil et de son entreprise)
   * Règle de sécurité : Seul le rôle 'agree' peut être créé via inscription publique.
   */
  async registerAgree(params: {
    email: string;
    password: string;
    fullName: string;
    businessName: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
    if (!isSupabaseConfigured) {
      // Mode simulation hors-connexion / test local sans projet Supabase externe connecté
      const mockId = `mock_user_${Date.now()}`;
      const mockProfile: UserProfile = {
        id: mockId,
        email: params.email,
        full_name: params.fullName,
        role: 'agree',
        phone: params.phone,
        created_at: new Date().toISOString(),
      };
      const mockBusiness: Business = {
        id: `mock_bus_${Date.now()}`,
        name: params.businessName,
        owner_id: mockId,
        created_at: new Date().toISOString(),
      };
      const mockMember: BusinessMember = {
        id: `mock_mem_${Date.now()}`,
        business_id: mockBusiness.id,
        user_id: mockId,
        role: 'agree',
        is_active: true,
        can_edit_payments: true,
        created_at: new Date().toISOString(),
      };

      await offlineStorage.setMeta('cached_profile', mockProfile);
      await offlineStorage.setMeta('cached_business', mockBusiness);
      await offlineStorage.setMeta('cached_member', mockMember);

      return { success: true, user: mockProfile };
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName,
            role: 'agree',
          },
        },
      });

      if (authError || !authData.user) {
        return { success: false, error: authError?.message || "Erreur lors de l'inscription" };
      }

      const userId = authData.user.id;

      // 1. Appel RPC sécurisé (création profil + entreprise + membre)
      let busId: string = '';
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_agree_account', {
          p_full_name: params.fullName,
          p_business_name: params.businessName,
          p_phone: params.phone || null,
        });

        if (rpcErr) {
          console.warn('RPC create_agree_account notice:', rpcErr.message);
          // Fallback direct
          await supabase.from('profiles').upsert({
            id: userId,
            full_name: params.fullName,
            role: 'agree',
            phone: params.phone || null,
          });

          const { data: busData } = await supabase
            .from('businesses')
            .insert({
              name: params.businessName,
              owner_id: userId,
              phone: params.phone || null,
            })
            .select()
            .single();

          if (busData) {
            busId = busData.id;
            await supabase.from('business_members').upsert({
              business_id: busData.id,
              user_id: userId,
              role: 'agree',
              is_active: true,
              can_edit_payments: true,
            });
          }
        } else if (rpcRes?.business?.id) {
          busId = rpcRes.business.id;
        }
      } catch (insertErr) {
        console.warn('DB initialization fallback warning:', insertErr);
      }

      const profile: UserProfile = {
        id: userId,
        email: params.email,
        full_name: params.fullName,
        role: 'agree',
        phone: params.phone,
        created_at: new Date().toISOString(),
      };

      const business: Business = {
        id: busId || `bus_${userId.substring(0, 8)}`,
        name: params.businessName,
        owner_id: userId,
        phone: params.phone,
        created_at: new Date().toISOString(),
      };

      const member: BusinessMember = {
        id: `mem_${userId.substring(0, 8)}`,
        business_id: business.id,
        user_id: userId,
        role: 'agree',
        is_active: true,
        can_edit_payments: true,
        created_at: new Date().toISOString(),
      };

      await offlineStorage.setMeta('cached_profile', profile);
      await offlineStorage.setMeta('cached_business', business);
      await offlineStorage.setMeta('cached_member', member);

      return { success: true, user: profile };
    } catch (err: any) {
      return { success: false, error: err.message || "Impossible de finaliser l'inscription" };
    }
  }

  /**
   * Connexion avec email et mot de passe
   */
  async login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      // Détection compte de test local
      const cached = await offlineStorage.getMeta<UserProfile>('cached_profile');
      if (cached && cached.email === email) {
        return { success: true };
      }
      return { success: false, error: "Compte introuvable. Veuillez d'abord créer un compte Agréé dans l'onglet 'Créer un Agréé'." };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        let msg = error.message;
        if (msg.includes('Invalid login credentials')) {
          msg = "Identifiants incorrects ou compte inexistant. Si c'est votre première utilisation, veuillez d'abord créer votre compte dans l'onglet 'Créer un Agréé'.";
        } else if (msg.includes('Email not confirmed')) {
          msg = "Votre adresse email n'a pas encore été confirmée. Veuillez vérifier votre boîte mail ou désactiver la confirmation dans Supabase.";
        }
        return { success: false, error: msg };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Échec de connexion' };
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
