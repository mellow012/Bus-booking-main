// src/app/api/auth/login/route.ts

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import  {adminAuth,adminDb}  from '@/lib/firebaseAdmin'; // <-- Import modular services

interface PostLoginRequest {
  companyId: string;
  action: 'activate_company';
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      // Use the imported 'auth' service directly
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      }, { status: 401 });
    }

    const { companyId, action }: PostLoginRequest = await req.json();

    if (!companyId || !action) {
      return NextResponse.json({
        error: 'Bad request',
        message: 'Missing required fields: companyId and action',
      }, { status: 400 });
    }

    const userClaims = decodedToken;
    if (userClaims.role !== 'company_admin' || userClaims.companyId !== companyId) {
      return NextResponse.json({
        error: 'Forbidden',
        message: 'Insufficient permissions to perform this action',
      }, { status: 403 });
    }

    if (action === 'activate_company') {
        await activateCompany(companyId);
    } else {
        return NextResponse.json({
          error: 'Bad request',
          message: `Unknown action: ${action}`,
        }, { status: 400 });
    }

    console.log(`Action '${action}' completed for company ${companyId} by user ${decodedToken.uid}`);

    return NextResponse.json({
      success: true,
      message: 'Action completed successfully',
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error.message || 'An unexpected error occurred',
    }, { status: 500 });
  }
}

// Helper function to perform the Firestore update
async function activateCompany(companyId: string): Promise<void> {
  const companyRef = adminDb.collection('companies').doc(companyId);
  const companyDoc = await companyRef.get();

  if (!companyDoc.exists) {
    // Throw an error that the main catch block can handle
    throw new Error(`Company ${companyId} not found`);
  }

  const companyData = companyDoc.data();
  if (companyData?.status === 'pending') {
    await companyRef.update({
      status: 'active',
      // Import FieldValue for timestamps
      updatedAt: FieldValue.serverTimestamp(),
      activatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`Company ${companyId} activated successfully.`);
  } else {
    console.log(`Company ${companyId} status is already '${companyData?.status}'. No action taken.`);
  }
}