import { test, expect } from 'bun:test';
import { MANTLE_SEPOLIA_CHAIN_ID, mantleSepolia, txUrl, addressUrl, EXPLORER_URL } from './index.js';

test('chain id is Mantle Sepolia 5003', () => {
  expect(MANTLE_SEPOLIA_CHAIN_ID).toBe(5003);
  expect(mantleSepolia.id).toBe(5003);
  expect(mantleSepolia.nativeCurrency.symbol).toBe('MNT');
});

test('explorer link helpers build mantlescan urls', () => {
  expect(txUrl('0xabc')).toBe(`${EXPLORER_URL}/tx/0xabc`);
  expect(addressUrl('0xdef')).toBe(`${EXPLORER_URL}/address/0xdef`);
});
