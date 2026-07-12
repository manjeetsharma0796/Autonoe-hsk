import { expect } from "chai";
import { ethers } from "hardhat";

const DEADLINE = 99999999999;
const M6 = 10n ** 6n;

describe("AMM (mUSD/WMNT)", () => {
  async function deploy() {
    const [owner, lp, trader] = await ethers.getSigners();
    const musd = await (await ethers.getContractFactory("MUSD")).deploy();
    const wmnt = await (await ethers.getContractFactory("WMNT")).deploy();
    const factory = await (await ethers.getContractFactory("AmmFactory")).deploy();
    const router = await (
      await ethers.getContractFactory("AmmRouter")
    ).deploy(await factory.getAddress());

    await musd.ownerMint(lp.address, 1_000_000n * M6);
    await wmnt.connect(lp).deposit({ value: ethers.parseEther("1000") });
    return { musd, wmnt, factory, router, owner, lp, trader };
  }

  it("creates the pair, adds liquidity, then swaps mUSD -> WMNT", async () => {
    const { musd, wmnt, factory, router, lp, trader } = await deploy();
    const musdAddr = await musd.getAddress();
    const wmntAddr = await wmnt.getAddress();
    const routerAddr = await router.getAddress();

    const amtMusd = 100_000n * M6; // 100k mUSD
    const amtWmnt = ethers.parseEther("100"); // 100 WMNT => ~1000 mUSD/WMNT
    await musd.connect(lp).approve(routerAddr, amtMusd);
    await wmnt.connect(lp).approve(routerAddr, amtWmnt);
    await router
      .connect(lp)
      .addLiquidity(musdAddr, wmntAddr, amtMusd, amtWmnt, 0, 0, lp.address, DEADLINE);

    const pair = await factory.getPair(musdAddr, wmntAddr);
    expect(pair).to.not.equal(ethers.ZeroAddress);

    const swapIn = 1000n * M6; // swap 1000 mUSD
    await musd.ownerMint(trader.address, swapIn);
    await musd.connect(trader).approve(routerAddr, swapIn);

    const amounts = await router.getAmountsOut(swapIn, [musdAddr, wmntAddr]);
    const out = amounts[1];
    expect(out).to.be.gt(0n);

    await router
      .connect(trader)
      .swapExactTokensForTokens(swapIn, out, [musdAddr, wmntAddr], trader.address, DEADLINE);
    expect(await wmnt.balanceOf(trader.address)).to.equal(out);
  });

  it("getAmountOut honours the 0.30% fee", async () => {
    const { router } = await deploy();
    // out = 997*in*rOut / (1000*rIn + 997*in)
    const out = await router.getAmountOut(1000n, 1_000_000n, 1_000_000n);
    const expected = (997n * 1000n * 1_000_000n) / (1000n * 1_000_000n + 997n * 1000n);
    expect(out).to.equal(expected);
  });
});
