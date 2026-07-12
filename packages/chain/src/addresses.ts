// Typed accessor for the deployed-address manifest (written by contracts/T-107).
// Never hard-code addresses elsewhere — import from here.
import raw from '../addresses.json';

export interface AutonoeAddresses {
  chainId: number;
  mUSD: `0x${string}`;
  WMNT: `0x${string}`;
  factory: `0x${string}`;
  router: `0x${string}`;
  decisionLog: `0x${string}`;
  oracle: `0x${string}`;
  syntheticExchange: `0x${string}`;
  oracleSigner?: `0x${string}`;
  pools: { mUSD_WMNT: `0x${string}` };
  syntheticMarkets: string[];
}

export const addresses = raw as unknown as AutonoeAddresses;

/** True once real (non-zero) addresses have been deployed + exported. */
export function isDeployed(): boolean {
  return /^0x0{40}$/.test(addresses.mUSD) === false;
}
