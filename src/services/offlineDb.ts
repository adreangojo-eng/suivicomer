import { Loading, LoadingVoucher, Commercial, BonRange, SyncOperation, SyncConflict, UserProfile, Carriere, ProductItem } from '../types';

const DB_NAME = 'suivicomer_offline_v2';
const DB_VERSION = 3;

export class OfflineStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error("IndexedDB n'est pas disponible dans cet environnement"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store: carrieres (multi-carrières par agréé)
        if (!db.objectStoreNames.contains('carrieres')) {
          const carriereStore = db.createObjectStore('carrieres', { keyPath: 'id' });
          carriereStore.createIndex('by_business', 'business_id', { unique: false });
        }

        // Store: vouchers
        if (!db.objectStoreNames.contains('vouchers')) {
          const vouchersStore = db.createObjectStore('vouchers', { keyPath: 'id' });
          vouchersStore.createIndex('by_commercial', 'commercial_id', { unique: false });
          vouchersStore.createIndex('by_status', 'status', { unique: false });
          vouchersStore.createIndex('by_business', 'business_id', { unique: false });
          vouchersStore.createIndex('by_number', 'voucher_number', { unique: false });
          vouchersStore.createIndex('by_carriere', 'carriere_id', { unique: false });
        }

        // Store: loadings
        if (!db.objectStoreNames.contains('loadings')) {
          const loadingsStore = db.createObjectStore('loadings', { keyPath: 'id' });
          loadingsStore.createIndex('by_business', 'business_id', { unique: false });
          loadingsStore.createIndex('by_commercial', 'commercial_id', { unique: false });
          loadingsStore.createIndex('by_sync_id', 'sync_id', { unique: true });
          loadingsStore.createIndex('by_date', 'loading_date', { unique: false });
          loadingsStore.createIndex('by_carriere', 'carriere_id', { unique: false });
        }

        // Store: commercials
        if (!db.objectStoreNames.contains('commercials')) {
          const commStore = db.createObjectStore('commercials', { keyPath: 'id' });
          commStore.createIndex('by_business', 'business_id', { unique: false });
          commStore.createIndex('by_carriere', 'carriere_id', { unique: false });
        }

        // Store: ranges
        if (!db.objectStoreNames.contains('ranges')) {
          const rangeStore = db.createObjectStore('ranges', { keyPath: 'id' });
          rangeStore.createIndex('by_business', 'business_id', { unique: false });
          rangeStore.createIndex('by_carriere', 'carriere_id', { unique: false });
        }

        // Store: products (catalogue produits & tarifs par carrière/entreprise)
        if (!db.objectStoreNames.contains('products')) {
          const prodStore = db.createObjectStore('products', { keyPath: 'id' });
          prodStore.createIndex('by_business', 'business_id', { unique: false });
          prodStore.createIndex('by_carriere', 'carriere_id', { unique: false });
        }

        // Store: sync_queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          const queueStore = db.createObjectStore('sync_queue', { keyPath: 'sync_id' });
          queueStore.createIndex('by_status', 'status', { unique: false });
          queueStore.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        // Store: conflicts
        if (!db.objectStoreNames.contains('conflicts')) {
          const conflictStore = db.createObjectStore('conflicts', { keyPath: 'id' });
          conflictStore.createIndex('by_resolved', 'resolved', { unique: false });
        }

        // Store: app_meta (key-value store for session, cache timestamps, active carriere)
        if (!db.objectStoreNames.contains('app_meta')) {
          db.createObjectStore('app_meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- REPOSITORY: APP META & SESSION CACHE ---
  async setMeta(key: string, value: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_meta', 'readwrite');
      tx.objectStore('app_meta').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getMeta<T = any>(key: string): Promise<T | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('app_meta', 'readonly');
      const req = tx.objectStore('app_meta').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- REPOSITORY: CARRIERES ---
  async saveCarrieres(carrieres: Carriere[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('carrieres', 'readwrite');
      const store = tx.objectStore('carrieres');
      carrieres.forEach((c) => store.put(c));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllCarrieres(businessId?: string): Promise<Carriere[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('carrieres', 'readonly');
      const store = tx.objectStore('carrieres');
      const req = store.getAll();
      req.onsuccess = () => {
        let results: Carriere[] = req.result || [];
        if (businessId) {
          results = results.filter((c) => c.business_id === businessId);
        }
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getCarriereById(id: string): Promise<Carriere | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('carrieres', 'readonly');
      const req = tx.objectStore('carrieres').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // --- REPOSITORY: VOUCHERS ---
  async saveVouchers(vouchers: LoadingVoucher[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vouchers', 'readwrite');
      const store = tx.objectStore('vouchers');
      vouchers.forEach((v) => store.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllVouchers(businessId?: string, carriereId?: string): Promise<LoadingVoucher[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vouchers', 'readonly');
      const store = tx.objectStore('vouchers');
      const req = store.getAll();
      req.onsuccess = () => {
        let results: LoadingVoucher[] = req.result || [];
        if (businessId) {
          results = results.filter((v) => v.business_id === businessId);
        }
        if (carriereId) {
          results = results.filter((v) => !v.carriere_id || v.carriere_id === carriereId);
        }
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAvailableVouchersForCommercial(
    businessId: string,
    commercialId: string,
    carriereId?: string
  ): Promise<LoadingVoucher[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vouchers', 'readonly');
      const store = tx.objectStore('vouchers');
      const req = store.getAll();
      req.onsuccess = () => {
        const results = (req.result as LoadingVoucher[]).filter(
          (v) =>
            v.business_id === businessId &&
            v.commercial_id === commercialId &&
            (!carriereId || !v.carriere_id || v.carriere_id === carriereId) &&
            v.status === 'disponible' &&
            !v.is_local_reserved
        );
        // Trier par numéro de bon croissant
        results.sort((a, b) => a.voucher_number - b.voucher_number);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async markVoucherLocallyReserved(voucherId: string, isReserved: boolean): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('vouchers', 'readwrite');
      const store = tx.objectStore('vouchers');
      const getReq = store.get(voucherId);
      getReq.onsuccess = () => {
        const voucher = getReq.result as LoadingVoucher | undefined;
        if (voucher) {
          voucher.is_local_reserved = isReserved;
          if (isReserved) {
            voucher.status = 'utilise';
          }
          store.put(voucher);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // --- REPOSITORY: LOADINGS ---
  async saveLoading(loading: Loading): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('loadings', 'readwrite');
      tx.objectStore('loadings').put(loading);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveLoadings(loadings: Loading[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('loadings', 'readwrite');
      const store = tx.objectStore('loadings');
      loadings.forEach((l) => store.put(l));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllLoadings(businessId?: string, commercialId?: string, carriereId?: string): Promise<Loading[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('loadings', 'readonly');
      const store = tx.objectStore('loadings');
      const req = store.getAll();
      req.onsuccess = () => {
        let items = (req.result || []) as Loading[];
        if (businessId) {
          items = items.filter((l) => l.business_id === businessId);
        }
        if (carriereId) {
          items = items.filter((l) => !l.carriere_id || l.carriere_id === carriereId);
        }
        if (commercialId) {
          items = items.filter((l) => l.commercial_id === commercialId);
        }
        // Tri décroissant par date puis création
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getLoadingById(id: string): Promise<Loading | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('loadings', 'readonly');
      const req = tx.objectStore('loadings').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteLoading(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('loadings', 'readwrite');
      tx.objectStore('loadings').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- REPOSITORY: COMMERCIALS ---
  async saveCommercials(commercials: Commercial[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('commercials', 'readwrite');
      const store = tx.objectStore('commercials');
      commercials.forEach((c) => store.put(c));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllCommercials(businessId?: string, carriereId?: string): Promise<Commercial[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('commercials', 'readonly');
      const store = tx.objectStore('commercials');
      const req = store.getAll();
      req.onsuccess = () => {
        let items = (req.result || []) as Commercial[];
        if (businessId) {
          items = items.filter((c) => c.business_id === businessId);
        }
        if (carriereId) {
          items = items.filter((c) => !c.carriere_id || c.carriere_id === carriereId);
        }
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- REPOSITORY: RANGES ---
  async saveRanges(ranges: BonRange[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ranges', 'readwrite');
      const store = tx.objectStore('ranges');
      ranges.forEach((r) => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllRanges(businessId?: string, carriereId?: string): Promise<BonRange[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('ranges', 'readonly');
      const store = tx.objectStore('ranges');
      const req = store.getAll();
      req.onsuccess = () => {
        let items = (req.result || []) as BonRange[];
        if (businessId) {
          items = items.filter((r) => r.business_id === businessId);
        }
        if (carriereId) {
          items = items.filter((r) => !r.carriere_id || r.carriere_id === carriereId);
        }
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- REPOSITORY: SYNC QUEUE ---
  async addToSyncQueue(op: SyncOperation): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getPendingSyncOperations(): Promise<SyncOperation[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const req = tx.objectStore('sync_queue').getAll();
      req.onsuccess = () => {
        const ops = (req.result || []) as SyncOperation[];
        const pending = ops.filter((o) => o.status === 'pending' || o.status === 'error');
        pending.sort((a, b) => a.timestamp - b.timestamp);
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateSyncOperationStatus(
    syncId: string,
    status: SyncOperation['status'],
    errorMessage?: string
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const getReq = store.get(syncId);
      getReq.onsuccess = () => {
        const op = getReq.result as SyncOperation | undefined;
        if (op) {
          op.status = status;
          if (errorMessage) op.error_message = errorMessage;
          if (status === 'syncing') op.retry_count = (op.retry_count || 0) + 1;
          store.put(op);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async removeSyncOperation(syncId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').delete(syncId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- REPOSITORY: CONFLICTS ---
  async addConflict(conflict: SyncConflict): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conflicts', 'readwrite');
      tx.objectStore('conflicts').put(conflict);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getUnresolvedConflicts(): Promise<SyncConflict[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conflicts', 'readonly');
      const req = tx.objectStore('conflicts').getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as SyncConflict[];
        resolve(list.filter((c) => !c.resolved));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async resolveConflict(conflictId: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conflicts', 'readwrite');
      const store = tx.objectStore('conflicts');
      const getReq = store.get(conflictId);
      getReq.onsuccess = () => {
        const item = getReq.result as SyncConflict | undefined;
        if (item) {
          item.resolved = true;
          store.put(item);
        }
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // --- REPOSITORY: PRODUCTS (CATALOGUE PRODUITS & TARIFS) ---
  async saveProducts(products: ProductItem[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      products.forEach((p) => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllProducts(businessId?: string, carriereId?: string): Promise<ProductItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const req = store.getAll();
      req.onsuccess = () => {
        let items = (req.result || []) as ProductItem[];
        if (businessId) {
          items = items.filter((p) => p.business_id === businessId);
        }
        if (carriereId) {
          items = items.filter((p) => !p.carriere_id || p.carriere_id === carriereId);
        }
        items.sort((a, b) => a.name.localeCompare(b.name));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteProduct(id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('products', 'readwrite');
      const store = tx.objectStore('products');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearLocalCache(): Promise<void> {
    const db = await this.getDB();
    const stores = ['carrieres', 'vouchers', 'loadings', 'commercials', 'ranges', 'products', 'app_meta'];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, 'readwrite');
      stores.forEach((s) => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const offlineStorage = new OfflineStorage();
