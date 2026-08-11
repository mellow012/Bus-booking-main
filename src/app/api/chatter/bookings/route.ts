import { NextRequest, NextResponse } from 'next/server';
import { createChatterBooking } from '@/lib/actions/chatterBooking.actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await createChatterBooking(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
