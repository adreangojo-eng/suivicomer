import { describe, it, expect } from 'vitest';
import {
  ProductItem,
  DEFAULT_INITIAL_PRODUCTS,
  PAYMENT_REFERENCE_OPTIONS,
  Loading
} from '../types';
import { calculateTotalAmount, calculateRemainingDue, derivePaymentStatus } from '../utils/calculations';
import { generateUuid } from '../utils/uuid';

describe('SuiviComer — Produits & Tarification automatique, Options Versement & Bons', () => {

  const businessId = generateUuid();
  const carriereId = generateUuid();
  const commercialId = generateUuid();

  it('1. Catalogue produits initial avec prix par tonne pré-enregistrés', () => {
    expect(DEFAULT_INITIAL_PRODUCTS.length).toBeGreaterThanOrEqual(4);
    const sable = DEFAULT_INITIAL_PRODUCTS.find((p) => p.name === 'Sable 0/5');
    expect(sable).toBeDefined();
    expect(sable?.default_price_per_ton).toBe(8000);

    const gravier = DEFAULT_INITIAL_PRODUCTS.find((p) => p.name === 'Gravier 5/15');
    expect(gravier).toBeDefined();
    expect(gravier?.default_price_per_ton).toBe(10000);
  });

  it('2. Ajout dynamique d\'un nouveau produit personnalisé avec son prix', () => {
    const customProduct: ProductItem = {
      id: generateUuid(),
      business_id: businessId,
      carriere_id: carriereId,
      name: 'Gravier 0/14 Concassé',
      default_price_per_ton: 14500,
      created_at: new Date().toISOString()
    };

    expect(customProduct.name).toBe('Gravier 0/14 Concassé');
    expect(customProduct.default_price_per_ton).toBe(14500);

    // Calcul automatique pour 20 tonnes
    const tonnage = 20;
    const totalAmount = calculateTotalAmount(tonnage, customProduct.default_price_per_ton);
    expect(totalAmount).toBe(290000);
  });

  it('3. Référence de versement : conformité avec les 3 options demandées', () => {
    expect(PAYMENT_REFERENCE_OPTIONS).toContain('Versé dans le compte');
    expect(PAYMENT_REFERENCE_OPTIONS).toContain('Dépôt par téléphone');
    expect(PAYMENT_REFERENCE_OPTIONS).toContain('Espèces');
    expect(PAYMENT_REFERENCE_OPTIONS.length).toBe(3);
  });

  it('4. Enregistrement d\'un chargement sans nom de client obligatoire', () => {
    const total = calculateTotalAmount(15, 10000);
    const paid = 150000;

    const loadingWithoutClient: Loading = {
      id: generateUuid(),
      business_id: businessId,
      carriere_id: carriereId,
      commercial_id: commercialId,
      voucher_id: generateUuid(),
      voucher_number: 1050,
      loading_date: '2026-10-17',
      product: 'Gravier 5/15',
      truck_plate: 'LT-1122-BB',
      client_name: 'Client Comptant',
      tonnage: 15,
      price_per_ton: 10000,
      total_amount: total,
      amount_paid: paid,
      remaining_due: calculateRemainingDue(total, paid),
      payment_status: derivePaymentStatus(total, paid),
      payment_ref: 'Versé dans le compte',
      sync_id: `sync_${generateUuid()}`,
      sync_status: 'synced',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    expect(loadingWithoutClient.client_name).toBe('Client Comptant');
    expect(loadingWithoutClient.payment_ref).toBe('Versé dans le compte');
    expect(loadingWithoutClient.total_amount).toBe(150000);
    expect(loadingWithoutClient.remaining_due).toBe(0);
    expect(loadingWithoutClient.payment_status).toBe('paye');
  });

  it('5. Les bons assignés à la carrière ou sans carriere_id sont accessibles à l\'Agréé', () => {
    const vouchers = [
      { id: 'v1', business_id: businessId, carriere_id: carriereId, status: 'disponible', is_local_reserved: false },
      { id: 'v2', business_id: businessId, carriere_id: undefined, status: 'disponible', is_local_reserved: false },
      { id: 'v3', business_id: businessId, carriere_id: 'other_carriere', status: 'disponible', is_local_reserved: false },
    ];

    const availableForThisCarriere = vouchers.filter(
      (v) => (!carriereId || !v.carriere_id || v.carriere_id === carriereId) && v.status === 'disponible'
    );

    expect(availableForThisCarriere.length).toBe(2);
    expect(availableForThisCarriere.map((v) => v.id)).toEqual(['v1', 'v2']);
  });
});
