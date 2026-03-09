// lib/flw-auth.ts
export const FLW_AUTH_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

export async function getFlwAccessToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.FLW_CLIENT_ID!,
    client_secret: process.env.FLW_CLIENT_SECRET!,
  });

  const res = await fetch(FLW_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Authentication failed");
  return data.access_token;
}

export const FLW_BASE = process.env.FLW_ENV === "production"
  ? "https://api.flutterwave.com/v4"
  : "https://developersandbox-api.flutterwave.com";