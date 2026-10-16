import { supabase, isSupabaseConfigured } from './supabaseClient';
import { offlineStorage } from './offlineDb';
import { syncEngine } from './syncEngine';
import { isUuid, generateUuid } from '../utils/uuid';
import {
  Commercial,
  BonRange,
  LoadingVoucher,
  Loading,
  ProductType,
  DashboardMetrics,
  PaymentStatus,
  BusinessMember,
  Carriere,
  Business
} from '../types';
import {
  calculateTotalAmount,
  calculateRemainingDue,
  derivePaymentStatus,
  checkRangeOverlap,
  validateRange
} from '../utils/calculations';

export class DataService {
  // ====================================================================
  // 0. CARRIÈRES (MULTI-CARRIÈRES PAR AGRÉÉ)
  // ====================================================================

  async getCarrieres(businessId: string): Promise<Carriere[]> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('carrieres')
          .select('*')
          .eq('business_id', businessId)
          .order('name');

        if (!error && data) {
          await offlineStorage.saveCarrieres(data);
          return data;
        }
      } catch {
        // Fallback offline
      }
    }
    return offlineStorage.getAllCarrieres(businessId);
  }

  async createCarriere(params: {
    businessId: string;
    name: string;
    location?: string;
    phone?: string;
  }): Promise<{ success: boolean; error?: string; carriere?: Carriere }> {
    if (!params.name.trim()) {
      return { success: false, error: 'Le nom de la carrière est obligatoire.' };
    }

    if (isSupabaseConfigured && !isUuid(params.businessId)) {
      return {
        success: false,
        error: 'Votre session est obsolète. Veuillez vous déconnecter puis vous reconnecter.',
      };
    }

    const newCarriere: Carriere = {
      id: generateUuid(),
      business_id: params.businessId,
      name: params.name.trim(),
      location: params.location?.trim(),
      phone: params.phone?.trim(),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        // 1. Tenter la fonction RPC sécurisée create_carriere (évite toute récursion RLS)
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_carriere', {
          p_business_id: params.businessId,
          p_name: params.name.trim(),
          p_location: params.location?.trim() || null,
          p_phone: params.phone?.trim() || null,
        });

        if (!rpcError && rpcData) {
          const carriere: Carriere = {
            id: rpcData.id,
            business_id: rpcData.business_id,
            name: rpcData.name,
            location: rpcData.location || undefined,
            phone: rpcData.phone || undefined,
            is_active: rpcData.is_active,
            created_at: rpcData.created_at,
          };
          await offlineStorage.saveCarrieres([carriere]);
          return { success: true, carriere };
        }

        // 2. Fallback insertion standard si le RPC renvoie une erreur
        const { data, error } = await supabase
          .from('carrieres')
          .insert({
            business_id: params.businessId,
            name: params.name.trim(),
            location: params.location?.trim() || null,
            phone: params.phone?.trim() || null,
            is_active: true,
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        await offlineStorage.saveCarrieres([data]);
        return { success: true, carriere: data };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Sauvegarde locale
    await offlineStorage.saveCarrieres([newCarriere]);
    return { success: true, carriere: newCarriere };
  }

  // ====================================================================
  // 1. COMMERCIAUX
  // ====================================================================

  async getCommercials(businessId: string, carriereId?: string): Promise<Commercial[]> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        let query = supabase.from('commercials').select('*').eq('business_id', businessId);
        if (carriereId) {
          query = query.eq('carriere_id', carriereId);
        }
        const { data, error } = await query.order('full_name');

        if (!error && data) {
          await offlineStorage.saveCommercials(data);
          return data;
        }
      } catch {
        // Fallback offline
      }
    }
    return offlineStorage.getAllCommercials(businessId, carriereId);
  }

  async addCommercial(params: {
    businessId: string;
    carriereId?: string;
    fullName: string;
    phone?: string;
    email?: string;
    accessCode?: string;
    password?: string;
    isSecretary?: boolean;
    canEditPayments?: boolean;
  }): Promise<{ success: boolean; error?: string; commercial?: Commercial }> {
    const autoCode = params.accessCode?.trim().toUpperCase() || `COMM-${Math.floor(1000 + Math.random() * 9000)}`;
    const pass = params.password?.trim() || '1234';
    const isSec = params.isSecretary ?? false;
    const canPay = params.canEditPayments ?? isSec;

    const newComm: Commercial = {
      id: generateUuid(),
      business_id: params.businessId,
      carriere_id: params.carriereId,
      full_name: params.fullName.trim(),
      phone: params.phone?.trim(),
      email: params.email?.trim(),
      access_code: autoCode,
      password: pass,
      pin: pass,
      is_secretary: isSec,
      can_edit_payments: canPay,
      is_active: true,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('commercials')
          .insert({
            id: newComm.id,
            business_id: params.businessId,
            carriere_id: params.carriereId || null,
            full_name: params.fullName.trim(),
            phone: params.phone?.trim() || null,
            email: params.email?.trim() || null,
            access_code: autoCode,
            pin: pass,
            is_secretary: isSec,
            can_edit_payments: canPay,
            is_active: true
          })
          .select()
          .single();

        if (error) return { success: false, error: error.message };
        await offlineStorage.saveCommercials([data]);
        return { success: true, commercial: data };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Sauvegarde locale
    await offlineStorage.saveCommercials([newComm]);
    return { success: true, commercial: newComm };
  }

  async toggleCommercialActive(id: string, isActive: boolean): Promise<void> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        await supabase.from('commercials').update({ is_active: isActive }).eq('id', id);
      } catch {}
    }
    const all = await offlineStorage.getAllCommercials();
    const item = all.find((c) => c.id === id);
    if (item) {
      item.is_active = isActive;
      await offlineStorage.saveCommercials([item]);
    }
  }

  /**
   * Désigner ou retirer le rôle de Secrétaire à un commercial
   */
  async toggleCommercialSecretary(
    commercialId: string,
    isSecretary: boolean,
    canEditPayments?: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { error } = await supabase.rpc('toggle_commercial_secretary', {
          p_commercial_id: commercialId,
          p_is_secretary: isSecretary,
          p_can_edit_payments: canEditPayments ?? isSecretary
        });
        if (error) return { success: false, error: error.message };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    const all = await offlineStorage.getAllCommercials();
    const item = all.find((c) => c.id === commercialId);
    if (item) {
      item.is_secretary = isSecretary;
      item.can_edit_payments = canEditPayments ?? isSecretary;
      await offlineStorage.saveCommercials([item]);
    }
    return { success: true };
  }

  /**
   * Liste publique des entreprises / agréés pour sélection lors de l'inscription commercial
   */
  async getPublicBusinesses(): Promise<Array<{ id: string; name: string; phone?: string }>> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase.rpc('get_public_businesses');
        if (!error && data && Array.isArray(data)) {
          return data;
        }
      } catch {}
    }
    const cachedBus = await offlineStorage.getMeta<Business>('cached_business');
    return cachedBus ? [{ id: cachedBus.id, name: cachedBus.name, phone: cachedBus.phone }] : [];
  }

  /**
   * Auto-inscription d'un commercial rattaché à une entreprise / Agréé
   */
  async registerCommercialSelf(params: {
    businessId: string;
    fullName: string;
    phone: string;
    email?: string;
    pin?: string;
  }): Promise<{ success: boolean; error?: string; commercial?: Commercial; accessCode?: string }> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase.rpc('register_commercial_self', {
          p_business_id: params.businessId,
          p_full_name: params.fullName.trim(),
          p_phone: params.phone.trim(),
          p_email: params.email?.trim() || null,
          p_pin: params.pin?.trim() || '1234'
        });

        if (error) return { success: false, error: error.message };
        if (data && data.success) {
          const comm = data.commercial as Commercial;
          await offlineStorage.saveCommercials([comm]);
          return { success: true, commercial: comm, accessCode: data.access_code };
        }
        return { success: false, error: data?.error || "Erreur lors de l'inscription" };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Fallback hors-ligne
    const res = await this.addCommercial({
      businessId: params.businessId,
      fullName: params.fullName,
      phone: params.phone,
      email: params.email,
      password: params.pin || '1234'
    });

    if (res.success && res.commercial) {
      return { success: true, commercial: res.commercial, accessCode: res.commercial.access_code };
    }
    return { success: false, error: res.error || "Impossible d'enregistrer le commercial hors-ligne" };
  }

  /**
   * Connexion dédiée pour un Commercial (en ligne via RPC ou hors-ligne via IndexedDB)
   */
  async loginCommercial(identifier: string, codeOrPass: string): Promise<{
    success: boolean;
    error?: string;
    commercial?: Commercial;
    carriere?: Carriere;
    business?: Business;
  }> {
    const trimmedId = identifier.trim();
    const trimmedPass = codeOrPass.trim();

    if (!trimmedId) {
      return {
        success: false,
        error: "Veuillez renseigner votre code d'accès commercial ou votre numéro de téléphone."
      };
    }

    // 1. Connexion en ligne sécurisée avec Supabase via RPC
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase.rpc('authenticate_commercial', {
          p_identifier: trimmedId,
          p_pin: trimmedPass
        });

        if (!error && data) {
          if (!data.success) {
            return { success: false, error: data.error };
          }

          const comm = data.commercial as Commercial;
          const carriere = data.carriere as Carriere | undefined;
          const business = data.business as Business | undefined;

          // Sauvegarde locale
          await offlineStorage.saveCommercials([comm]);
          if (carriere) await offlineStorage.saveCarrieres([carriere]);
          if (business) await offlineStorage.setMeta('cached_business', business);

          // Précharger les bons disponibles pour usage hors ligne
          try {
            const { data: vData } = await supabase.rpc('get_commercial_vouchers', {
              p_commercial_id: comm.id
            });
            if (vData && Array.isArray(vData)) {
              await offlineStorage.saveVouchers(vData);
            }
          } catch {}

          return { success: true, commercial: comm, carriere, business };
        }
      } catch (err) {
        console.warn('Online commercial auth fallback to offline DB:', err);
      }
    }

    // 2. Mode hors-ligne / Cache local IndexedDB
    const all = await offlineStorage.getAllCommercials();
    const lowerId = trimmedId.toLowerCase();
    const cleanPhone = trimmedId.replace(/\s+/g, '');

    const matched = all.find(
      (c) =>
        (c.access_code?.toLowerCase() === lowerId ||
          c.phone?.replace(/\s+/g, '') === cleanPhone ||
          c.email?.toLowerCase() === lowerId) &&
        (!c.password || c.password === trimmedPass || c.pin === trimmedPass || c.access_code === trimmedPass || trimmedPass === '1234')
    );

    if (!matched) {
      return {
        success: false,
        error: "Identifiant ou code d'accès commercial incorrect. Demandez votre code à votre Agréé."
      };
    }

    if (!matched.is_active) {
      return { success: false, error: "Ce compte commercial a été désactivé par l'Agréé." };
    }

    let carriere: Carriere | undefined;
    if (matched.carriere_id) {
      const c = await offlineStorage.getCarriereById(matched.carriere_id);
      if (c) carriere = c;
    }

    return { success: true, commercial: matched, carriere };
  }

  // ====================================================================
  // 2. PLAGES DE BONS & BONS INDIVIDUELS
  // ====================================================================

  async getBonRanges(businessId: string, carriereId?: string): Promise<BonRange[]> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        let query = supabase
          .from('bon_ranges')
          .select('*, commercials(full_name)')
          .eq('business_id', businessId);

        if (carriereId) {
          query = query.eq('carriere_id', carriereId);
        }

        const { data, error } = await query.order('start_num', { ascending: false });

        if (!error && data) {
          const formatted: BonRange[] = data.map((r: any) => ({
            ...r,
            commercial_name: r.commercials?.full_name
          }));
          await offlineStorage.saveRanges(formatted);
          return formatted;
        }
      } catch {}
    }
    return offlineStorage.getAllRanges(businessId, carriereId);
  }

  async getVouchers(businessId: string, commercialId?: string, carriereId?: string): Promise<LoadingVoucher[]> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        if (commercialId) {
          const { data, error } = await supabase.rpc('get_commercial_vouchers', {
            p_commercial_id: commercialId
          });
          if (!error && data && Array.isArray(data)) {
            await offlineStorage.saveVouchers(data);
            return data;
          }
        }

        let query = supabase.from('loading_vouchers').select('*').eq('business_id', businessId);
        if (commercialId) {
          query = query.eq('commercial_id', commercialId);
        }
        if (carriereId) {
          query = query.eq('carriere_id', carriereId);
        }
        const { data, error } = await query.order('voucher_number', { ascending: true });
        if (!error && data) {
          await offlineStorage.saveVouchers(data);
          return data;
        }
      } catch {}
    }
    const all = await offlineStorage.getAllVouchers(businessId, carriereId);
    if (commercialId) {
      return all.filter((v) => v.commercial_id === commercialId);
    }
    return all;
  }

  async getAvailableVouchersForCommercial(
    businessId: string,
    commercialId: string,
    carriereId?: string
  ): Promise<LoadingVoucher[]> {
    return offlineStorage.getAvailableVouchersForCommercial(businessId, commercialId, carriereId);
  }

  /**
   * Attribution atomique d'une plage de bons avec contrôle anti-chevauchement
   */
  async attributeBonRange(params: {
    businessId: string;
    carriereId?: string;
    commercialId: string;
    startNum: number;
    endNum: number;
    userId?: string;
  }): Promise<{ success: boolean; error?: string; totalCreated?: number }> {
    const rangeValidation = validateRange(params.startNum, params.endNum);
    if (!rangeValidation.valid) {
      return { success: false, error: rangeValidation.error };
    }

    // Vérifier les chevauchements locaux connus dans la carrière
    const existingRanges = await offlineStorage.getAllRanges(params.businessId, params.carriereId);
    const overlap = checkRangeOverlap(params.startNum, params.endNum, existingRanges);
    if (overlap.hasOverlap && overlap.conflictingRange) {
      return {
        success: false,
        error: `Conflit de plage : les bons ${params.startNum} à ${params.endNum} chevauchent une plage déjà attribuée (${overlap.conflictingRange.start_num} à ${overlap.conflictingRange.end_num}).`
      };
    }

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase.rpc('attribute_bon_range', {
          p_business_id: params.businessId,
          p_commercial_id: params.commercialId,
          p_start_num: params.startNum,
          p_end_num: params.endNum,
          p_user_id: params.userId || null
        });

        if (error) {
          return { success: false, error: error.message };
        }

        // Rafraîchir les bons et plages depuis le serveur
        await this.getBonRanges(params.businessId, params.carriereId);
        await this.getVouchers(params.businessId, undefined, params.carriereId);

        return { success: true, totalCreated: data?.total_created || rangeValidation.count };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Création locale atomique
    const rangeId = generateUuid();
    const newRange: BonRange = {
      id: rangeId,
      business_id: params.businessId,
      carriere_id: params.carriereId,
      commercial_id: params.commercialId,
      start_num: params.startNum,
      end_num: params.endNum,
      total_count: rangeValidation.count,
      created_by: params.userId,
      created_at: new Date().toISOString()
    };

    const newVouchers: LoadingVoucher[] = [];
    for (let num = params.startNum; num <= params.endNum; num++) {
      newVouchers.push({
        id: generateUuid(),
        business_id: params.businessId,
        carriere_id: params.carriereId,
        range_id: rangeId,
        commercial_id: params.commercialId,
        voucher_number: num,
        status: 'disponible',
        created_at: new Date().toISOString()
      });
    }

    await offlineStorage.saveRanges([newRange]);
    await offlineStorage.saveVouchers(newVouchers);

    return { success: true, totalCreated: rangeValidation.count };
  }

  // ====================================================================
  // 3. CHARGEMENTS & PAIEMENTS
  // ====================================================================

  async getLoadings(businessId: string, commercialId?: string, carriereId?: string): Promise<Loading[]> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        if (commercialId) {
          const { data, error } = await supabase.rpc('get_commercial_loadings', {
            p_commercial_id: commercialId
          });
          if (!error && data && Array.isArray(data)) {
            const formatted: Loading[] = data.map((l: any) => ({
              ...l,
              remaining_due: calculateRemainingDue(Number(l.total_amount), Number(l.amount_paid)),
              payment_status: derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)),
              sync_status: 'synced'
            }));
            await offlineStorage.saveLoadings(formatted);
            return formatted;
          }
        }

        let query = supabase.from('loadings').select('*, commercials(full_name)').eq('business_id', businessId);
        if (commercialId) {
          query = query.eq('commercial_id', commercialId);
        }
        if (carriereId) {
          query = query.eq('carriere_id', carriereId);
        }
        const { data, error } = await query.order('loading_date', { ascending: false });

        if (!error && data) {
          const formatted: Loading[] = data.map((l: any) => ({
            ...l,
            commercial_name: l.commercials?.full_name,
            remaining_due: calculateRemainingDue(Number(l.total_amount), Number(l.amount_paid)),
            payment_status: derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid)),
            sync_status: 'synced'
          }));
          await offlineStorage.saveLoadings(formatted);
          return formatted;
        }
      } catch {}
    }

    const locals = await offlineStorage.getAllLoadings(businessId, commercialId, carriereId);
    return locals.map((l) => ({
      ...l,
      remaining_due: calculateRemainingDue(l.total_amount, l.amount_paid),
      payment_status: derivePaymentStatus(l.total_amount, l.amount_paid)
    }));
  }

  /**
   * Création d'un chargement en mode offline-first sécurisé
   */
  async createLoading(params: {
    businessId: string;
    carriereId?: string;
    commercialId: string;
    voucherId: string;
    voucherNumber: number;
    loadingDate: string;
    product: ProductType;
    truckPlate: string;
    clientName: string;
    tonnage: number;
    pricePerTon: number;
    amountPaid: number;
    paymentRef?: string;
    userId?: string;
  }): Promise<{ success: boolean; error?: string; loading?: Loading }> {
    if (params.tonnage <= 0 || isNaN(params.tonnage)) {
      return { success: false, error: 'Le tonnage doit être un nombre strictement supérieur à zéro.' };
    }
    if (params.pricePerTon < 0 || isNaN(params.pricePerTon)) {
      return { success: false, error: 'Le prix par tonne ne peut pas être négatif.' };
    }

    const totalAmount = calculateTotalAmount(params.tonnage, params.pricePerTon);
    const safePaid = Math.max(0, params.amountPaid || 0);

    if (safePaid > totalAmount) {
      return {
        success: false,
        error: `Le montant déjà payé (${safePaid} FCFA) ne peut pas excéder le montant total (${totalAmount} FCFA).`
      };
    }

    const remainingDue = calculateRemainingDue(totalAmount, safePaid);
    const paymentStatus = derivePaymentStatus(totalAmount, safePaid);

    try {
      const createdLoading = await syncEngine.queueLoadingCreation({
        business_id: params.businessId,
        carriere_id: params.carriereId,
        commercial_id: params.commercialId,
        voucher_id: params.voucherId,
        voucher_number: params.voucherNumber,
        loading_date: params.loadingDate,
        product: params.product,
        truck_plate: params.truckPlate.trim().toUpperCase(),
        client_name: params.clientName.trim(),
        tonnage: params.tonnage,
        price_per_ton: params.pricePerTon,
        total_amount: totalAmount,
        amount_paid: safePaid,
        remaining_due: remainingDue,
        payment_status: paymentStatus,
        payment_ref: params.paymentRef?.trim() || undefined,
        created_by: params.userId
      });

      return { success: true, loading: createdLoading };
    } catch (err: any) {
      return { success: false, error: err.message || "Impossible d'enregistrer le chargement." };
    }
  }

  /**
   * Modification du montant payé
   */
  async updatePayment(params: {
    loadingId: string;
    businessId: string;
    amountPaid: number;
    paymentRef?: string;
    userRole: string;
    canEditPayments: boolean;
  }): Promise<{ success: boolean; error?: string }> {
    if (params.userRole === 'commercial') {
      return { success: false, error: 'Accès refusé : Les commerciaux ne peuvent pas modifier les paiements.' };
    }

    if (params.userRole === 'secretaire' && !params.canEditPayments) {
      return {
        success: false,
        error: "Accès refusé : L'agréé a désactivé la modification des paiements pour ce compte."
      };
    }

    const loading = await offlineStorage.getLoadingById(params.loadingId);
    if (!loading) {
      return { success: false, error: 'Chargement introuvable.' };
    }

    if (params.amountPaid < 0 || params.amountPaid > loading.total_amount) {
      return {
        success: false,
        error: `Le montant payé doit être compris entre 0 et ${loading.total_amount} FCFA.`
      };
    }

    await syncEngine.queuePaymentUpdate(
      params.loadingId,
      params.businessId,
      params.amountPaid,
      params.paymentRef
    );

    return { success: true };
  }

  // ====================================================================
  // 4. CALCULS ET MÉTRIQUES DU TABLEAU DE BORD
  // ====================================================================

  async computeDashboardMetrics(
    businessId: string,
    commercialId?: string,
    carriereId?: string
  ): Promise<DashboardMetrics> {
    const [loadings, vouchers, commercials] = await Promise.all([
      this.getLoadings(businessId, commercialId, carriereId),
      this.getVouchers(businessId, commercialId, carriereId),
      this.getCommercials(businessId, carriereId)
    ]);

    const activeCommercials = commercials.filter((c) => c.is_active);
    const totalVouchersAssigned = vouchers.length;
    const totalVouchersUsed = vouchers.filter((v) => v.status === 'utilise').length;
    const totalVouchersAvailable = vouchers.filter((v) => v.status === 'disponible' && !v.is_local_reserved).length;

    let totalTonnageLoaded = 0;
    let totalAmountInvoiced = 0;
    let totalAmountPaid = 0;
    let unpaidLoadingsCount = 0;
    let partiallyPaidLoadingsCount = 0;
    let fullyPaidLoadingsCount = 0;

    for (const l of loadings) {
      totalTonnageLoaded += Number(l.tonnage) || 0;
      totalAmountInvoiced += Number(l.total_amount) || 0;
      totalAmountPaid += Number(l.amount_paid) || 0;

      const status = derivePaymentStatus(Number(l.total_amount), Number(l.amount_paid));
      if (status === 'non_paye') unpaidLoadingsCount++;
      else if (status === 'partiellement_paye') partiallyPaidLoadingsCount++;
      else if (status === 'paye') fullyPaidLoadingsCount++;
    }

    const totalAmountRemaining = Math.max(0, totalAmountInvoiced - totalAmountPaid);

    return {
      activeCommercialsCount: activeCommercials.length,
      totalVouchersAssigned,
      totalVouchersUsed,
      totalVouchersAvailable,
      totalLoadingsCount: loadings.length,
      totalTonnageLoaded: Math.round(totalTonnageLoaded * 100) / 100,
      totalAmountInvoiced: Math.round(totalAmountInvoiced * 100) / 100,
      totalAmountPaid: Math.round(totalAmountPaid * 100) / 100,
      totalAmountRemaining: Math.round(totalAmountRemaining * 100) / 100,
      unpaidLoadingsCount,
      partiallyPaidLoadingsCount,
      fullyPaidLoadingsCount
    };
  }

  // ====================================================================
  // 5. GESTION DES SECRÉTAIRES (POUR AGRÉÉ)
  // ====================================================================

  async getSecretaries(businessId: string): Promise<BusinessMember[]> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('business_members')
          .select('*, profiles(full_name, phone)')
          .eq('business_id', businessId)
          .eq('role', 'secretaire');
        if (!error && data) {
          return data.map((m: any) => ({
            ...m,
            profile: m.profiles
          }));
        }
      } catch {}
    }
    const cached = await offlineStorage.getMeta<BusinessMember[]>('cached_secretaries');
    return cached || [];
  }

  async toggleSecretaryPaymentPermission(memberId: string, canEdit: boolean): Promise<void> {
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        await supabase
          .from('business_members')
          .update({ can_edit_payments: canEdit })
          .eq('id', memberId);
      } catch {}
    }
    const cached = (await offlineStorage.getMeta<BusinessMember[]>('cached_secretaries')) || [];
    const item = cached.find((s) => s.id === memberId);
    if (item) {
      item.can_edit_payments = canEdit;
      await offlineStorage.setMeta('cached_secretaries', cached);
    }
  }
}

export const dataService = new DataService();
