const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🚀 Starting VotingRegistry deployment...\n");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);

    // Check balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MATIC\n");

    if (balance == 0) {
        console.error("❌ ERROR: Insufficient balance. Please get test MATIC from faucet.");
        console.log("🔗 Faucet: https://faucet.polygon.technology/");
        process.exit(1);
    }

    // Deploy contract
    console.log("⚙️  Deploying VotingRegistry contract...");
    const VotingRegistry = await hre.ethers.getContractFactory("VotingRegistry");
    const votingRegistry = await VotingRegistry.deploy();

    await votingRegistry.waitForDeployment();

    const address = await votingRegistry.getAddress();

    console.log("\n✅ VotingRegistry deployed successfully!");
    console.log("📍 Contract Address:", address);
    console.log("🔗 View on PolygonScan:", `https://amoy.polygonscan.com/address/${address}`);
    console.log("👤 Owner:", deployer.address);

    // Save deployment info
    const deploymentInfo = {
        contractAddress: address,
        owner: deployer.address,
        network: hre.network.name,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        deployedAt: new Date().toISOString(),
        explorerUrl: `https://amoy.polygonscan.com/address/${address}`,
        transactionHash: votingRegistry.deploymentTransaction()?.hash
    };

    // Save to JSON file
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir);
    }

    const outputPath = path.join(deploymentsDir, `${hre.network.name}-latest.json`);
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to:", outputPath);

    // Save simple text file for quick reference
    const txtContent = `
╔════════════════════════════════════════════════════════════════╗
║           VOTING REGISTRY DEPLOYMENT - SUCCESS                 ║
╚════════════════════════════════════════════════════════════════╝

Contract Address: ${address}
Network: ${hre.network.name}
Chain ID: ${deploymentInfo.chainId}
Owner: ${deployer.address}
Deployed: ${deploymentInfo.deployedAt}

Explorer: ${deploymentInfo.explorerUrl}

───────────────────────────────────────────────────────────────

NEXT STEPS:

1. Update your .env file with:
   CONTRACT_ADDRESS=${address}

2. Update frontend .env with:
   VITE_VOTING_CONTRACT_ADDRESS=${address}
   VITE_BLOCKCHAIN_NETWORK=polygon-amoy
   VITE_POLYGON_EXPLORER=https://amoy.polygonscan.com

3. Verify contract (optional but recommended):
   npx hardhat verify --network polygonAmoy ${address}

4. Test the contract:
   Visit: https://amoy.polygonscan.com/address/${address}

───────────────────────────────────────────────────────────────
`;

    fs.writeFileSync(path.join(__dirname, '../deployed-address.txt'), txtContent);

    console.log("\n📋 Next steps:");
    console.log("   1. Update .env with contract address");
    console.log("   2. Update frontend configuration");
    console.log("   3. Verify contract (optional):");
    console.log(`      npx hardhat verify --network polygonAmoy ${address}`);
    console.log("\n🎉 Deployment complete!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
