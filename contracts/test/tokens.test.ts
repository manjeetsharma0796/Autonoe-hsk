import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("mUSD", () => {
  async function deploy() {
    const [owner, user] = await ethers.getSigners();
    const m = await (await ethers.getContractFactory("MUSD")).deploy();
    return { m, owner, user };
  }

  it("has 6 decimals", async () => {
    const { m } = await deploy();
    expect(await m.decimals()).to.equal(6);
  });

  it("faucet mints the fixed amount and enforces cooldown", async () => {
    const { m, user } = await deploy();
    const amt = await m.FAUCET_AMOUNT();
    await m.connect(user).faucet();
    expect(await m.balanceOf(user.address)).to.equal(amt);
    await expect(m.connect(user).faucet()).to.be.revertedWith("FAUCET_COOLDOWN");
    await time.increase(8 * 3600);
    await m.connect(user).faucet();
    expect(await m.balanceOf(user.address)).to.equal(amt * 2n);
  });

  it("ownerMint is owner-only", async () => {
    const { m, user } = await deploy();
    await m.ownerMint(user.address, 1000n);
    expect(await m.balanceOf(user.address)).to.equal(1000n);
    await expect(m.connect(user).ownerMint(user.address, 1n)).to.be.reverted;
  });
});

describe("WMNT", () => {
  it("wraps and unwraps native MNT 1:1", async () => {
    const [user] = await ethers.getSigners();
    const w = await (await ethers.getContractFactory("WMNT")).deploy();
    await w.connect(user).deposit({ value: ethers.parseEther("1") });
    expect(await w.balanceOf(user.address)).to.equal(ethers.parseEther("1"));
    await w.connect(user).withdraw(ethers.parseEther("0.4"));
    expect(await w.balanceOf(user.address)).to.equal(ethers.parseEther("0.6"));
  });
});
