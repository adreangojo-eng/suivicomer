export type UserRole = 'agree' | 'secretaire' | 'commercial';

export type VoucherStatus = 'disponible' | 'utilise';

export type PaymentStatus = 'non_paye' | 'partiellement_paye' | 'paye';

export type ProductType = 'Sable 0/5' | 'Gravier 5/15' | 'Gravier 15/25' | 'Moellon';

export const AVAILABLE_PRODUCTS: ProductType[] = [
  'Sable 0/5',
  'Gravier 5/15',
  'Gravier 15/25',
  'Moellon'
];

export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
}

export interface Business {
  id: string;
  name: string;
  owner_id: string;
  address?: string;
  phone?: string;
  created_at: string;
}

export interface Carriere {
  id: string;
  business_id: string;
  name: string;
  location?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  // Métriques résumées
  totalCommercials?: number;
  totalVouchersAvailable?: number;
  totalLoadings?: number;
  totalAmountInvoiced?: number;
}

export interface BusinessMember {
  id: string;
  business_id: string;
  carriere_id?: string;
  user_id: string;
  role: UserRole;
  is_active: boolean;
  can_edit_payments: boolean;
  created_at: string;
  profile?: UserProfile;
}

export interface Commercial {
  id: string;
  business_id: string;
  carriere_id?: string;
  user_id?: string | null;
  full_name: string;
  phone?: string;
  email?: string;
  access_code?: string; // Code d'accès direct pour connexion
  password?: string;
  pin?: string;
  is_secretary?: boolean;
  can_edit_payments?: boolean;
  is_active: boolean;
  created_at: string;
}

export interface BonRange {
  id: string;
  business_id: string;
  carriere_id?: string;
  commercial_id: string;
  start_num: number;
  end_num: number;
  total_count: number;
  created_by?: string;
  created_at: string;
  commercial_name?: string;
}

export interface LoadingVoucher {
  id: string;
  business_id: string;
  carriere_id?: string;
  range_id: string;
  commercial_id: string;
  voucher_number: number;
  status: VoucherStatus;
  used_at?: string | null;
  is_local_reserved?: boolean;
  created_at: string;
}

export interface Loading {
  id: string;
  business_id: string;
  carriere_id?: string;
  commercial_id: string;
  voucher_id: string;
  voucher_number: number;
  loading_date: string;
  product: ProductType;
  truck_plate: string;
  client_name: string;
  tonnage: number;
  price_per_ton: number;
  total_amount: number;
  amount_paid: number;
  remaining_due: number; // derived
  payment_status: PaymentStatus; // derived
  payment_ref?: string;
  sync_id: string;
  sync_status: 'synced' | 'pending_sync' | 'conflict';
  created_by?: string;
  created_at: string;
  updated_at: string;
  commercial_name?: string;
}

export interface SyncOperation {
  sync_id: string;
  type: 'RECORD_LOADING' | 'UPDATE_PAYMENT';
  business_id: string;
  payload: any;
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
  error_message?: string;
  timestamp: number;
  retry_count: number;
}

export interface SyncConflict {
  id: string;
  sync_id: string;
  voucher_number: number;
  message: string;
  payload: any;
  created_at: string;
  resolved: boolean;
}

export interface DashboardMetrics {
  activeCommercialsCount: number;
  totalVouchersAssigned: number;
  totalVouchersUsed: number;
  totalVouchersAvailable: number;
  totalLoadingsCount: number;
  totalTonnageLoaded: number;
  totalAmountInvoiced: number;
  totalAmountPaid: number;
  totalAmountRemaining: number;
  unpaidLoadingsCount: number;
  partiallyPaidLoadingsCount: number;
  fullyPaidLoadingsCount: number;
}
