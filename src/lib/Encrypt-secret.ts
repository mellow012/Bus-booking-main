// lib/encryptSecret.ts
//
// AES-256-GCM encrypt / decrypt for storing PayChangu secret keys in Firestore.
// The encryption key NEVER touches the database — it lives only in env vars.
//
// Required env var:
//   PAYCHANGU_ENCRYPTION_KEY  — 64-char hex string (32 bytes)
//
// Generate one with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// Encrypted format stored in Firestore:
//   "<iv_hex>:<authTag_hex>:<ciphertext_hex>"

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const hex = process.env.PAYCHANGU_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'PAYCHANGU_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a plaintext secret key.
 * Returns a string safe to store in Firestore: "<iv>:<authTag>:<ciphertext>"
 */
export function encryptSecret(plaintext: string): string {
  const key    = getEncryptionKey();
  const iv     = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16-byte GCM authentication tag

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext.toString('hex'),
  ].join(':');
}

/**
 * Decrypts a value previously encrypted by encryptSecret().
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decryptSecret(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format — expected "<iv>:<authTag>:<ciphertext>"');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key      = getEncryptionKey();
  const iv       = Buffer.from(ivHex,        'hex');
  const authTag  = Buffer.from(authTagHex,   'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws if auth tag doesn't match (tamper detection)
  ]);

  return plaintext.toString('utf8');
}