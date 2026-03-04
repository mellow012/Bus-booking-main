// app/api/stripe/connect/route.ts
//
// Step 1 of Stripe OAuth Connect.
// The frontend fetches this route → we build the Stripe OAuth URL → return it.
// The frontend then does: window.location.href = data.url
//
// Required env vars:
//   STRIPE_SECRET_KEY          — your platform's Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_CLIENT_ID           — your platform's Connect client_id (ca_...)
//   NEXT_PUBLIC_APP_URL        — your app's base URL, e.g. https://yourapp.com

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function GET(req: NextRequest) {
  try {
    const companyId = req.nextUrl.searchParams.get("companyId");
    if (!companyId) {
      return NextResponse.json({ error: "companyId is required" }, { status: 400 });
    }

    if (!process.env.STRIPE_CLIENT_ID) {
      return NextResponse.json({ error: "STRIPE_CLIENT_ID env var not set" }, { status: 500 });
    }

    // Build the Stripe OAuth URL.
    // We pass companyId in the `state` param so the callback knows which
    // company to update after the user approves.
    const params = new URLSearchParams({
      response_type: "code",
      client_id:     process.env.STRIPE_CLIENT_ID,
      scope:         "read_write",
      // Stripe will redirect to this URL after the user approves
      redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/stripe/callback`,
      // state is echoed back in the callback — use it to identify the company
      state:         companyId,
      // Pre-fill some fields to make onboarding faster for the operator
      "stripe_user[business_type]": "company",
      "stripe_user[country]":       "MW",
    });

    const oauthUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

    return NextResponse.json({ url: oauthUrl });
  } catch (err: any) {
    console.error("[stripe/connect]", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}