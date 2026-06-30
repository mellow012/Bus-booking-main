import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/client';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const supabase = createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find the operator record linked to the authenticated user's UID
    const operator = await prisma.operator.findUnique({
      where: { uid: user.id },
      include: {
        company: {
          select: { name: true },
        },
      },
    });

    if (!operator) {
      return NextResponse.json({ error: 'Operator profile not found.' }, { status: 404 });
    }

    return NextResponse.json(operator);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch operator profile' }, { status: 500 });
  }
}