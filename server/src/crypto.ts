// AES-256-GCM at-rest encryption for provider keys. The encryption key derives
// from AUTONOE_SECRET (set one in prod); falls back to a dev-only constant so
// the server still boots locally. Never log decrypted values.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const secret = process.env.AUTONOE_SECRET ?? 'autonoe-dev-secret-change-me';
const key = createHash('sha256').update(secret).digest(); // 32 bytes

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('bad ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}
