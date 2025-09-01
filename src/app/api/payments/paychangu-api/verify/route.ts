import { NextResponse } from 'next/server';
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
    const txRef = searchParams.get('tx_ref');
    if (!txRef) return NextResponse.json({ error: 'Missing tx_ref parameter' }, { status: 400 });

    const response = await fetch(`${process.env.NEXT_PUBLIC_PAYCHANGU_BASE_URL}/transaction/verify/${txRef}`, {
      headers: { 'Authorization': `Bearer ${process.env.PAYCHANGU_SECRET_KEY}` },
    });
    const data = await response.json();

    const bookingQuery = query(collection(db, 'bookings'), where('paychanguTxRef', '==', txRef));
    const bookingSnap = await getDocs(bookingQuery);

    if (bookingSnap.empty) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    const bookingDoc = bookingSnap.docs[0];
    if (bookingDoc.data().userId !== userId) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    if (data.status === 'success') {
      await updateDoc(doc(db, 'bookings', bookingDoc.id), {
        paymentStatus: 'paid',
        paymentDetails: data,
        updatedAt: serverTimestamp(),
      });
      return NextResponse.json({ success: true, paymentStatus: 'paid', bookingId: bookingDoc.id });
    }
    return NextResponse.json({ error: 'Payment not completed', status: data.status }, { status: 400 });
  } catch (error: any) {
    console.error('PayChangu verify error:', { message: error.message, tx_ref: request.url.split('tx_ref=')[1] });
    return NextResponse.json({ error: error.message || 'Failed to verify payment' }, { status: 500 });
  }
}