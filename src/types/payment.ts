import { FirestoreDocument } from './core';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'          // Flutterwave uses 'paid' — alias for succeeded on booking docs
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
  | 'flutterwave'   // replaces paychangu
  | 'paychangu'
  | 'local_bank'
  | 'cash';         // cash_on_boarding — no gateway involved

export interface Payment extends FirestoreDocument {
  id:        string;
  bookingId: string;
  userId:    string;
  companyId: string;
  amount:    number;
  currency:  string;
  status:    PaymentStatus;
  method:    PaymentMethod;
  provider:  PaymentProvider;

  // ── Flutterwave-specific ─────────────────────────────────────────────────
  flutterwaveTxRef?:         string;  // tx_ref we generate — used to look up booking in webhook
  flutterwaveFlwRef?:        string;  // flw_ref Flutterwave assigns — required for refunds
  flutterwaveTransactionId?: number;  // numeric ID — required for verify + refund API calls

  // ── Stripe-specific (kept for hybrid deployments) ────────────────────────
  stripeSessionId?:      string;
  stripePaymentIntent?:  string;
  clientSecret?:         string;

  // ── General ──────────────────────────────────────────────────────────────
  transactionId?:        string;
  transactionReference?: string;
  initiatedAt:           Date;
  completedAt?:          Date;
  failureReason?:        string;
  metadata?:             Record<string, any>;
}