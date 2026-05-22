/**
 * ROYALE — Smart Contract Deployment
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network goerli
 *   npx hardhat run scripts/deploy.js --network mainnet
 *
 * After deploy, update .env.local with the contract addresses printed below.
 */

const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log('\n◈ ROYALE CONTRACT DEPLOYMENT');
  console.log(`  Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // 1. Deploy RoyaleCoin ($RYL ERC-20)
  console.log('1/3 Deploying RoyaleCoin ($RYL)...');
  const RoyaleCoin = await ethers.getContractFactory('RoyaleCoin');
  const ryl = await RoyaleCoin.deploy(deployer.address);
  await ryl.waitForDeployment();
  const rylAddress = await ryl.getAddress();
  console.log(`    ✓ RoyaleCoin: ${rylAddress}`);

  // 2. Deploy RoyaleContent (ERC-1155 NFT)
  console.log('2/3 Deploying RoyaleContent (NFT)...');
  const RoyaleContent = await ethers.getContractFactory('RoyaleContent');
  const content = await RoyaleContent.deploy(
    deployer.address, // treasury
    rylAddress        // $RYL token
  );
  await content.waitForDeployment();
  const contentAddress = await content.getAddress();
  console.log(`    ✓ RoyaleContent: ${contentAddress}`);

  // 3. Deploy RoyaleSubscription
  console.log('3/3 Deploying RoyaleSubscription...');
  const RoyaleSubscription = await ethers.getContractFactory('RoyaleSubscription');
  const subscription = await RoyaleSubscription.deploy(
    deployer.address, // treasury
    rylAddress        // $RYL token
  );
  await subscription.waitForDeployment();
  const subscriptionAddress = await subscription.getAddress();
  console.log(`    ✓ RoyaleSubscription: ${subscriptionAddress}\n`);

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('◈ DEPLOYMENT COMPLETE — Add to .env.local:');
  console.log('───────────────────────────────────────────────────────');
  console.log(`NEXT_PUBLIC_RYL_TOKEN_ADDRESS=${rylAddress}`);
  console.log(`NEXT_PUBLIC_ROYALE_CONTENT_ADDRESS=${contentAddress}`);
  console.log(`NEXT_PUBLIC_ROYALE_SUBSCRIPTION_ADDRESS=${subscriptionAddress}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Verify on Etherscan (if API key set)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log('Waiting for block confirmations before verification...');
    await ryl.deploymentTransaction()?.wait(5);

    try {
      await hre.run('verify:verify', {
        address: rylAddress,
        constructorArguments: [deployer.address],
      });
      await hre.run('verify:verify', {
        address: contentAddress,
        constructorArguments: [deployer.address, rylAddress],
      });
      await hre.run('verify:verify', {
        address: subscriptionAddress,
        constructorArguments: [deployer.address, rylAddress],
      });
      console.log('✓ Contracts verified on Etherscan');
    } catch (err) {
      console.log('  Etherscan verification skipped:', err.message);
    }
  }
}

main().catch((err) => {
  console.error('\n✗ Deployment failed:', err);
  process.exit(1);
});
