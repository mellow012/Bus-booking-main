import { NextRequest, NextResponse } from 'next/server';
import { getBookingsForChatterSchedule } from '@/lib/actions/chatterBooking.actions';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getBookingsForChatterSchedule(id);
    if (!result.success) {
      const status = result.error === 'Unauthorized' ? 401 : result.error === 'Forbidden' ? 403 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
