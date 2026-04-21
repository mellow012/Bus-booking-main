/**
 * GET /api/search/schedules
 * Advanced search endpoint for the search page
 * Supports filtering by origin, destination, date, and sort options
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Required parameters
    const origin = searchParams.get('origin')?.toLowerCase().trim() || '';
    const destination = searchParams.get('destination')?.toLowerCase().trim() || '';
    
    // Optional parameters
    const date = searchParams.get('date') || ''; // YYYY-MM-DD
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(
      parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)),
      MAX_LIMIT
    );
    const sortBy = searchParams.get('sortBy') || 'time'; // time, price_asc, price_desc, seats
    const pageOffset = (page - 1) * limit;

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'origin and destination are required' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: any = {
      status: 'active',
      availableSeats: { gt: 0 },
      arrivalDateTime: { gt: new Date() },
      company: { status: 'active' }, // Only show schedules from active companies
      route: {
        AND: [
          { origin: { contains: origin, mode: 'insensitive' } },
          { destination: { contains: destination, mode: 'insensitive' } },
        ],
      },
    };

    // Optional: filter by date
    if (date) {
      const startOfDay = new Date(`${date}T00:00:00Z`);
      const endOfDay = new Date(`${date}T23:59:59Z`);
      where.departureDateTime = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Determine sort order
    let orderBy: any = { departureTime: 'asc' };
    if (sortBy === 'price_asc') orderBy = { price: 'asc' };
    else if (sortBy === 'price_desc') orderBy = { price: 'desc' };
    else if (sortBy === 'seats') orderBy = { availableSeats: 'desc' };

    // Execute search
    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        route: true,
        bus: { include: { company: true } },
        company: true,
      },
      orderBy,
      skip: pageOffset,
      take: limit,
    });

    const total = await prisma.schedule.count({ where });

    // Transform to enhanced format
    const enhanced = schedules.map(sch => {
      const route = sch.route;
      const bus = sch.bus;
      const company = sch.company || bus?.company;
      const dep = new Date(sch.departureDateTime);
      const arr = new Date(sch.arrivalDateTime);

      let currentStatus = sch.status;
      if (sch.status === 'active') {
        const now = new Date();
        if (now >= dep && now <= arr) {
          currentStatus = 'in_transit';
        } else if (now > arr) {
          currentStatus = 'completed';
        }
      }

      return {
        id: sch.id,
        companyId: sch.companyId,
        busId: sch.busId,
        routeId: sch.routeId,
        price: sch.price,
        availableSeats: sch.availableSeats,
        totalSeats: bus?.capacity || 40,
        status: currentStatus,
        date: dep.toISOString().split('T')[0],
        departureTime: dep.toTimeString().slice(0, 5),
        arrivalTime: arr.toTimeString().slice(0, 5),
        duration: Math.round((arr.getTime() - dep.getTime()) / 60000),
        distance: route.distance || 0,
        companyName: company?.name || 'Unknown',
        companyLogo: company?.logo,
        origin: route.origin,
        destination: route.destination,
        busNumber: bus?.licensePlate || 'N/A',
        busType: bus?.busType || 'Standard',
        amenities: (bus?.amenities as string[]) || [],
      };
    });

    return NextResponse.json({
      success: true,
      data: enhanced,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('[search] Error:', error);
    await logger.logError('api', 'Search failed', error, {
      action: 'search_error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

