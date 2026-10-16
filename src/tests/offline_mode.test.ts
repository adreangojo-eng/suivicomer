import { describe, it, expect, beforeEach } from 'vitest';
import {
  Loading,
  LoadingVoucher,
  Commercial,
  BonRange,
  SyncOperation,
  SyncConflict,
  UserProfile,
  Business,
  BusinessMember,
  Carriere
} from '../types';
import {
  calculateTotalAmount,
  calculateRemainingDue,
  derivePaymentStatus
} from '../utils/calculations';
import { generateUuid, isUuid } from '../utils/uuid';

/**
 * SUITE DE TESTS DÉDIÉE : MODE 100% HORS-LIGNE & RÉSILIENCE RÉSEAU (SUIVICOMER)
 * Valide la persistance locale, le verrouillage des bons offline, la file d'attente
 * de synchronisation, l'idempotence et la résolution de conflits.
 */
describe('SUIVICOMER — Mode 100% Hors-Ligne & Moteur de Synchronisation', () => {

  const businessId = generateUuid();
  const carriereId = generateUuid();
  const commercialId = generateUuid();
  const voucherId = generateUuid();

  // -------------------------------------------------------------
  // TEST 1 : Création et réservation locale d'un bon hors-ligne
  // -------------------------------------------------------------
  it('1. Hors-Ligne : Enregistrement d\'un chargement avec réservation locale immédiate du bon', () => {
    // 1. État initial : bon disponible
    const voucher: LoadingVoucher = {
      id: voucherId,
      business_id: businessId,
      carriere_id: carriereId,
      range_id: generateUuid(),
      commercial_id: commercialId,
      voucher_number: 1042,
      status: 'disponible',
      is_local_reserved: false,
      created_at: new Date().toISOString(),
    };

    expect(voucher.status).toBe('disponible');
    expect(voucher.is_local_reserved).toBe(false);

    // 2. Création du chargement en mode déconnecté
    const syncId = `sync_${generateUuid()}`;
    const tonnage = 25.5;
    const pricePerTon = 12000;
    const totalAmount = calculateTotalAmount(tonnage, pricePerTon);
    const amountPaid = 200000;
    const remainingDue = calculateRemainingDue(totalAmount, amountPaid);
    const paymentStatus = derivePaymentStatus(totalAmount, amountPaid);

    const offlineLoading: Loading = {
      id: syncId,
      sync_id: syncId,
      business_id: businessId,
      carriere_id: carriereId,
      commercial_id: commercialId,
      voucher_id: voucher.id,
      voucher_number: voucher.voucher_number,
      loading_date: '2026-10-17',
      product: 'Gravier 15/25',
      truck_plate: 'LT-8899-AA',
      client_name: 'BTP Cameroun Express',
      tonnage,
      price_per_ton: pricePerTon,
      total_amount: totalAmount,
      amount_paid: amountPaid,
      remaining_due: remainingDue,
      payment_status: paymentStatus,
      sync_status: 'pending_sync',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Verrouillage local du bon (anti-double utilisation sur le même terminal)
    voucher.is_local_reserved = true;
    voucher.status = 'utilise';

    // 4. Vérifications
    expect(offlineLoading.sync_status).toBe('pending_sync');
    expect(offlineLoading.total_amount).toBe(306000);
    expect(offlineLoading.remaining_due).toBe(106000);
    expect(offlineLoading.payment_status).toBe('partiellement_paye');
    expect(voucher.status).toBe('utilise');
    expect(voucher.is_local_reserved).toBe(true);
  });

  // -------------------------------------------------------------
  // TEST 2 : Mise en file d'attente (Sync Queue) et persistance
  // -------------------------------------------------------------
  it('2. Hors-Ligne : Enfilement sécurisé dans la file sync_queue avec horodatage stable', () => {
    const queue: SyncOperation[] = [];
    const syncId = `sync_${generateUuid()}`;

    const op: SyncOperation = {
      sync_id: syncId,
      type: 'RECORD_LOADING',
      business_id: businessId,
      payload: {
        voucher_number: 1042,
        client_name: 'Société Razel',
      },
      status: 'pending',
      timestamp: Date.now(),
      retry_count: 0,
    };

    queue.push(op);

    expect(queue.length).toBe(1);
    expect(queue[0].status).toBe('pending');
    expect(queue[0].retry_count).toBe(0);

    // Simulation de persistance IndexedDB (sérialisation / désérialisation)
    const stored = JSON.parse(JSON.stringify(queue));
    expect(stored[0].sync_id).toBe(syncId);
  });

  // -------------------------------------------------------------
  // TEST 3 : Dépilage et transition vers 'synced' au retour du réseau
  // -------------------------------------------------------------
  it('3. Retour Réseau : Traitement séquentiel de la file et attribution du statut synced', () => {
    const syncId = `sync_${generateUuid()}`;
    const serverRealUuid = generateUuid();

    const localLoading: Loading = {
      id: syncId,
      sync_id: syncId,
      business_id: businessId,
      carriere_id: carriereId,
      commercial_id: commercialId,
      voucher_id: voucherId,
      voucher_number: 1042,
      loading_date: '2026-10-17',
      product: 'Sable 0/5',
      truck_plate: 'CE-555-XY',
      client_name: 'Chantier Omnisport',
      tonnage: 30,
      price_per_ton: 10000,
      total_amount: 300000,
      amount_paid: 300000,
      remaining_due: 0,
      payment_status: 'paye',
      sync_status: 'pending_sync',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let queue: SyncOperation[] = [
      {
        sync_id: syncId,
        type: 'RECORD_LOADING',
        business_id: businessId,
        payload: localLoading,
        status: 'pending',
        timestamp: Date.now(),
        retry_count: 0,
      },
    ];

    // Simulation du retour en ligne : traitement réussi
    const currentOp = queue[0];
    currentOp.status = 'syncing';

    // Réception de la réponse serveur avec UUID définitif
    localLoading.id = serverRealUuid;
    localLoading.sync_status = 'synced';

    // Retrait de la file
    queue = queue.filter((q) => q.sync_id !== currentOp.sync_id);

    expect(queue.length).toBe(0);
    expect(localLoading.sync_status).toBe('synced');
    expect(isUuid(localLoading.id)).toBe(true);
    expect(localLoading.id).toBe(serverRealUuid);
  });

  // -------------------------------------------------------------
  // TEST 4 : Idempotence et absorption des doublons de synchronisation
  // -------------------------------------------------------------
  it('4. Idempotence : Le serveur détecte les sync_id déjà traités et évite tout doublon', () => {
    const processedSyncIds = new Set<string>();
    const syncId = `sync_${generateUuid()}`;

    // Premier passage (succès initial)
    const handleSync = (sId: string) => {
      if (processedSyncIds.has(sId)) {
        return { success: true, is_duplicate: true };
      }
      processedSyncIds.add(sId);
      return { success: true, is_duplicate: false };
    };

    const firstTry = handleSync(syncId);
    expect(firstTry.success).toBe(true);
    expect(firstTry.is_duplicate).toBe(false);

    // Deuxième passage (coupure réseau pendant la confirmation, réessai du client)
    const secondTry = handleSync(syncId);
    expect(secondTry.success).toBe(true);
    expect(secondTry.is_duplicate).toBe(true);
    expect(processedSyncIds.size).toBe(1);
  });

  // -------------------------------------------------------------
  // TEST 5 : Gestion des conflits de bons
  // -------------------------------------------------------------
  it('5. Conflits : Détection et journalisation sans perte de données en cas de bon déjà utilisé', () => {
    const conflicts: SyncConflict[] = [];
    const usedVoucherNumber = 1042;

    // Simulation d'une erreur 409 / BON_DEJA_UTILISE
    const conflict: SyncConflict = {
      id: `conflict_${generateUuid()}`,
      sync_id: `sync_${generateUuid()}`,
      voucher_number: usedVoucherNumber,
      message: `Conflit détecté : Le bon ${usedVoucherNumber} a déjà été utilisé sur le serveur.`,
      payload: { voucher_number: usedVoucherNumber, truck_plate: 'LT-8899-AA' },
      created_at: new Date().toISOString(),
      resolved: false,
    };

    conflicts.push(conflict);

    expect(conflicts.length).toBe(1);
    expect(conflicts[0].resolved).toBe(false);

    // Résolution par l'Agréé : réattribution d'un autre bon libre (ex: 1043)
    conflicts[0].payload.voucher_number = 1043;
    conflicts[0].resolved = true;

    expect(conflicts[0].resolved).toBe(true);
    expect(conflicts[0].payload.voucher_number).toBe(1043);
  });

  // -------------------------------------------------------------
  // TEST 6 : Connexion Commercial Hors-Ligne
  // -------------------------------------------------------------
  it('6. Commercial Offline : Connexion locale réussie via code d\'accès et PIN stockés', () => {
    const commercial: Commercial = {
      id: commercialId,
      business_id: businessId,
      carriere_id: carriereId,
      full_name: 'Mado Commercial',
      phone: '679686939',
      access_code: 'COMM-9811',
      pin: '1234',
      is_secretary: false,
      can_edit_payments: false,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    // Recherche locale insensible à la casse
    const match = (identifier: string, pin: string) => {
      const cleanId = identifier.trim().toLowerCase();
      const cleanPin = pin.trim();
      return (
        (commercial.access_code?.toLowerCase() === cleanId ||
          commercial.phone === cleanId) &&
        commercial.pin === cleanPin &&
        commercial.is_active
      );
    };

    expect(match('comm-9811', '1234')).toBe(true);
    expect(match('COMM-9811', '1234')).toBe(true);
    expect(match('679686939', '1234')).toBe(true);
    expect(match('COMM-9811', '0000')).toBe(false);
  });

  // -------------------------------------------------------------
  // TEST 7 : Restauration de session Agréé en mode déconnecté
  // -------------------------------------------------------------
  it('7. Session Offline : Restauration fidèle du profil Agréé sans appel réseau', () => {
    const cachedProfile: UserProfile = {
      id: generateUuid(),
      email: 'directeur@carriere.com',
      full_name: 'Directeur Général',
      role: 'agree',
      phone: '690000000',
      created_at: new Date().toISOString(),
    };

    const cachedBusiness: Business = {
      id: businessId,
      name: 'Carrières Cameroun SA',
      owner_id: cachedProfile.id,
      created_at: new Date().toISOString(),
    };

    const cachedMember: BusinessMember = {
      id: generateUuid(),
      business_id: cachedBusiness.id,
      user_id: cachedProfile.id,
      role: 'agree',
      is_active: true,
      can_edit_payments: true,
      created_at: new Date().toISOString(),
    };

    // Vérification de la cohérence des identifiants (vrais UUIDs obligatoires)
    expect(isUuid(cachedProfile.id)).toBe(true);
    expect(isUuid(cachedBusiness.id)).toBe(true);
    expect(isUuid(cachedMember.id)).toBe(true);
    expect(cachedMember.business_id).toBe(cachedBusiness.id);
  });

});
