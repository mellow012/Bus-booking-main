import { NextRequest, NextResponse } from 'next/server';
import { confirmChatterRequest } from '@/lib/actions/chatter.actions';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;
    const body = await req.json();
    const result = await confirmChatterRequest({
      requestId,
      ...body,
    });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
