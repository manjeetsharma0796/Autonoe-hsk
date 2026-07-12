import { test, expect } from 'bun:test';

process.env.AUTONOE_DB = ':memory:';
process.env.AUTONOE_SECRET = 'test-secret';

const { encrypt, decrypt } = await import('../src/crypto.ts');
const { listProviders } = await import('../src/providers.ts');
const { defaultRoles, resolveRole } = await import('../src/roles.ts');
const { AI_ROLES } = await import('@autonoe/shared');

test('crypto round-trips and ciphertext is not plaintext', () => {
  const secret = 'sk-super-secret-key';
  const enc = encrypt(secret);
  expect(enc).not.toContain(secret);
  expect(decrypt(enc)).toBe(secret);
});

test('provider registry lists all five with no keys set', () => {
  const list = listProviders();
  expect(list.map((p) => p.id).sort()).toEqual(['gemini', 'groq', 'mistral', 'nvidia', 'openrouter']);
  expect(list.every((p) => p.hasKey === false)).toBe(true);
  expect(list.every((p) => p.keysUrl.startsWith('http'))).toBe(true);
});

test('default roles cover every AI role', () => {
  const roles = defaultRoles();
  for (const r of AI_ROLES) expect(roles[r]).toBeDefined();
  expect(resolveRole('judge').provider).toBe('groq');
});
