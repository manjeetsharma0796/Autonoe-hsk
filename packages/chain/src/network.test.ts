import { test, expect } from 'bun:test';
import { HASHKEY_TESTNET_CHAIN_ID, hashkeyTestnet, txUrl, addressUrl, EXPLORER_URL } from './index.js';

test('chain id is HashKey Chain 133', () => {
  expect(HASHKEY_TESTNET_CHAIN_ID).toBe(133);
  expect(hashkeyTestnet.id).toBe(133);
  expect(hashkeyTestnet.nativeCurrency.symbol).toBe('HSK');
});

test('explorer link helpers build HashKey explorer urls', () => {
  expect(txUrl('0xabc')).toBe(`${EXPLORER_URL}/tx/0xabc`);
  expect(addressUrl('0xdef')).toBe(`${EXPLORER_URL}/address/0xdef`);
});
