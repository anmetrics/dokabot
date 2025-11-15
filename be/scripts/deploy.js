const { ethers } = require('hardhat');

async function main() {
  const pairCodeHash = '0x...'; // mainnet Uniswap V2 pair code hash
  const FlashDualArb = await ethers.getContractFactory('FlashDualArb');
  const flashArb = await FlashDualArb.deploy(pairCodeHash);
  await flashArb.deployed();
  console.log('Contract deployed to:', flashArb.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
