import crypto from 'crypto';

export function verifySignature(signature: string, payload: object, secret: string): boolean {
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === computedSignature; // Compare with header signature
}