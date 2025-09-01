import { NextResponse } from 'next/server';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tx_ref, status } = body;

    if (!tx_ref || !status) {
      return NextResponse.json({ error: 'Missing tx_ref or status' }, { status: 400 });
    }

    const bookingQuery = query(collection(db, 'bookings'), where('paychanguTxRef', '==', tx_ref));
    const bookingSnap = await getDocs(bookingQuery);

    if (bookingSnap.empty) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const bookingDoc = bookingSnap.docs[0];
    const bookingId = bookingDoc.id;

    if (status === 'success') {
      await updateDoc(doc(db, 'bookings', bookingId), {
        paymentStatus: 'paid',
        paymentDetails: body,
        updatedAt: serverTimestamp(),
      });
    } else if (status === 'failed' || status === 'cancelled') {
      await updateDoc(doc(db, 'bookings', bookingId), {
        paymentStatus: 'failed',
        paymentFailureReason: `PayChangu status: ${status}`,
        updatedAt: serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true, message: 'Callback processed' }, { status: 200 });
  } catch (error: any) {
    console.error('PayChangu callback error:', { message: error.message, body });
    return NextResponse.json({ error: 'Failed to process callback', message: error.message }, { status: 500 });
  }
}