import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Shared root env (provider keys, RPC, deployer/oracle keys). .env.local overrides .env.
dotenv.config({ path: "../.env" });
dotenv.config({ path: "../.env.local", override: true });

const RPC = process.env.MANTLE_SEPOLIA_RPC || "https://rpc.sepolia.mantle.xyz";
// Accept keys with or without the 0x prefix.
const norm = (k?: string) => (k ? (k.startsWith("0x") ? k : `0x${k}`) : undefined);
const DEPLOYER = norm(process.env.DEPLOYER_PRIVATE_KEY);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // IR pipeline avoids "stack too deep" in the Router's addLiquidity.
      viaIR: true,
      // Mantle is an L2 — pin to paris (no PUSH0/cancun opcodes) for deploy safety.
      evmVersion: "paris",
    },
  },
  networks: {
    // Local in-process network for tests.
    hardhat: {},
    // Mantle Sepolia (chain 5003) — PRD §9. Accounts only present if a key is set.
    mantleSepolia: {
      url: RPC,
      chainId: 5003,
      accounts: DEPLOYER ? [DEPLOYER] : [],
    },
  },
  // Keyless source verification via Sourcify. (Mantlescan's Etherscan-style
  // verify now needs a paid V2 API key; Sourcify covers chain 5003 for free.)
  sourcify: {
    enabled: true,
  },
};

export default config;
