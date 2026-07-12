import { ethers, network } from "hardhat";

/** Print the configured deployer address + native HSK balance for the target network. */
async function main() {
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    console.error("No accounts configured — is DEPLOYER_PRIVATE_KEY set?");
    process.exit(1);
  }
  const d = signers[0];
  const bal = await ethers.provider.getBalance(d.address);
  console.log(`network : ${network.name}`);
  console.log(`deployer: ${d.address}`);
  console.log(`balance : ${ethers.formatEther(bal)} HSK`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
