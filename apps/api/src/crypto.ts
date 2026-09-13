import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env, isProduction } from './env.js';

/**
 * Field-level encryption for the national ID number.
 *
 * Thailand's PDPA treats an ID card number as sensitive personal data, so
 * it does not sit in the database in the clear. Everything else on the
 * form is stored as given.
 *
 * Format: v1.<iv>.<authTag>.<ciphertext>, all base64url. The version
 * prefix is there so a future key rotation can tell old rows apart.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const PREFIX = 'v1';

let warned = false;

function key(): Buffer | null {
  if (!env.APP_ENCRYPTION_KEY) return null;
  const raw = Buffer.from(env.APP_ENCRYPTION_KEY, 'base64');
  if (raw.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must decode to 32 bytes — use `openssl rand -base64 32`');
  }
  return raw;
}

function warnOnce(): void {
  if (warned || isProduction) return;
  warned = true;
  console.warn(
    '[zego] APP_ENCRYPTION_KEY is not set — ID numbers are being stored in the clear. ' +
      'Fine for local work, refused at boot in production.',
  );
}

export function encryptSensitive(plain: string): string {
  if (!plain) return '';
  const k = key();
  if (!k) {
    warnOnce();
    return plain;
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, k, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(
    '.',
  );
}

export function decryptSensitive(stored: string): string {
  if (!stored) return '';

  const parts = stored.split('.');
  // Anything that is not our envelope was written before a key existed.
  if (parts.length !== 4 || parts[0] !== PREFIX) return stored;

  const k = key();
  if (!k) throw new Error('APP_ENCRYPTION_KEY is missing but encrypted rows exist');

  const [, ivPart, tagPart, dataPart] = parts as [string, string, string, string];
  const decipher = createDecipheriv(ALGORITHM, k, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** All that should ever reach a list view: the last four digits. */
export function maskIdCard(plain: string): string {
  const digits = plain.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `•••••••••${digits.slice(-4)}`;
}
