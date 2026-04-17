import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { apiRateLimiter, getClientIp } from '@/lib/rateLimiter';
import { z } from 'zod';

// ─── Validation schemas ──────────────────────────────────────────────────────

const companySchema = z.object({
  name:    z.string().min(1).max(100).trim(),
  email:   z.string().email().trim(),
  phone:   z.string().max(20).trim().optional(),
  address: z.string().max(200).trim().optional(),
});

const busSchema = z.object({
  licensePlate: z.string().min(1).max(20).trim(),
  busType:      z.string().min(1).max(50).trim(),
  capacity:     z.number().int().min(1).max(200),
});

const routeSchema = z.object({
  origin:      z.string().min(1).max(100).trim(),
  destination: z.string().min(1).max(100).trim(),
  price:       z.number().min(0),
});

const scheduleSchema = z.object({
  routeId:           z.string().min(1),
  busId:             z.string().min(1),
  departureDateTime: z.string().datetime(),
  arrivalDateTime:   z.string().datetime(),
  availableSeats:    z.number().int().min(0),
  price:             z.number().min(0),
});

const onboardingSchema = z.object({
  company:   companySchema,
  buses:     z.array(busSchema).min(1).max(50),
  routes:    z.array(routeSchema).min(1).max(100),
  schedules: z.array(scheduleSchema).min(1).max(500),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {

  // ─── Rate limiting ──────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  const rateLimitResult = await apiRateLimiter.limit(ip);

  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
    console.warn(`[RATE LIMIT] Too many onboarding requests from ${ip}`);
    return NextResponse.json(
      { error: 'Too many requests', message: `Please try again in ${retryAfter} seconds.` },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // ─── Authorization ──────────────────────────────────────────────────────────
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'company_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ─── Parse & validate body ──────────────────────────────────────────────────
  let parsed: z.infer<typeof onboardingSchema>;
  try {
    const body = await req.json();
    parsed = onboardingSchema.parse(body);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', issues: error.issues.map(i => `${i.path.join('.')}: ${i.message}`) },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Malformed request body' }, { status: 400 });
  }

  const { company, buses, routes, schedules } = parsed;

  // ─── Write to PostgreSQL using Prisma transaction ──────────────────────────
  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdCompany = await tx.company.create({
        data: {
          name: company.name,
          email: company.email,
          phone: company.phone || '',
          address: company.address || '',
          status: 'active',
          setupCompleted: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          maxBuses: Math.max(buses.length, 10),
        },
      });

      // Create all buses for this company
      await Promise.all(
        buses.map(bus =>
          tx.bus.create({
            data: {
              licensePlate: bus.licensePlate,
              busType: bus.busType,
              capacity: bus.capacity,
              companyId: createdCompany.id,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
        )
      );

      // Create all routes for this company
      await Promise.all(
        routes.map(route =>
          tx.route.create({
            data: {
              name: `${route.origin} - ${route.destination}`,
              origin: route.origin,
              destination: route.destination,
              distance: 0,
              duration: 0,
              baseFare: route.price,
              companyId: createdCompany.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
        )
      );

      // Create all schedules for this company
      await Promise.all(
        schedules.map(schedule =>
          tx.schedule.create({
            data: {
              routeId: schedule.routeId,
              busId: schedule.busId,
              departureDateTime: new Date(schedule.departureDateTime),
              arrivalDateTime: new Date(schedule.arrivalDateTime),
              availableSeats: schedule.availableSeats,
              price: schedule.price,
              companyId: createdCompany.id,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          })
        )
      );

      return createdCompany;
    });

    return NextResponse.json({ companyId: result.id }, { status: 201 });

  } catch (error: any) {
    console.error('[ONBOARDING] Batch commit failed:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding data', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function PUT()    { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
export async function DELETE() { return NextResponse.json({ error: 'Method not allowed' }, { status: 405 }); }
