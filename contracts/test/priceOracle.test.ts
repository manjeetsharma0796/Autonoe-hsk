import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { signPrice } from "./util/sign";

describe("PriceOracle (signed-pull)", () => {
  async function deploy() {
    const [owner, signer, other] = await ethers.getSigners();
    const oracle = await (await ethers.getContractFactory("PriceOracle")).deploy(signer.address);
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const addr = await oracle.getAddress();
    return { oracle, owner, signer, other, chainId, addr };
  }

  it("accepts a fresh, correctly-signed price", async () => {
    const { oracle, signer, chainId, addr } = await deploy();
    const ts = await time.latest();
    const price = ethers.parseEther("1000");
    const sig = await signPrice(signer, addr, chainId, "BTC", price, ts);
    expect(await oracle.verifyPrice("BTC", price, ts, sig)).to.equal(true);
  });

  it("rejects a price signed by the wrong key", async () => {
    const { oracle, other, chainId, addr } = await deploy();
    const ts = await time.latest();
    const price = ethers.parseEther("1000");
    const sig = await signPrice(other, addr, chainId, "BTC", price, ts);
    await expect(oracle.verifyPrice("BTC", price, ts, sig)).to.be.revertedWith("BAD_SIGNER");
  });

  it("rejects a stale price", async () => {
    const { oracle, signer, chainId, addr } = await deploy();
    const ts = await time.latest();
    const price = ethers.parseEther("1000");
    const sig = await signPrice(signer, addr, chainId, "BTC", price, ts);
    await time.increase(6 * 60); // maxAge is 5 min
    await expect(oracle.verifyPrice("BTC", price, ts, sig)).to.be.revertedWith("STALE_PRICE");
  });

  it("rejects a tampered price (signature no longer matches)", async () => {
    const { oracle, signer, chainId, addr } = await deploy();
    const ts = await time.latest();
    const price = ethers.parseEther("1000");
    const sig = await signPrice(signer, addr, chainId, "BTC", price, ts);
    const tampered = ethers.parseEther("1100");
    await expect(oracle.verifyPrice("BTC", tampered, ts, sig)).to.be.revertedWith("BAD_SIGNER");
  });
});
