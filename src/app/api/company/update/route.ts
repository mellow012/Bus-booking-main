// src/app/api/company/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/**
 * Handles company profile and settings updates.
 * Replaces direct client-side Firestore 'updateDoc' calls.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Only superadmin or company_admin can update company settings
    if (user.role !== "superadmin" && user.role !== "company_admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { companyId, updates } = await req.json();

    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // Security check: Ensure company_admin can only update their own company
    if (user.role === "company_admin" && user.companyId !== companyId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch existing company to merge fields if necessary
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Merge paymentSettings if provided as partial
    let finalPaymentSettings = company.paymentSettings;
    if (updates.paymentSettings) {
      const existingSettings = (company.paymentSettings as Record<string, any>) || {};
      finalPaymentSettings = {
        ...existingSettings,
        ...(updates.paymentSettings as Record<string, any>),
      };
    }

    // Merge notificationSettings if provided as partial
    let finalNotificationSettings = company.notificationSettings;
    if (updates.notificationSettings) {
      const existingSettings = (company.notificationSettings as Record<string, any>) || {};
      finalNotificationSettings = {
        ...existingSettings,
        ...(updates.notificationSettings as Record<string, any>),
      };
    }

    // Merge contactSettings if provided as partial
    let finalContactSettings = company.contactSettings;
    if (updates.contactSettings) {
      const existingSettings = (company.contactSettings as Record<string, any>) || {};
      finalContactSettings = {
        ...existingSettings,
        ...(updates.contactSettings as Record<string, any>),
      };
    }

    const result = await prisma.company.update({
      where: { id: companyId },
      data: {
        name:                 updates.name                 ?? undefined,
        logo:                 updates.logo                 ?? undefined,
        description:          updates.description          ?? undefined,
        phone:                updates.phone                ?? undefined,
        address:              updates.address              ?? undefined,
        branches:             updates.branches             ?? undefined,
        operatingHours:       updates.operatingHours       ?? undefined,
        paymentSettings:      finalPaymentSettings         ?? undefined,
        notificationSettings: finalNotificationSettings      ?? undefined,
        contactSettings:      finalContactSettings         ?? undefined,
        status:               updates.status               ?? undefined,
        updatedAt:            new Date(),
      },
    });

    return NextResponse.json({ success: true, company: result });

  } catch (error: any) {
    console.error("[api/company/update] Error:", error);
    return NextResponse.json(
      { error: "Failed to update company: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

