// src/app/api/reports/daily/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Handles persistence of daily operational reports.
 * Replaces direct client-side Firestore 'addDoc' calls.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const platformRoles = ["super_admin", "superadmin"];
    if (!platformRoles.includes(user.role ?? "") && user.role !== "company_admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const reportData = await req.json();

    const {
      date,
      totalSchedules,
      completedSchedules,
      totalBookings,
      paidBookings,
      boardedPassengers,
      noShowPassengers,
      totalRevenue,
      avgOccupancyRate,
      scheduleDetails,
    } = reportData;

    const companyId = user.role === "company_admin" ? user.companyId : reportData.companyId;
    if (!companyId || !date) {
      return NextResponse.json({ error: "companyId and date are required" }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "date must be a valid date" }, { status: 400 });
    }

    const numericFields = {
      totalSchedules,
      completedSchedules,
      totalBookings,
      paidBookings,
      boardedPassengers,
      noShowPassengers,
      totalRevenue,
      avgOccupancyRate,
    };
    if (Object.values(numericFields).some((value) => value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0))) {
      return NextResponse.json({ error: "Report metrics must be non-negative numbers" }, { status: 400 });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const result = await prisma.dailyReport.create({
      data: {
        date:                parsedDate,
        companyId,
        createdBy:           user.id,
        createdByName:       `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        totalSchedules:      totalSchedules     || 0,
        completedSchedules:  completedSchedules || 0,
        totalBookings:       totalBookings      || 0,
        paidBookings:        paidBookings       || 0,
        boardedPassengers:   boardedPassengers  || 0,
        noShowPassengers:    noShowPassengers   || 0,
        totalRevenue:        totalRevenue       || 0,
        avgOccupancyRate:    avgOccupancyRate   || 0,
        reportData:          scheduleDetails    || [],
      },
    });

    return NextResponse.json({ success: true, report: result });

  } catch (error: any) {
    await logger.logError('company', 'Failed to persist report', error);
    return NextResponse.json(
      { error: "Failed to persist report: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

