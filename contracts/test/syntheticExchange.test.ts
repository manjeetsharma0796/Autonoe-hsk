import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { signPrice } from "./util/sign";

const M6 = 10n ** 6n;

describe("SyntheticExchange (hybrid synthetic leg)", () => {
  async function deploy(fundReserve = 500_000n * M6) {
    const [owner, signer, trader, treasury] = await ethers.getSigners();
    const musd = await (await ethers.getContractFactory("MUSD")).deploy();
    const oracle = await (await ethers.getContractFactory("PriceOracle")).deploy(signer.address);
    const ex = await (
      await ethers.getContractFactory("SyntheticExchange")
    ).deploy(await musd.getAddress(), await oracle.getAddress());

    const chainId = (await ethers.provider.getNetwork()).chainId;
    const oracleAddr = await oracle.getAddress();
    const exAddr = await ex.getAddress();

    await ex.registerMarket("BTC");

    if (fundReserve > 0n) {
      await musd.ownerMint(treasury.address, fundReserve);
      await musd.connect(treasury).approve(exAddr, fundReserve);
      await ex.connect(treasury).fundReserve(fundReserve);
    }
    await musd.ownerMint(trader.address, 100_000n * M6);

    return { musd, oracle, ex, signer, trader, chainId, oracleAddr, exAddr };
  }

  async function open(
    ctx: Awaited<ReturnType<typeof deploy>>,
    isLong: boolean,
    size: bigint,
    priceX18: bigint
  ) {
    const { musd, ex, signer, trader, chainId, oracleAddr, exAddr } = ctx;
    await musd.connect(trader).approve(exAddr, size);
    const ts = await time.latest();
    const sig = await signPrice(signer, oracleAddr, chainId, "BTC", priceX18, ts);
    await ex.connect(trader).openPosition("BTC", isLong, size, priceX18, ts, sig);
  }

  async function close(ctx: Awaited<ReturnType<typeof deploy>>, id: number, priceX18: bigint) {
    const { ex, signer, trader, chainId, oracleAddr } = ctx;
    const ts = await time.latest();
    const sig = await signPrice(signer, oracleAddr, chainId, "BTC", priceX18, ts);
    return ex.connect(trader).closePosition(id, priceX18, ts, sig);
  }

  it("long profits when the price rises", async () => {
    const ctx = await deploy();
    const size = 10_000n * M6;
    await open(ctx, true, size, ethers.parseEther("100"));
    const before = await ctx.musd.balanceOf(ctx.trader.address);
    await close(ctx, 0, ethers.parseEther("120")); // +20%
    const after = await ctx.musd.balanceOf(ctx.trader.address);
    expect(after - before).to.equal(12_000n * M6); // size + 20%
  });

  it("short profits when the price falls", async () => {
    const ctx = await deploy();
    const size = 10_000n * M6;
    await open(ctx, false, size, ethers.parseEther("100"));
    const before = await ctx.musd.balanceOf(ctx.trader.address);
    await close(ctx, 0, ethers.parseEther("80")); // -20% => short +20%
    const after = await ctx.musd.balanceOf(ctx.trader.address);
    expect(after - before).to.equal(12_000n * M6);
  });

  it("long loses when the price falls (payout < collateral)", async () => {
    const ctx = await deploy();
    const size = 10_000n * M6;
    await open(ctx, true, size, ethers.parseEther("100"));
    const before = await ctx.musd.balanceOf(ctx.trader.address);
    await close(ctx, 0, ethers.parseEther("90")); // -10%
    const after = await ctx.musd.balanceOf(ctx.trader.address);
    expect(after - before).to.equal(9_000n * M6); // size - 10%
  });

  it("reverts a winning close when the house reserve cannot cover it", async () => {
    const ctx = await deploy(0n); // no house reserve; only collateral is held
    const size = 10_000n * M6;
    await open(ctx, true, size, ethers.parseEther("100"));
    // payout would be 12k but contract only holds 10k collateral
    await expect(close(ctx, 0, ethers.parseEther("120"))).to.be.revertedWith(
      "INSUFFICIENT_RESERVE"
    );
  });

  it("rejects opening an unregistered market", async () => {
    const { musd, ex, signer, trader, chainId, oracleAddr, exAddr } = await deploy();
    const size = 1_000n * M6;
    await musd.connect(trader).approve(exAddr, size);
    const ts = await time.latest();
    const price = ethers.parseEther("1");
    const sig = await signPrice(signer, oracleAddr, chainId, "DOGE", price, ts);
    await expect(
      ex.connect(trader).openPosition("DOGE", true, size, price, ts, sig)
    ).to.be.revertedWith("UNKNOWN_MARKET");
  });
});
