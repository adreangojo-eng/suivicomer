import { PaymentStatus } from '../types';

/**
 * Calcul précis du montant total : Tonnage * Prix par tonne
 * Arrondi à 2 décimales pour éviter les artefacts de virgule flottante en JavaScript.
 */
export function calculateTotalAmount(tonnage: number, pricePerTon: number): number {
  if (tonnage <= 0 || isNaN(tonnage)) return 0;
  if (pricePerTon < 0 || isNaN(pricePerTon)) return 0;
  return Math.round(tonnage * pricePerTon * 100) / 100;
}

/**
 * Calcul précis du reste à payer : Montant total - Montant déjà payé
 */
export function calculateRemainingDue(totalAmount: number, amountPaid: number): number {
  if (totalAmount <= 0) return 0;
  const safePaid = Math.max(0, amountPaid || 0);
  const remaining = Math.round((totalAmount - safePaid) * 100) / 100;
  return Math.max(0, remaining);
}

/**
 * Détermination du statut de paiement strictement dérivé des valeurs financières
 * Règle métier : Ne jamais stocker un statut qui pourrait contredire les montants.
 */
export function derivePaymentStatus(totalAmount: number, amountPaid: number): PaymentStatus {
  const safePaid = Math.max(0, amountPaid || 0);
  if (safePaid <= 0) {
    return 'non_paye';
  }
  if (safePaid >= totalAmount && totalAmount > 0) {
    return 'paye';
  }
  return 'partiellement_paye';
}

/**
 * Validation de cohérence d'une plage de numéros de bons
 */
export function validateRange(startNum: number, endNum: number): {
  valid: boolean;
  error?: string;
  count: number;
} {
  if (!Number.isInteger(startNum) || startNum <= 0) {
    return { valid: false, error: 'Le numéro de début doit être un entier strictement positif', count: 0 };
  }
  if (!Number.isInteger(endNum) || endNum <= 0) {
    return { valid: false, error: 'Le numéro de fin doit être un entier strictement positif', count: 0 };
  }
  if (endNum < startNum) {
    return { valid: false, error: 'Le numéro de fin doit être supérieur ou égal au numéro de début', count: 0 };
  }

  const count = endNum - startNum + 1;
  if (count > 5000) {
    return { valid: false, error: 'Une plage ne peut pas dépasser 5 000 bons à la fois', count };
  }

  return { valid: true, count };
}

/**
 * Vérification des chevauchements de plages pour une même entreprise
 */
export function checkRangeOverlap(
  startNum: number,
  endNum: number,
  existingRanges: Array<{ start_num: number; end_num: number }>
): { hasOverlap: boolean; conflictingRange?: { start_num: number; end_num: number } } {
  for (const range of existingRanges) {
    if (startNum <= range.end_num && endNum >= range.start_num) {
      return { hasOverlap: true, conflictingRange: range };
    }
  }
  return { hasOverlap: false };
}

/**
 * Formatage de montants en Francs CFA (FCFA) avec séparateurs d'espaces
 */
export function formatFCFA(amount: number): string {
  if (isNaN(amount)) return '0 FCFA';
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(Math.round(amount));
  return `${formatted} FCFA`;
}

/**
 * Formatage des tonnages en tonnes (ex: 25,5 t)
 */
export function formatTonnage(tonnage: number): string {
  if (isNaN(tonnage)) return '0 t';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(tonnage) + ' t';
}

/**
 * Formatage de date au format français standard (ex: 16/10/2026)
 */
export function formatDateFr(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Comparaison souple et robuste de noms de produits (ex: "Gravier 15/25" et "15/25", "Sable 0/5" et "0/5")
 */
export function matchesProduct(loadingProduct?: string, filterProduct?: string): boolean {
  if (!filterProduct || !filterProduct.trim()) return true;
  if (!loadingProduct || !loadingProduct.trim()) return false;

  const lp = loadingProduct.toLowerCase().trim();
  const fp = filterProduct.toLowerCase().trim();

  if (lp === fp) return true;
  if (lp.includes(fp) || fp.includes(lp)) return true;

  // Extraction des granulométries de type "0/5", "5/15", "15/25", etc.
  const grainRegex = /\b\d+\s*\/\s*\d+\b/g;
  const lpGrains = (lp.match(grainRegex) || []).map((g) => g.replace(/\s+/g, ''));
  const fpGrains = (fp.match(grainRegex) || []).map((g) => g.replace(/\s+/g, ''));

  if (lpGrains.length > 0 && fpGrains.length > 0) {
    return lpGrains.some((g) => fpGrains.includes(g));
  }

  return false;
}

