import { describe, it, expect } from 'vitest';
import {
  matchesProduct,
  derivePaymentStatus,
  calculateRemainingDue,
  calculateTotalAmount
} from '../utils/calculations';
import { Loading, Commercial } from '../types';

describe('Filtering and Commercial Dashboard Specifications', () => {
  describe('Product Flexible Matching (matchesProduct)', () => {
    it('matches identical product names', () => {
      expect(matchesProduct('Gravier 15/25', 'Gravier 15/25')).toBe(true);
      expect(matchesProduct('Sable 0/5', 'sable 0/5')).toBe(true);
      expect(matchesProduct('Moellon', 'Moellon')).toBe(true);
    });

    it('matches short grain names with full catalogue names and vice versa', () => {
      // Le chargement contient "15/25" et le filtre sélectionne "Gravier 15/25"
      expect(matchesProduct('15/25', 'Gravier 15/25')).toBe(true);
      // Le chargement contient "Gravier 15/25" et le filtre sélectionne "15/25"
      expect(matchesProduct('Gravier 15/25', '15/25')).toBe(true);
      // Cas du sable 0/5
      expect(matchesProduct('0/5', 'Sable 0/5')).toBe(true);
      expect(matchesProduct('Sable 0/5', '0/5')).toBe(true);
      // Cas du gravier 5/15
      expect(matchesProduct('5/15', 'Gravier 5/15')).toBe(true);
      expect(matchesProduct('Gravier 5/15', '5/15')).toBe(true);
    });

    it('does not match distinct grain sizes or different products', () => {
      expect(matchesProduct('0/5', 'Gravier 15/25')).toBe(false);
      expect(matchesProduct('5/15', 'Gravier 15/25')).toBe(false);
      expect(matchesProduct('Moellon', 'Gravier 15/25')).toBe(false);
      expect(matchesProduct('15/25', 'Sable 0/5')).toBe(false);
    });

    it('handles empty filters gracefully', () => {
      expect(matchesProduct('Gravier 15/25', '')).toBe(true);
      expect(matchesProduct('Gravier 15/25', undefined)).toBe(true);
    });
  });

  describe('Payment Status Derivation & Filtering', () => {
    it('derives accurate payment status based on amounts', () => {
      // 0 versé
      expect(derivePaymentStatus(75000, 0)).toBe('non_paye');
      // Acompte versé
      expect(derivePaymentStatus(75000, 40000)).toBe('partiellement_paye');
      // Totalité versée
      expect(derivePaymentStatus(75000, 75000)).toBe('paye');
      // Surplus éventuel
      expect(derivePaymentStatus(75000, 80000)).toBe('paye');
    });

    it('calculates remaining due accurately', () => {
      expect(calculateRemainingDue(75000, 0)).toBe(75000);
      expect(calculateRemainingDue(75000, 40000)).toBe(35000);
      expect(calculateRemainingDue(75000, 75000)).toBe(0);
    });
  });

  describe('Combined Filtering in Loadings History', () => {
    const mockCommercials: Commercial[] = [
      {
        id: 'comm_madou_id',
        business_id: 'bus_1',
        full_name: 'ma mado',
        access_code: 'COMM-1001',
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'comm_wylliss_id',
        business_id: 'bus_1',
        full_name: 'wylliss',
        access_code: 'COMM-1002',
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    const mockLoadings: Loading[] = [
      {
        id: 'load_1',
        business_id: 'bus_1',
        commercial_id: 'comm_wylliss_id',
        commercial_name: 'wylliss',
        voucher_id: 'v_1',
        voucher_number: 1200,
        loading_date: '2026-10-17',
        product: '15/25',
        truck_plate: 'HJD543KN',
        tonnage: 17,
        price_per_ton: 6000,
        total_amount: 102000,
        amount_paid: 0,
        remaining_due: 102000,
        payment_status: 'non_paye',
        sync_id: 's_1',
        sync_status: 'synced',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'load_2',
        business_id: 'bus_1',
        commercial_id: 'comm_madou_id',
        commercial_name: 'ma mado',
        voucher_id: 'v_2',
        voucher_number: 3302,
        loading_date: '2026-10-17',
        product: '0/5',
        truck_plate: 'DU543GD',
        tonnage: 15,
        price_per_ton: 5000,
        total_amount: 75000,
        amount_paid: 40000,
        remaining_due: 35000,
        payment_status: 'partiellement_paye',
        sync_id: 's_2',
        sync_status: 'synced',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'load_3',
        business_id: 'bus_1',
        commercial_id: 'comm_madou_id',
        commercial_name: 'ma mado',
        voucher_id: 'v_3',
        voucher_number: 3301,
        loading_date: '2026-10-17',
        product: '0/5',
        truck_plate: 'CE 179 FT',
        tonnage: 15,
        price_per_ton: 5000,
        total_amount: 75000,
        amount_paid: 0,
        remaining_due: 75000,
        payment_status: 'non_paye',
        sync_id: 's_3',
        sync_status: 'synced',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('filters loadings strictly when selecting commercial Madou', () => {
      const selectedCommFilter = 'comm_madou_id';
      const filtered = mockLoadings.filter((l) => {
        const comm = mockCommercials.find((c) => c.id === selectedCommFilter);
        const matchId = l.commercial_id === selectedCommFilter;
        const matchName = comm && l.commercial_name?.toLowerCase() === comm.full_name.toLowerCase();
        return matchId || matchName;
      });

      expect(filtered.length).toBe(2);
      expect(filtered.every((l) => l.commercial_name === 'ma mado')).toBe(true);
      expect(filtered.some((l) => l.commercial_name === 'wylliss')).toBe(false);
    });

    it('filters loadings strictly when selecting product "Sable 0/5" on loadings recorded as "0/5"', () => {
      const selectedProdFilter = 'Sable 0/5';
      const filtered = mockLoadings.filter((l) => matchesProduct(l.product, selectedProdFilter));

      expect(filtered.length).toBe(2);
      expect(filtered.map((l) => l.voucher_number)).toEqual([3302, 3301]);
    });

    it('filters loadings strictly when selecting status "non_paye"', () => {
      const selectedStatusFilter = 'non_paye';
      const filtered = mockLoadings.filter(
        (l) => derivePaymentStatus(l.total_amount, l.amount_paid) === selectedStatusFilter
      );

      expect(filtered.length).toBe(2);
      expect(filtered.map((l) => l.voucher_number)).toEqual([1200, 3301]);
    });

    it('combines commercial, product, and status filters simultaneously', () => {
      const selectedCommFilter = 'comm_madou_id';
      const selectedProdFilter = 'Sable 0/5'; // Matches "0/5"
      const selectedStatusFilter = 'partiellement_paye'; // Matches only voucher 3302

      const filtered = mockLoadings.filter((l) => {
        const comm = mockCommercials.find((c) => c.id === selectedCommFilter);
        const matchId = l.commercial_id === selectedCommFilter;
        const matchName = comm && l.commercial_name?.toLowerCase() === comm.full_name.toLowerCase();
        if (!matchId && !matchName) return false;

        if (!matchesProduct(l.product, selectedProdFilter)) return false;

        if (derivePaymentStatus(l.total_amount, l.amount_paid) !== selectedStatusFilter) return false;

        return true;
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].voucher_number).toBe(3302);
      expect(filtered[0].amount_paid).toBe(40000);
    });
  });

  describe('Commercial Dedicated Dashboard Aggregations', () => {
    const madouLoadings: Loading[] = [
      {
        id: '1',
        business_id: 'b',
        commercial_id: 'm',
        voucher_id: 'v1',
        voucher_number: 3301,
        loading_date: '2026-10-17',
        product: '0/5',
        truck_plate: 'AA111',
        tonnage: 15,
        price_per_ton: 5000,
        total_amount: 75000,
        amount_paid: 0,
        remaining_due: 75000,
        payment_status: 'non_paye',
        sync_id: 's1',
        sync_status: 'synced',
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        business_id: 'b',
        commercial_id: 'm',
        voucher_id: 'v2',
        voucher_number: 3302,
        loading_date: '2026-10-17',
        product: '0/5',
        truck_plate: 'BB222',
        tonnage: 15,
        price_per_ton: 5000,
        total_amount: 75000,
        amount_paid: 40000,
        remaining_due: 35000,
        payment_status: 'partiellement_paye',
        sync_id: 's2',
        sync_status: 'synced',
        created_at: '',
        updated_at: '',
      },
    ];

    it('calculates total invoiced, total paid, and total remaining due for Madou', () => {
      const totalInvoiced = madouLoadings.reduce((sum, l) => sum + l.total_amount, 0);
      const totalPaid = madouLoadings.reduce((sum, l) => sum + l.amount_paid, 0);
      const totalRemaining = totalInvoiced - totalPaid;

      expect(totalInvoiced).toBe(150000); // 75k + 75k
      expect(totalPaid).toBe(40000);      // 0 + 40k
      expect(totalRemaining).toBe(110000); // 150k - 40k
    });

    it('breaks down product totals for the dedicated dashboard', () => {
      const productMap = new Map<string, { tonnage: number; invoiced: number; paid: number; due: number }>();
      madouLoadings.forEach((l) => {
        const item = productMap.get(l.product) || { tonnage: 0, invoiced: 0, paid: 0, due: 0 };
        item.tonnage += l.tonnage;
        item.invoiced += l.total_amount;
        item.paid += l.amount_paid;
        item.due += l.total_amount - l.amount_paid;
        productMap.set(l.product, item);
      });

      const product0_5 = productMap.get('0/5');
      expect(product0_5).toBeDefined();
      expect(product0_5?.tonnage).toBe(30);
      expect(product0_5?.invoiced).toBe(150000);
      expect(product0_5?.paid).toBe(40000);
      expect(product0_5?.due).toBe(110000);
    });
  });
});
