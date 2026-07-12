import { ethers, network } from "hardhat";
import { writeFileSync } from "fs";
import { resolve } from "path";

/**
 * Deploy + seed the full Autonoe on-chain layer:
 *   - tokens: mUSD, WHSK (Wrapped HSK on-chain)
 *   - real AMM: AmmFactory + AmmRouter, seeded mUSD/WHSK pool
 *   - synthetic leg: PriceOracle (signed-pull) + SyntheticExchange (house reserve)
 *   - benchmark: DecisionLog
 * Then writes live addresses to packages/chain/addresses.json.
 *
 * Seed sizes are env-overridable so faucet HSK suffices.
 */
const SEED_WHSK = ethers.parseEther(process.env.SEED_WHSK || "2");
const SEED_MUSD = BigInt(process.env.SEED_MUSD_BASEUNITS || (2_000 * 1e6).toString());
const HOUSE_RESERVE = BigInt(process.env.HOUSE_RESERVE_BASEUNITS || (100_000 * 1e6).toString());
const MARKETS = (process.env.SYNTH_MARKETS || "BTC,ETH,SUI,SOL")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}  network: ${network.name}`);

  const signerKey = process.env.ORACLE_SIGNER_PRIVATE_KEY;
  const oracleSigner = signerKey ? new ethers.Wallet(signerKey).address : deployer.address;
  if (!signerKey) {
    console.warn("ORACLE_SIGNER_PRIVATE_KEY not set — using deployer as oracle signer (dev only).");
  }

  const musd = await (await ethers.getContractFactory("MUSD")).deploy();
  const whsk = await (await ethers.getContractFactory("WHSK")).deploy();
  const factory = await (await ethers.getContractFactory("AmmFactory")).deploy();
  const router = await (await ethers.getContractFactory("AmmRouter")).deploy(await factory.getAddress());
  const decisionLog = await (await ethers.getContractFactory("DecisionLog")).deploy();
  const oracle = await (await ethers.getContractFactory("PriceOracle")).deploy(oracleSigner);
  const exchange = await (
    await ethers.getContractFactory("SyntheticExchange")
  ).deploy(await musd.getAddress(), await oracle.getAddress());

  for (const c of [musd, whsk, factory, router, decisionLog, oracle, exchange]) {
    await c.waitForDeployment();
  }

  const musdAddr = await musd.getAddress();
  const whskAddr = await whsk.getAddress();
  const routerAddr = await router.getAddress();

  await (await musd.ownerMint(deployer.address, SEED_MUSD + HOUSE_RESERVE)).wait();
  await (await whsk.deposit({ value: SEED_WHSK })).wait();
  await (await musd.approve(routerAddr, SEED_MUSD)).wait();
  await (await whsk.approve(routerAddr, SEED_WHSK)).wait();
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  await (
    await router.addLiquidity(musdAddr, whskAddr, SEED_MUSD, SEED_WHSK, 0, 0, deployer.address, deadline)
  ).wait();
  const pair = await factory.getPair(musdAddr, whskAddr);

  await (await musd.approve(await exchange.getAddress(), HOUSE_RESERVE)).wait();
  await (await exchange.fundReserve(HOUSE_RESERVE)).wait();

  for (const m of MARKETS) await (await exchange.registerMarket(m)).wait();

  const out = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    mUSD: musdAddr,
    WHSK: whskAddr,
    factory: await factory.getAddress(),
    router: routerAddr,
    decisionLog: await decisionLog.getAddress(),
    oracle: await oracle.getAddress(),
    syntheticExchange: await exchange.getAddress(),
    oracleSigner,
    pools: { mUSD_WHSK: pair },
    syntheticMarkets: MARKETS,
  };

  console.log("\nDeployed addresses:\n" + JSON.stringify(out, null, 2));

  const dest = resolve(__dirname, "../../packages/chain/addresses.json");
  writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
