// src/app/api/auth/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import * as dbActions from '@/lib/actions/user.actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/profile
 * Fetch the authenticated user's profile from SQL.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { success, data, error } = await dbActions.getUserById(user.id);
    if (!success) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('GET /api/auth/profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    
    // Whitelist only safe fields to prevent privilege escalation (e.g. updating 'role')
    const updatableFields = [
      'firstName', 'lastName', 'phone', 'nationalId', 'sex', 
      'currentAddress', 'setupCompleted', 'isActive', 'emailVerified',
      'passwordSet', 'invitationSent' // Needed for conductor/operator auto-activation
    ];

    const sanitizedData: Record<string, any> = {};
    updatableFields.forEach(field => {
      if (body[field] !== undefined) {
        sanitizedData[field] = body[field];
      }
    });

    // Special case for email - usually handled by Auth, but keep in sync if provided
    if (body.email) {
      sanitizedData.email = body.email;
    } else if (user.email) {
      // Always include email for proper user matching in syncUser
      sanitizedData.email = user.email;
    }

    const { success, data, error } = await dbActions.syncUser(user.id, sanitizedData);
    
    if (!success) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('PATCH /api/auth/profile error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

