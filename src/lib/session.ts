const COOKIE_NAME = 'tb_session_meta';
const TTL_SECONDS = 60 * 10; // 10 minutes

type SessionMeta = {
  userId: string;
  role?: string | null;
  session_version?: number | null;
  expiresAt: string; // ISO
};

function isWebCryptoAvailable() {
  return typeof globalThis !== 'undefined' && typeof (globalThis as any).crypto !== 'undefined' && typeof (globalThis as any).crypto.subtle !== 'undefined';
}

async function getSigningKeyBytes(): Promise<Uint8Array> {
  const key = process.env.MASTER_ENCRYPTION_KEY || process.env.SESSION_SIGNING_KEY;
  if (!key) throw new Error('Session signing key missing (MASTER_ENCRYPTION_KEY)');
  if (/^[0-9a-fA-F]+$/.test(key) && key.length >= 32) {
    const len = key.length / 2;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(key.substr(i * 2, 2), 16);
    return out;
  }
  return new TextEncoder().encode(key);
}

function base64urlEncode(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64url');
  const str = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecodeToString(b64: string) {
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64url').toString('utf8');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const base64 = b64.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return atob(base64);
}

function base64urlDecodeToUint8Array(b64: string): Uint8Array {
  const str = base64urlDecodeToString(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256Base64Url(keyBytes: Uint8Array, data: string) {
  // Always use the Web Crypto API (available in Edge runtimes)
  const subtle = (globalThis as any).crypto.subtle;
  const cryptoKey = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return base64urlEncode(new Uint8Array(sig));
}

export async function createSessionCookieValue(meta: { userId: string; role?: string | null; session_version?: number | null; }) {
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  const payload: SessionMeta = { ...meta, expiresAt };
  const json = JSON.stringify(payload);
  const b64 = typeof Buffer !== 'undefined' ? Buffer.from(json).toString('base64url') : btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const keyBytes = await getSigningKeyBytes();
  const hmac = await hmacSha256Base64Url(keyBytes, b64);
  return `${b64}.${hmac}`;
}

export async function parseSessionCookieValue(value: string): Promise<SessionMeta | null> {
  try {
    const [b64, sig] = (value || '').split('.');
    if (!b64 || !sig) return null;
    const keyBytes = await getSigningKeyBytes();
    const expected = await hmacSha256Base64Url(keyBytes, b64);
    // Use constant‑time comparison compatible with Edge runtimes
    const a = base64urlDecodeToUint8Array(sig);
    const b = base64urlDecodeToUint8Array(expected);
    if (!constantTimeEqual(a, b)) return null;

    const json = base64urlDecodeToString(b64);
    const parsed = JSON.parse(json) as SessionMeta;
    if (!parsed.expiresAt || new Date(parsed.expiresAt) < new Date()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
