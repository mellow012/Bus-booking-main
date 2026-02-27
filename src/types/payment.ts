import { FirestoreDocument } from './core';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';
export type PaymentMethod = 'card' | 'mobile_money' | 'bank_transfer' | 'cash'| 'cash_on_boarding';
export type PaymentProvider = 'paychangu' | 'stripe' | 'local_bank';

export interface Payment extends FirestoreDocument {
  id: string;
  bookingId: string;
  userId: string;
  companyId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  provider: PaymentProvider;
  transactionId?: string;
  transactionReference?: string;
  clientSecret?: string;  // For Stripe
  initiatedAt: Date;
  completedAt?: Date;
  failureReason?: string;
  metadata?: Record<string, any>;
}
