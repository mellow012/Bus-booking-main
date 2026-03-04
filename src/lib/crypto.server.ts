// lib/crypto.server.ts  ← server-only file (Next.js will tree-shake it from client)
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const keyHex = process.env.MASTER_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) { // 32 bytes = 64 hex chars
    throw new Error('Missing or invalid MASTER_ENCRYPTION_KEY in .env');
  }
  return Buffer.from(keyHex, 'hex');
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: iv (12) + tag (16) + encrypted → base64
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export async function decryptSecret(encryptedBase64: string): Promise<string> {
  const key = getMasterKey();
  const data = Buffer.from(encryptedBase64, 'base64');

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}