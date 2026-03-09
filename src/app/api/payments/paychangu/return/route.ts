// app/api/payments/paychangu/return/route.ts
//
// PayChangu POSTs to this endpoint after payment instead of doing a plain
// browser redirect. We accept the POST, extract the params, then issue a
// 302 redirect to the bookings page so the user's browser follows normally.
//
// Update your PayChangu charge route's returnUrl to:
//   ${NEXT_PUBLIC_APP_URL}/api/payments/paychangu/return

import { NextRequest, NextResponse } from "next/server";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

function buildRedirect(params: Record<string, string>) {
  const qs = new URLSearchParams({
    payment_verify: "true",
    provider:       "paychangu",
    ...params,
  });
  return NextResponse.redirect(`${APP_URL}/bookings?${qs.toString()}`, 302);
}

// Gateway POSTs here after payment
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let params: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      const body = await req.json();
      params = Object.fromEntries(
        Object.entries(body).map(([k, v]) => [k, String(v ?? "")])
      );
    } else {
      // application/x-www-form-urlencoded
      const text = await req.text();
      new URLSearchParams(text).forEach((v, k) => { params[k] = v; });
    }

    // Normalise key names — PayChangu may use tx_ref or reference
    const txRef = params.tx_ref ?? params.reference ?? params.bookingId ?? "";
    const status = params.status ?? params.payment_status ?? "";

    return buildRedirect({ tx_ref: txRef, status });
  } catch {
    return buildRedirect({ status: "error" });
  }
}

// Also handle GET in case the gateway switches to a redirect in future
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txRef  = searchParams.get("tx_ref")  ?? searchParams.get("reference") ?? "";
  const status = searchParams.get("status")  ?? "";
  return buildRedirect({ tx_ref: txRef, status });
}