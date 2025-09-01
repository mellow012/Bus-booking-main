import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '@/lib/stripe';
import { buffer } from 'micro';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  try {
    const event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET || '');

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const bookingId = session.metadata.bookingId;

      await updateDoc(doc(db, 'bookings', bookingId), {
        paymentStatus: 'paid',
        paymentDetails: session,
        updatedAt: serverTimestamp(),
      });
    }

    res.status(200).end();
  } catch (error: any) {
    console.error(error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
}