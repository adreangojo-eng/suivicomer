import { offlineStorage } from './offlineDb';
import { Loading, SyncOperation, SyncConflict, LoadingVoucher } from '../types';
import { supabase } from './supabaseClient';

export interface SyncEngineStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
}

type SyncStatusListener = (status: SyncEngineStatus) => void;

export class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private listeners: Set<SyncStatusListener> = new Set();
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notify();
        this.syncPendingOperations();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notify();
      });
    }

    // Charger le timestamp de dernière synchro
    this.initMeta();
  }

  private async initMeta() {
    try {
      const lastSync = await offlineStorage.getMeta<string>('last_synced_at');
      if (lastSync) this.lastSyncedAt = lastSync;
      this.notify();
    } catch {
      // Ignorer lors du premier démarrage
    }
  }

  public subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    this.getStatus().then((s) => listener(s));
    return () => this.listeners.delete(listener);
  }

  public async getStatus(): Promise<SyncEngineStatus> {
    const pendingOps = await offlineStorage.getPendingSyncOperations();
    const conflicts = await offlineStorage.getUnresolvedConflicts();
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: pendingOps.length,
      conflictCount: conflicts.length,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError
    };
  }

  private async notify() {
    const status = await this.getStatus();
    this.listeners.forEach((fn) => fn(status));
  }

  /**
   * Génère un identifiant unique stable pour chaque opération
   */
  public generateSyncId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `sync_${crypto.randomUUID()}`;
    }
    return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Enregistre un chargement en mode offline-first :
   * 1. Stocke immédiatement dans IndexedDB
   * 2. Réserve localement le bon pour empêcher toute réutilisation même hors ligne
   * 3. Ajoute dans la file de synchronisation
   * 4. Tente la synchronisation si en ligne
   */
  public async queueLoadingCreation(loadingData: Omit<Loading, 'id' | 'sync_id' | 'sync_status' | 'created_at' | 'updated_at'>): Promise<Loading> {
    const syncId = this.generateSyncId();
    const nowIso = new Date().toISOString();

    const newLoading: Loading = {
      ...loadingData,
      id: syncId, // Identifiant stable initial
      sync_id: syncId,
      sync_status: 'pending_sync',
      created_at: nowIso,
      updated_at: nowIso
    };

    // 1. Sauvegarde locale du chargement
    await offlineStorage.saveLoading(newLoading);

    // 2. Réservation locale du bon : bloque réutilisation hors ligne
    await offlineStorage.markVoucherLocallyReserved(newLoading.voucher_id, true);

    // 3. Ajout dans la file d'attente de synchro
    const op: SyncOperation = {
      sync_id: syncId,
      type: 'RECORD_LOADING',
      business_id: newLoading.business_id,
      payload: newLoading,
      status: 'pending',
      timestamp: Date.now(),
      retry_count: 0
    };
    await offlineStorage.addToSyncQueue(op);
    this.notify();

    // 4. Déclenchement immédiat si connecté
    if (this.isOnline) {
      await this.syncPendingOperations();
      if (this.lastError) {
        throw new Error(this.lastError);
      }
    }

    return newLoading;
  }

  /**
   * Enfile une mise à jour de paiement pour synchronisation
   */
  public async queuePaymentUpdate(
    loadingId: string,
    businessId: string,
    amountPaid: number,
    paymentRef?: string
  ): Promise<void> {
    const syncId = this.generateSyncId();
    const existing = await offlineStorage.getLoadingById(loadingId);
    if (existing) {
      existing.amount_paid = amountPaid;
      existing.remaining_due = Math.max(0, existing.total_amount - amountPaid);
      existing.payment_ref = paymentRef;
      existing.sync_status = 'pending_sync';
      existing.updated_at = new Date().toISOString();
      await offlineStorage.saveLoading(existing);
    }

    const op: SyncOperation = {
      sync_id: syncId,
      type: 'UPDATE_PAYMENT',
      business_id: businessId,
      payload: { loadingId, amountPaid, paymentRef },
      status: 'pending',
      timestamp: Date.now(),
      retry_count: 0
    };

    await offlineStorage.addToSyncQueue(op);
    this.notify();

    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }

  /**
   * Traitement séquentiel et robuste de la file de synchronisation
   */
  public async syncPendingOperations(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isOnline) return;

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    try {
      const pendingOps = await offlineStorage.getPendingSyncOperations();

      for (const op of pendingOps) {
        await offlineStorage.updateSyncOperationStatus(op.sync_id, 'syncing');

        try {
          if (op.type === 'RECORD_LOADING') {
            await this.syncRecordLoading(op);
          } else if (op.type === 'UPDATE_PAYMENT') {
            await this.syncUpdatePayment(op);
          }

          // Succès : marquer opération terminée et la retirer de la file
          await offlineStorage.removeSyncOperation(op.sync_id);
        } catch (err: any) {
          const errMsg = err?.message || 'Erreur inconnue lors de la synchronisation';
          this.lastError = errMsg;

          // Détection de conflit serveur
          if (
            errMsg.includes('BON_DEJA_UTILISE') ||
            errMsg.includes('CONFLIT') ||
            errMsg.includes('23505') // Contrainte unicité Postgres
          ) {
            const conflict: SyncConflict = {
              id: `conflict_${op.sync_id}`,
              sync_id: op.sync_id,
              voucher_number: op.payload?.voucher_number || 0,
              message: `Conflit détecté : Le bon ${op.payload?.voucher_number} a déjà été utilisé sur le serveur par un autre utilisateur.`,
              payload: op.payload,
              created_at: new Date().toISOString(),
              resolved: false
            };
            await offlineStorage.addConflict(conflict);
            await offlineStorage.updateSyncOperationStatus(op.sync_id, 'conflict', errMsg);

            // Mettre à jour le statut du chargement local
            const localLoading = await offlineStorage.getLoadingById(op.payload.id);
            if (localLoading) {
              localLoading.sync_status = 'conflict';
              await offlineStorage.saveLoading(localLoading);
            }
          } else {
            // Erreur transitoire (ex: réseau instable), marquer en erreur pour réessai automatique
            await offlineStorage.updateSyncOperationStatus(op.sync_id, 'error', errMsg);
          }
        }
      }

      this.lastSyncedAt = new Date().toISOString();
      await offlineStorage.setMeta('last_synced_at', this.lastSyncedAt);
    } catch (e: any) {
      this.lastError = e?.message || 'Erreur globale de synchronisation';
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Exécution de l'enregistrement de chargement sur Supabase
   */
  private async syncRecordLoading(op: SyncOperation): Promise<void> {
    const l = op.payload as Loading;

    // Appel de la fonction RPC transactionnelle et idempotente
    const { data, error } = await supabase.rpc('record_loading', {
      p_sync_id: l.sync_id,
      p_business_id: l.business_id,
      p_commercial_id: l.commercial_id,
      p_voucher_id: l.voucher_id,
      p_loading_date: l.loading_date,
      p_product: l.product,
      p_truck_plate: l.truck_plate,
      p_client_name: l.client_name || 'Client Comptant',
      p_tonnage: l.tonnage,
      p_price_per_ton: l.price_per_ton,
      p_amount_paid: l.amount_paid,
      p_payment_ref: l.payment_ref || null,
      p_user_id: l.created_by || null,
      p_carriere_id: l.carriere_id || null
    });

    if (error) {
      throw new Error(error.message);
    }

    // Mise à jour de l'enregistrement local avec l'id final retourné par le serveur
    const serverId = data?.id || l.id;
    const localLoading = await offlineStorage.getLoadingById(l.id);
    if (localLoading) {
      if (serverId !== l.id) {
        await offlineStorage.deleteLoading(l.id);
      }
      localLoading.id = serverId;
      localLoading.sync_status = 'synced';
      localLoading.updated_at = new Date().toISOString();
      await offlineStorage.saveLoading(localLoading);
    }
    await offlineStorage.markVoucherLocallyReserved(l.voucher_id, true);
  }

  /**
   * Exécution de la mise à jour de paiement sur Supabase
   */
  private async syncUpdatePayment(op: SyncOperation): Promise<void> {
    const { loadingId, amountPaid, paymentRef } = op.payload;
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    const { error } = await supabase.rpc('update_loading_payment', {
      p_loading_id: loadingId,
      p_amount_paid: amountPaid,
      p_payment_ref: paymentRef || null,
      p_user_id: userId
    });

    if (error) {
      throw new Error(error.message);
    }

    const localLoading = await offlineStorage.getLoadingById(loadingId);
    if (localLoading) {
      localLoading.sync_status = 'synced';
      await offlineStorage.saveLoading(localLoading);
    }
  }

  /**
   * Résolution d'un conflit par réattribution d'un nouveau bon disponible
   */
  public async resolveConflictWithNewVoucher(conflictId: string, newVoucher: LoadingVoucher): Promise<void> {
    const conflicts = await offlineStorage.getUnresolvedConflicts();
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    const oldPayload = conflict.payload as Loading;

    // Libérer l'ancien bon localement
    await offlineStorage.markVoucherLocallyReserved(oldPayload.voucher_id, false);

    // Mettre à jour avec le nouveau bon
    const updatedLoading: Loading = {
      ...oldPayload,
      voucher_id: newVoucher.id,
      voucher_number: newVoucher.voucher_number,
      sync_status: 'pending_sync'
    };

    await offlineStorage.saveLoading(updatedLoading);
    await offlineStorage.markVoucherLocallyReserved(newVoucher.id, true);

    // Mettre à jour l'opération dans la file
    const newOp: SyncOperation = {
      sync_id: oldPayload.sync_id,
      type: 'RECORD_LOADING',
      business_id: updatedLoading.business_id,
      payload: updatedLoading,
      status: 'pending',
      timestamp: Date.now(),
      retry_count: 0
    };
    await offlineStorage.addToSyncQueue(newOp);
    await offlineStorage.resolveConflict(conflictId);
    this.notify();

    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }
}

export const syncEngine = new SyncEngine();
