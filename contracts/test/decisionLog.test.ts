import { expect } from "chai";
import { ethers } from "hardhat";

describe("DecisionLog", () => {
  it("logs a decision (incl. negative pnl) and reads it back", async () => {
    const [user] = await ethers.getSigners();
    const d = await (await ethers.getContractFactory("DecisionLog")).deploy();

    const th = ethers.id("thesis-1");
    const vh = ethers.id("verdict-1");
    await d.logDecision(th, vh, "WHSK", 100, 95, -5, "opt-1");

    expect(await d.decisionsLength()).to.equal(1);
    const ids = await d.getUserDecisions(user.address);
    expect(ids.length).to.equal(1);

    const dec = await d.getDecision(0);
    expect(dec.user).to.equal(user.address);
    expect(dec.asset).to.equal("WHSK");
    expect(dec.thesisHash).to.equal(th);
    expect(dec.pnl).to.equal(-5);
    expect(dec.optionRef).to.equal("opt-1");
  });
});
