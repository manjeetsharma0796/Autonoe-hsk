import { test, expect } from 'bun:test';
import { privateKeyToAccount } from 'viem/accounts';
import { recoverMessageAddress, keccak256, encodeAbiParameters, parseUnits } from 'viem';
import addresses from '@autonoe/chain/addresses.json';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
process.env.ORACLE_SIGNER_PRIVATE_KEY = KEY;

import { signPrice, oracleSignerAddress, getSpotPriceUsd } from '../src/oracle.ts';

const fakeFetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({ result: { list: [{ lastPrice: '100000' }] } }),
});

test('oracleSignerAddress matches the configured key', () => {
  expect(oracleSignerAddress().toLowerCase()).toBe(privateKeyToAccount(KEY).address.toLowerCase());
});

test('getSpotPriceUsd parses the Bybit ticker', async () => {
  expect(await getSpotPriceUsd('BTC', fakeFetch)).toBe(100_000);
});

test('signPrice returns a recoverable attestation matching the on-chain oracle digest', async () => {
  const signed = await signPrice('BTC', fakeFetch);
  expect(signed.priceX18).toBe(parseUnits('100000', 18).toString());

  const inner = keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'string' }, { type: 'uint256' }, { type: 'uint256' }],
      [BigInt(addresses.chainId), addresses.oracle as `0x${string}`, 'BTC', BigInt(signed.priceX18), BigInt(signed.timestamp)]
    )
  );
  const recovered = await recoverMessageAddress({ message: { raw: inner }, signature: signed.signature });
  expect(recovered.toLowerCase()).toBe(signed.signer.toLowerCase());
  expect(recovered.toLowerCase()).toBe(privateKeyToAccount(KEY).address.toLowerCase());
});
