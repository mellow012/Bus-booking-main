import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const userId = session.user.id;

    // Fetch existing user to get fcmTokens array
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // fcmTokens is typed as JSON array
    let currentTokens: any[] = [];
    if (Array.isArray(user.fcmTokens)) {
      currentTokens = user.fcmTokens;
    } else if (user.fcmTokens) {
      try {
        currentTokens = JSON.parse(user.fcmTokens as string);
        if (!Array.isArray(currentTokens)) currentTokens = [currentTokens];
      } catch (e) {
        currentTokens = [];
      }
    }

    // Check if subscription already exists by endpoint
    const existingIndex = currentTokens.findIndex(
      (sub: any) => sub && sub.endpoint === subscription.endpoint
    );

    if (existingIndex === -1) {
      currentTokens.push(subscription);
      
      await prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: currentTokens }
      });
    }

    return NextResponse.json({ success: true, message: 'Subscription saved successfully' });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
