// src/app/api/reports/daily/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

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

    // Role check: Only superadmin or company_admin can generate reports
    if (user.role !== "superadmin" && user.role !== "company_admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const reportData = await req.json();

    const {
      date,
      companyId,
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

    if (!companyId || !date) {
      return NextResponse.json({ error: "companyId and date are required" }, { status: 400 });
    }

    // Security check: Ensure company_admin can only create reports for their own company
    if (user.role === "company_admin" && user.companyId !== companyId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const result = await prisma.dailyReport.create({
      data: {
        date:                new Date(date),
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
    console.error("[api/reports/daily/create] Error:", error);
    return NextResponse.json(
      { error: "Failed to persist report: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

