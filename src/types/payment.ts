export interface PaymentIntent {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  clientSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentProvider {
  id: string;
  name: string; // e.g., "PayChangu", "Stripe"
  isActive: boolean;
  supportedMethods: string[]; // e.g., "mobile_money", "card"
}