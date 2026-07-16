// src/app/api/auth/complete-setup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

/**
 * Marks a user's setup as completed.
 * Replaces direct client-side Firestore 'updateDoc' on the 'users' collection.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { companyId } = await req.json();

    // Verify the user belongs to the company they just set up
    if (user.role !== "superadmin" && user.companyId !== companyId) {
       return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        setupCompleted: true,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });

  } catch (error: any) {
    console.error("[api/auth/complete-setup] Error:", error);
    return NextResponse.json(
      { error: "Failed to complete setup: " + (error.message || "Unknown error") },
      { status: 500 }
    );
  }
}

