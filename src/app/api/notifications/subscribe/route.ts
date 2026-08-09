import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const userId = authUser.id;

    // Fetch existing user to get fcmTokens array
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Clean and filter current tokens to keep only valid Web Push subscriptions
    let currentTokens: any[] = [];
    if (Array.isArray(user.fcmTokens)) {
      currentTokens = user.fcmTokens.filter(sub => sub && typeof sub === 'object' && 'endpoint' in sub && 'keys' in sub);
    }

    // Check if subscription already exists by endpoint
    const existingIndex = currentTokens.findIndex(
      (sub: any) => sub && sub.endpoint === subscription.endpoint
    );

    if (existingIndex === -1) {
      currentTokens.push(subscription);
    }
      
    await prisma.user.update({
      where: { id: userId },
      data: { fcmTokens: currentTokens }
    });

    return NextResponse.json({ success: true, message: 'Subscription saved successfully' });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
