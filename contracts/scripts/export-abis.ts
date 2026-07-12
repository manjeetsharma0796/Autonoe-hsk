import { artifacts } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

/** Export ABIs other tracks import (T-107) → packages/chain/abis/<Contract>.json */
const NAMES = [
  "MUSD",
  "WMNT",
  "AmmFactory",
  "AmmPair",
  "AmmRouter",
  "DecisionLog",
  "PriceOracle",
  "SyntheticExchange",
];

async function main() {
  const dir = resolve(__dirname, "../../packages/chain/abis");
  mkdirSync(dir, { recursive: true });
  for (const n of NAMES) {
    const art = await artifacts.readArtifact(n);
    writeFileSync(resolve(dir, `${n}.json`), JSON.stringify(art.abi, null, 2) + "\n");
    console.log(`wrote abis/${n}.json`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
