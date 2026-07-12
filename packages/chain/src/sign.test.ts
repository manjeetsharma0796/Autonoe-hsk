import { test, expect } from 'bun:test';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress, keccak256, encodeAbiParameters } from 'viem';
import { signPriceAttestation, priceToX18 } from './syntheticExecutor.js';
import { accountFromKey } from './clients.js';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const ORACLE = '0xa8647941eb5b1F29d06428eBC81bCD3bE2C99e45' as const;

test('priceToX18 scales by 1e18', () => {
  expect(priceToX18(100_000)).toBe(100_000n * 10n ** 18n);
  expect(priceToX18('1.5')).toBe(1_500_000_000_000_000_000n);
});

test('accountFromKey accepts keys with or without 0x', () => {
  const a = accountFromKey(KEY);
  const b = accountFromKey(KEY.slice(2));
  expect(a.address).toBe(b.address);
});

test('signed attestation recovers to the signer (matches PriceOracle digest)', async () => {
  const account = privateKeyToAccount(KEY);
  const symbol = 'BTC';
  const priceX18 = priceToX18(100_000);
  const timestamp = 1_780_000_000;
  const att = await signPriceAttestation(account, { symbol, priceX18, timestamp, oracle: ORACLE, chainId: 5003 });

  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'string' }, { type: 'uint256' }, { type: 'uint256' }],
      [5003n, ORACLE, symbol, priceX18, BigInt(timestamp)]
    )
  );
  const recovered = await recoverMessageAddress({ message: { raw: inner }, signature: att.signature });
  expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
});
