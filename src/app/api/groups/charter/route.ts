import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { 
      organizerName, 
      organizerPhone, 
      schoolName, 
      origin, 
      destination, 
      departureDate, 
      estimatedPax, 
      notes, 
      budget 
    } = data;

    // Get current user from auth header or session
    // For now we assume a simple user link (in production use auth helpers)
    const userId = req.headers.get('x-user-id'); 
    
    if (!userId) {
      // In a real app, this would be retrieved from the session
      // For this demo/setup, we'll allow it if we can find a user by phone or similar
    }

    const charterRequest = await (prisma as any).groupCharterRequest.create({
      data: {
        userId: userId || 'system', // Fallback for demo
        organizerName,
        organizerPhone,
        origin: `${schoolName} - ${origin}`,
        destination,
        departureDate: new Date(departureDate),
        estimatedPax: parseInt(estimatedPax),
        notes,
        budget: budget ? parseInt(budget) : null,
        status: 'pending'
      }
    });

    // Create a generic activity log
    await (prisma as any).activityLog.create({
      data: {
        userId: userId || 'system',
        action: 'create_charter_request',
        description: `Requested charter from ${origin} to ${destination} for ${estimatedPax} pax`,
        metadata: { charterId: charterRequest.id }
      }
    });

    return NextResponse.json({
      success: true,
      data: charterRequest
    });

  } catch (error: any) {
    logger.logError('api', 'Charter request failed', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  try {
    // If companyId is provided, show pending requests they can quote on
    // In this simple version, all companies see all pending requests
    const requests = await (prisma as any).groupCharterRequest.findMany({
      where: { status: 'pending' },
      include: {
        quotes: companyId ? { where: { companyId } } : true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: requests
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
