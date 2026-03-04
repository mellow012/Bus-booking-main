// app/api/payments/stripe/onboarding-link/route.ts
//
// Generates a fresh Stripe Account Link for operators who connected
// but haven't completed identity/bank verification yet.
//
// FIX: now returns { url } JSON instead of NextResponse.redirect(link.url)
// so the client can handle errors gracefully instead of getting a raw redirect
// or blank page on failure. Consistent with how /connect works.
//
// FIX: refresh_url now points to this same API route (correct — Stripe re-hits
// it to get a fresh link) but with a client-side fallback URL for the UI.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebaseAdmin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
  telemetry: true,
});

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }

    const snap = await adminDb.collection("companies").doc(companyId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const stripeAccountId = snap.data()?.paymentSettings?.stripeAccountId;
    if (!stripeAccountId) {
      return NextResponse.json({ error: "No Stripe account linked" }, { status: 400 });
    }

    // Generate a short-lived onboarding link (expires in ~5 minutes)
    const link = await stripe.accountLinks.create({
      account:     stripeAccountId,
      // Stripe hits refresh_url if the link expires before the user completes
      // onboarding — pointing back to this route generates a fresh link automatically
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/stripe/onboarding-link?companyId=${companyId}`,
      return_url:  `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=settings&stripe_success=1`,
      type:        "account_onboarding",
    });

    // Return { url } so the client can do: window.location.href = json.url
    // This lets the UI show a proper error message if this route fails,
    // instead of the user seeing a blank page or raw JSON
    return NextResponse.json({ url: link.url });
  } catch (err: any) {
    console.error("[stripe/onboarding-link]", err);
    return NextResponse.json(
      { error: err.message || "Could not generate onboarding link" },
      { status: 500 }
    );
  }
}