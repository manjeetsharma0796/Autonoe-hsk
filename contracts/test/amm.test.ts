import { expect } from "chai";
import { ethers } from "hardhat";

const DEADLINE = 99999999999;
const M6 = 10n ** 6n;

describe("AMM (mUSD/WHSK)", () => {
  async function deploy() {
    const [owner, lp, trader] = await ethers.getSigners();
    const musd = await (await ethers.getContractFactory("MUSD")).deploy();
    const whsk = await (await ethers.getContractFactory("WHSK")).deploy();
    const factory = await (await ethers.getContractFactory("AmmFactory")).deploy();
    const router = await (
      await ethers.getContractFactory("AmmRouter")
    ).deploy(await factory.getAddress());

    await musd.ownerMint(lp.address, 1_000_000n * M6);
    await whsk.connect(lp).deposit({ value: ethers.parseEther("1000") });
    return { musd, whsk, factory, router, owner, lp, trader };
  }

  it("creates the pair, adds liquidity, then swaps mUSD -> WHSK", async () => {
    const { musd, whsk, factory, router, lp, trader } = await deploy();
    const musdAddr = await musd.getAddress();
    const whskAddr = await whsk.getAddress();
    const routerAddr = await router.getAddress();

    const amtMusd = 100_000n * M6; // 100k mUSD
    const amtWhsk = ethers.parseEther("100"); // 100 WHSK => ~1000 mUSD/WHSK
    await musd.connect(lp).approve(routerAddr, amtMusd);
    await whsk.connect(lp).approve(routerAddr, amtWhsk);
    await router
      .connect(lp)
      .addLiquidity(musdAddr, whskAddr, amtMusd, amtWhsk, 0, 0, lp.address, DEADLINE);

    const pair = await factory.getPair(musdAddr, whskAddr);
    expect(pair).to.not.equal(ethers.ZeroAddress);

    const swapIn = 1000n * M6; // swap 1000 mUSD
    await musd.ownerMint(trader.address, swapIn);
    await musd.connect(trader).approve(routerAddr, swapIn);

    const amounts = await router.getAmountsOut(swapIn, [musdAddr, whskAddr]);
    const out = amounts[1];
    expect(out).to.be.gt(0n);

    await router
      .connect(trader)
      .swapExactTokensForTokens(swapIn, out, [musdAddr, whskAddr], trader.address, DEADLINE);
    expect(await whsk.balanceOf(trader.address)).to.equal(out);
  });

  it("getAmountOut honours the 0.30% fee", async () => {
    const { router } = await deploy();
    // out = 997*in*rOut / (1000*rIn + 997*in)
    const out = await router.getAmountOut(1000n, 1_000_000n, 1_000_000n);
    const expected = (997n * 1000n * 1_000_000n) / (1000n * 1_000_000n + 997n * 1000n);
    expect(out).to.equal(expected);
  });
});
