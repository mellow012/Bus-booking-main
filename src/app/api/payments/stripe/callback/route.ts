// app/api/stripe/callback/route.ts
//
// Step 2 of Stripe OAuth Connect.
// Stripe redirects here after the user approves the connection.
// We exchange the `code` for an access token + acct_xxx ID,
// save ONLY the acct_xxx ID to Firestore, then redirect the user
// back to the settings page.
//
// Required env vars:
//   STRIPE_SECRET_KEY   — your platform's Stripe secret key
//   FIREBASE_ADMIN_*    — Firebase Admin SDK credentials (for server-side Firestore write)
//   NEXT_PUBLIC_APP_URL — your app base URL

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebaseAdmin"; // your Firebase Admin Firestore instance

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
    // Enable telemetry for Stripe monitoring
    telemetry: true,
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code      = searchParams.get("code");
  const companyId = searchParams.get("state"); // we passed companyId as `state`
  const error     = searchParams.get("error");

  // ── Handle the user denying the connection ──────────────────────────────────
  if (error) {
    const reason = searchParams.get("error_description") || error;
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=settings&stripe_error=${encodeURIComponent(reason)}`
    );
  }

  if (!code || !companyId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=settings&stripe_error=missing_params`
    );
  }

  try {
    // ── Exchange the authorisation code for the connected account ID ──────────
    // This is a server-to-server call — the secret key never leaves the server.
    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    const connectedAccountId = response.stripe_user_id; // e.g. "acct_1ABC..."

    if (!connectedAccountId) {
      throw new Error("Stripe did not return an account ID");
    }

    // ── Check whether onboarding is complete ──────────────────────────────────
    const account = await stripe.accounts.retrieve(connectedAccountId);
    const onboardingComplete =
      account.details_submitted &&
      account.charges_enabled  &&
      account.payouts_enabled;

    // ── Save ONLY the account ID to Firestore — NO secret key ─────────────────
    await adminDb.collection("companies").doc(companyId).update({
      "paymentSettings.stripeEnabled":            true,
      "paymentSettings.stripeAccountId":          connectedAccountId,
      "paymentSettings.stripeOnboardingComplete": onboardingComplete,
    });

    // ── Redirect back to settings with a success flag ─────────────────────────
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=settings&stripe_success=1`
    );
  } catch (err: any) {
    console.error("[stripe/callback]", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?tab=settings&stripe_error=${encodeURIComponent(err.message)}`
    );
  }
}