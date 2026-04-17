// lib/crypto.server.ts
//
// FIX F-20: This is the CANONICAL AES-256-GCM encryption module.
// Encrypt-secret.ts (which used a separate PAYCHANGU_ENCRYPTION_KEY and a
// hex-colon wire format) has been DELETED. All encryption now goes through
// this file using MASTER_ENCRYPTION_KEY and a base64 wire format.
//
// ── ONE-TIME MIGRATION REQUIRED ──────────────────────────────────────────────
// Any data previously encrypted with Encrypt-secret.ts (hex-colon format,
// PAYCHANGU_ENCRYPTION_KEY) must be re-encrypted with this module before
// Encrypt-secret.ts is deleted. Run the migration script once:
//
//   import { decryptLegacy } from '@/lib/crypto.server';
//   import { encryptSecret }  from '@/lib/crypto.server';
//
//   const plaintext  = decryptLegacy(oldEncryptedValue, process.env.PAYCHANGU_ENCRYPTION_KEY!);
//   const newValue   = await encryptSecret(plaintext);
//   // Write newValue back to Firestore
//
// After migration, remove decryptLegacy() and delete Encrypt-secret.ts.
// ─────────────────────────────────────────────────────────────────────────────
//
// Required env var:
//   MASTER_ENCRYPTION_KEY — 64-char hex string (32 bytes)
//
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import 'server-only'; // Prevents this module from being bundled client-side
import crypto from 'crypto';

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 12; // 96-bit — recommended for GCM
const TAG_LENGTH = 16;

// ─── Key helpers ──────────────────────────────────────────────────────────────

function getMasterKey(): Buffer {
  const keyHex = process.env.MASTER_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'MASTER_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

// ─── Encrypt / Decrypt (canonical — base64 wire format) ──────────────────────

/**
 * Encrypts a plaintext string.
 * Wire format: base64( iv[12] + authTag[16] + ciphertext )
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key    = getMasterKey();
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypts a value previously produced by encryptSecret().
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export async function decryptSecret(encryptedBase64: string): Promise<string> {
  const key  = getMasterKey();
  const data = Buffer.from(encryptedBase64, 'base64');

  const iv        = data.subarray(0, IV_LENGTH);
  const authTag   = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// ─── Legacy migration helper (DELETE after migration is complete) ─────────────

/**
 * Decrypts a value encrypted by the OLD Encrypt-secret.ts module.
 * Wire format: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Use this ONLY in your one-time migration script, then delete it.
 */
export function decryptLegacy(encrypted: string, legacyKeyHex: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid legacy encrypted format — expected "<iv>:<authTag>:<ciphertext>"');
  }
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key        = Buffer.from(legacyKeyHex, 'hex');
  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}