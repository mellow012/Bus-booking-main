export function verifySignature(signature, payload, secret) {
  const crypto = require('crypto');
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === computedSignature; // Compare with header signature
}