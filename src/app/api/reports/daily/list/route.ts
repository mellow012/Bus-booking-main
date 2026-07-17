// src/app/api/reports/daily/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { logger } from '@/lib/logger';

/**
 * Fetches recent daily operational reports.
 * Replaces direct client-side Firestore queries.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get("companyId");
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // Ensure authorization (admin or matching company ID)
    if (user.role !== "admin" && user.companyId !== companyId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reports = await prisma.dailyReport.findMany({
      where: { companyId },
      orderBy: { date: "desc" },
      take: Math.min(limit, 50),
    });

    // Map to common frontend structure if needed
    const normalisedReports = reports.map((r: { reportData: any; }) => ({
      ...r,
      scheduleDetails: r.reportData, // Map Json back to expected field name
    }));

    return NextResponse.json({ success: true, reports: normalisedReports });

  } catch (error: any) {
    await logger.logError('company', 'Failed to fetch reports', error);
    return NextResponse.json(
      { error: "Failed to fetch reports: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

