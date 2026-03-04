// app/api/stripe/disconnect/route.ts
//
// Revokes the Stripe OAuth grant and clears the stored account ID.
// Called when the operator clicks "Disconnect Stripe" in settings.
//
// Required env vars:
//   STRIPE_SECRET_KEY  — your platform's Stripe secret key
//   STRIPE_CLIENT_ID   — your platform's Connect client_id (ca_...)

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil',
  // Enable telemetry for Stripe monitoring
  telemetry: true,
});

export async function POST(req: NextRequest) {
  try {
    const { companyId } = await req.json();
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    // Look up the stored account ID
    const companySnap = await adminDb.collection("companies").doc(companyId).get();
    if (!companySnap.exists) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const stripeAccountId = companySnap.data()?.paymentSettings?.stripeAccountId;

    // Revoke the OAuth grant on Stripe's side (best-effort — don't fail if missing)
    if (stripeAccountId && process.env.STRIPE_CLIENT_ID) {
      try {
        await stripe.oauth.deauthorize({
          client_id:       process.env.STRIPE_CLIENT_ID,
          stripe_user_id:  stripeAccountId,
        });
      } catch (revokeErr: any) {
        // Log but don't block — we still clear Firestore
        console.warn("[stripe/disconnect] OAuth revoke failed:", revokeErr.message);
      }
    }

    // Clear the Stripe fields from Firestore
    await adminDb.collection("companies").doc(companyId).update({
      "paymentSettings.stripeEnabled":            false,
      "paymentSettings.stripeAccountId":          null,
      "paymentSettings.stripeOnboardingComplete": false,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[stripe/disconnect]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}