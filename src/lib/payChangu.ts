import crypto from 'crypto';

export function verifySignature(signature: string, payload: object, secret: string): boolean {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const computedBuffer = Buffer.from(computedSignature, 'hex');

  if (sigBuffer.length !== computedBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, computedBuffer);
}