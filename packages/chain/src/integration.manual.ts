/**
 * Manual integration check against LIVE HashKey Chain.
 * Runs a real mUSD/WMNT swap + a synthetic BTC open/close using the deployer key
 * (which is the oracle's trusted signer). Not a unit test — needs a funded key:
 *
 *   DEPLOYER_PRIVATE_KEY=... npx tsx src/integration.manual.ts
 */
import { parseUnits, formatUnits } from 'viem';
import { getPublicClient, getWalletClient, accountFromKey } from './clients.js';
import { addresses } from './addresses.js';
import { getQuote, swap } from './swapExecutor.js';
import { openSynthetic, closeSynthetic, signPriceAttestation, priceToX18 } from './syntheticExecutor.js';
import { writeContract, readContract, waitForTransactionReceipt } from 'viem/actions';
import { musdAbi } from './abis.js';
import { txUrl } from './network.js';

const M6 = (n: number) => parseUnits(n.toString(), 6);

async function main() {
  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error('set DEPLOYER_PRIVATE_KEY');
  const account = accountFromKey(key);
  const publicClient = getPublicClient();
  const walletClient = getWalletClient(account);
  console.log('actor:', account.address);

  // top up mUSD via faucet (10k)
  const bal0 = await readContract(publicClient, { address: addresses.mUSD, abi: musdAbi, functionName: 'balanceOf', args: [account.address] });
  if (bal0 < M6(2000)) {
    console.log('faucet() for mUSD…');
    const h = await writeContract(walletClient, { address: addresses.mUSD, abi: musdAbi, functionName: 'faucet', args: [] });
    await waitForTransactionReceipt(publicClient, { hash: h });
  }

  // ── 1) real AMM swap: 500 mUSD -> WMNT ──
  const amountIn = M6(500);
  const quote = await getQuote(publicClient, { tokenIn: addresses.mUSD, tokenOut: addresses.WMNT, amountIn });
  console.log(`quote: 500 mUSD -> ${formatUnits(quote, 18)} WMNT`);
  const res = await swap(walletClient, publicClient, { tokenIn: addresses.mUSD, tokenOut: addresses.WMNT, amountIn, slippageBps: 100 });
  console.log(`✔ swap out=${formatUnits(BigInt(res.amountOut), 18)} WMNT  ${res.explorerUrl}`);

  // ── 2) synthetic BTC long: open @100k, close @110k (+10%) ──
  const size = M6(1000);
  const now = Math.floor(Date.now() / 1000);
  const openAtt = await signPriceAttestation(account, { symbol: 'BTC', priceX18: priceToX18(100_000), timestamp: now });
  const opened = await openSynthetic(walletClient, publicClient, { isLong: true, sizeMUSD: size, attestation: openAtt });
  console.log(`✔ opened synthetic BTC long id=${opened.id}  ${opened.explorerUrl}`);

  const now2 = Math.floor(Date.now() / 1000);
  const closeAtt = await signPriceAttestation(account, { symbol: 'BTC', priceX18: priceToX18(110_000), timestamp: now2 });
  const closed = await closeSynthetic(walletClient, publicClient, { id: opened.id, attestation: closeAtt });
  console.log(`✔ closed: pnl=${formatUnits(closed.pnl, 6)} mUSD payout=${formatUnits(closed.payout, 6)} mUSD  ${closed.explorerUrl}`);

  console.log(`\nexpected payout ≈ 1100 mUSD (1000 + 10%). actual=${formatUnits(closed.payout, 6)}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
