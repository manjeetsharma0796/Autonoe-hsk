import { ethers } from "hardhat";

/**
 * Produce a server-style signed price attestation matching PriceOracle.priceDigest:
 * keccak256(abi.encode(chainId, oracle, symbol, priceX18, timestamp)) then EIP-191.
 * The same logic the backend's /api/price/sign (T-210) will use.
 */
export async function signPrice(
  signer: { signMessage: (m: Uint8Array) => Promise<string> },
  oracleAddr: string,
  chainId: bigint,
  symbol: string,
  priceX18: bigint,
  timestamp: number
): Promise<string> {
  const inner = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "string", "uint256", "uint256"],
      [chainId, oracleAddr, symbol, priceX18, timestamp]
    )
  );
  return signer.signMessage(ethers.getBytes(inner));
}
