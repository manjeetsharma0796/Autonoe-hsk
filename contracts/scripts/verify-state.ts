import { ethers } from "hardhat";
import addrs from "../../packages/chain/addresses.json";

/** Read live on-chain state to confirm the deploy + seed worked. */
async function main() {
  const pair = await ethers.getContractAt("AmmPair", addrs.pools.mUSD_WHSK);
  const [r0, r1] = await pair.getReserves();
  const t0 = await pair.token0();

  const ex = await ethers.getContractAt("SyntheticExchange", addrs.syntheticExchange);
  const reserve = await ex.reserve();

  const oracle = await ethers.getContractAt("PriceOracle", addrs.oracle);
  const signer = await oracle.trustedSigner();

  const musdIsT0 = t0.toLowerCase() === addrs.mUSD.toLowerCase();
  const musdReserve = musdIsT0 ? r0 : r1;
  const whskReserve = musdIsT0 ? r1 : r0;

  console.log(`pool mUSD/WHSK  : ${ethers.formatUnits(musdReserve, 6)} mUSD  /  ${ethers.formatEther(whskReserve)} WHSK`);
  console.log(`house reserve   : ${ethers.formatUnits(reserve, 6)} mUSD`);
  console.log(`oracle signer   : ${signer}`);
  for (const m of addrs.syntheticMarkets) {
    console.log(`market ${m.padEnd(4)}     : ${await ex.isMarket(m)}`);
  }

  const bal = await ethers.provider.getBalance((await ethers.getSigners())[0].address);
  console.log(`deployer balance: ${ethers.formatEther(bal)} HSK (after deploy)`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
