import { NextRequest, NextResponse } from 'next/server';
import { createChatterRequest, createChatterSchedule, getChatterRequestsForCompany } from '@/lib/actions/chatter.actions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 });
    }
    const result = await getChatterRequestsForCompany(companyId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.useOwnBus) {
      const result = await createChatterSchedule(body);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    } else {
      // Map seatsRequested to estimatedPax if missing, but it is also in the database schema as estimatedPax
      // Let's modify the createChatterRequest call if needed.
      const result = await createChatterRequest(body);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
