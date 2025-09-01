import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const idToken = authHeader.split('Bearer ')[1];
  let userId;
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    userId = decodedToken.uid;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId) return NextResponse.json({ error: 'Missing session_id parameter' }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const bookingQuery = query(collection(db, 'bookings'), where('stripeSessionId', '==', sessionId));
    const bookingSnap = await getDocs(bookingQuery);

    if (bookingSnap.empty) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const bookingDoc = bookingSnap.docs[0];
    if (bookingDoc.data().userId !== userId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    if (session.payment_status === 'paid') {
      await updateDoc(doc(db, 'bookings', bookingDoc.id), {
        paymentStatus: 'paid',
        paymentDetails: session,
        updatedAt: serverTimestamp(),
      });
      return NextResponse.json({ success: true, payment_status: session.payment_status, bookingId: bookingDoc.id });
    }
    return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
  } catch (error: any) {
    console.error('Stripe verify error:', { message: error.message, session_id: request.url.split('session_id=')[1] });
    return NextResponse.json({ error: error.message || 'Failed to verify payment' }, { status: 500 });
  }
}