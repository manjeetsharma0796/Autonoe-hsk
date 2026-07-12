import { describe, expect, test } from 'bun:test';
import {
  createAgentWallet,
  isCreated,
  memoryStore,
  unlock,
} from '../src/wallet.ts';
import { exportKeystoreJSON, exportPrivateKey } from '../src/export.ts';

describe('agent wallet', () => {
  test('isCreated is false before creation, true after', async () => {
    const store = memoryStore();
    expect(await isCreated(store)).toBe(false);
    await createAgentWallet('correct horse battery staple', store);
    expect(await isCreated(store)).toBe(true);
  });

  test('create -> unlock round-trips to the same address', async () => {
    const store = memoryStore();
    const { address } = await createAgentWallet('s3cret-pass', store);
    const unlocked = await unlock('s3cret-pass', store);
    expect(unlocked.address).toBe(address);
    expect(unlocked.privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  test('wrong passphrase rejects', async () => {
    const store = memoryStore();
    await createAgentWallet('right-pass', store);
    await expect(unlock('wrong-pass', store)).rejects.toThrow('Invalid passphrase');
  });

  test('unlock before creation throws', async () => {
    const store = memoryStore();
    await expect(unlock('whatever', store)).rejects.toThrow();
  });

  test('cannot create twice', async () => {
    const store = memoryStore();
    await createAgentWallet('p', store);
    await expect(createAgentWallet('p', store)).rejects.toThrow();
  });

  test('exportPrivateKey returns a 0x key matching unlock', async () => {
    const store = memoryStore();
    await createAgentWallet('pw', store);
    const pk = await exportPrivateKey('pw', store);
    expect(pk).toMatch(/^0x[0-9a-fA-F]{64}$/);
    const unlocked = await unlock('pw', store);
    expect(pk).toBe(unlocked.privateKey);
  });

  test('exportKeystoreJSON returns the encrypted keystore', async () => {
    const store = memoryStore();
    const { address } = await createAgentWallet('pw', store);
    const json = await exportKeystoreJSON(store);
    const ks = JSON.parse(json);
    expect(ks.address).toBe(address);
    expect(typeof ks.salt).toBe('string');
    expect(typeof ks.iv).toBe('string');
    expect(typeof ks.ciphertext).toBe('string');
    // Plaintext private key must NOT be present in the keystore.
    expect(json).not.toContain('privateKey');
  });
});
