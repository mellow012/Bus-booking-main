import { BaseEntity } from './core';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type PaymentMethod =
  | 'card'
  | 'mobile_money'
  | 'bank_transfer'
  | 'cash'
  | 'cash_on_boarding';

export type PaymentProvider =
  | 'paychangu'
  | 'local_bank'
  | 'cash';         // cash_on_boarding — no gateway involved

export interface Payment extends BaseEntity {
  id:        string;
  bookingId: string;
  userId:    string;
  companyId: string;
  amount:    number;
  currency:  string;
  status:    PaymentStatus;
  method:    PaymentMethod;
  provider:  PaymentProvider;

  // ── PayChangu-specific ─────────────────────────────────────────────────
  paychanguTxRef?:         string;  // tx_ref generated for PayChangu payments
  paychanguResponse?:      Record<string, unknown>;

  // ── General ──────────────────────────────────────────────────────────────
  transactionId?:        string;
  transactionReference?: string;
  initiatedAt:           Date;
  completedAt?:          Date;
  failureReason?:        string;
  metadata?:             Record<string, unknown>;
}