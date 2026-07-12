import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

// Shared root env (provider keys, RPC, deployer/oracle keys). .env.local overrides .env.
dotenv.config({ path: "../.env" });
dotenv.config({ path: "../.env.local", override: true });

const RPC = process.env.HASHKEY_TESTNET_RPC || "https://testnet.hsk.xyz";
// Accept keys with or without the 0x prefix.
const norm = (k?: string) => (k ? (k.startsWith("0x") ? k : `0x${k}`) : undefined);
const DEPLOYER = norm(process.env.DEPLOYER_PRIVATE_KEY);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {},
    hashkeyTestnet: {
      url: RPC,
      chainId: 133,
      accounts: DEPLOYER ? [DEPLOYER] : [],
    },
  },
  sourcify: {
    enabled: true,
  },
  etherscan: {
    apiKey: {
      hashkeyTestnet: "placeholder",
    },
    customChains: [
      {
        network: "hashkeyTestnet",
        chainId: 133,
        urls: {
          apiURL: "https://testnet-explorer.hsk.xyz/api",
          browserURL: "https://testnet-explorer.hsk.xyz",
        },
      },
    ],
  },
};

export default config;
