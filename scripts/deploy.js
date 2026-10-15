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

    // Resolve roles: admin should be a multisig, recorder is the backend hot wallet
    const { admin, recorder } = resolveRoles(deployer.address);
    console.log("🛡️  Admin (DEFAULT_ADMIN_ROLE):", admin);
    console.log("✍️  Recorder (RECORDER_ROLE):", recorder, "\n");

    // Deploy contract
    console.log("⚙️  Deploying VotingRegistry contract...");
    const VotingRegistry = await hre.ethers.getContractFactory("VotingRegistry");
    const votingRegistry = await VotingRegistry.deploy(admin, recorder);

    await votingRegistry.waitForDeployment();

    const address = await votingRegistry.getAddress();

    console.log("\n✅ VotingRegistry deployed successfully!");
    console.log("📍 Contract Address:", address);
    console.log("🔗 View on PolygonScan:", `https://amoy.polygonscan.com/address/${address}`);
    console.log("🛡️  Admin:", admin);
    console.log("✍️  Recorder:", recorder);

    // Save deployment info
    const deploymentInfo = {
        contractAddress: address,
        deployer: deployer.address,
        admin: admin,
        recorder: recorder,
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
Deployer: ${deployer.address}
Admin (DEFAULT_ADMIN_ROLE): ${admin}
Recorder (RECORDER_ROLE): ${recorder}
Deployed: ${deploymentInfo.deployedAt}

Explorer: ${deploymentInfo.explorerUrl}

───────────────────────────────────────────────────────────────

NEXT STEPS:

1. Update your .env file with:
   CONTRACT_ADDRESS=${address}

2. Update the backend .env with:
   VOTING_CONTRACT_ADDRESS=${address}
   The backend wallet (BLOCKCHAIN_WALLET_ADDRESS) must hold RECORDER_ROLE.
   If it is not ${recorder}, have the admin call
   grantRole(RECORDER_ROLE, <backend wallet>).

3. Update frontend .env with:
   VITE_VOTING_CONTRACT_ADDRESS=${address}
   VITE_BLOCKCHAIN_NETWORK=polygon-amoy
   VITE_POLYGON_EXPLORER=https://amoy.polygonscan.com

4. Verify contract (optional but recommended):
   npx hardhat verify --network polygonAmoy ${address} ${admin} ${recorder}

5. Test the contract:
   Visit: https://amoy.polygonscan.com/address/${address}

───────────────────────────────────────────────────────────────
`;

    fs.writeFileSync(path.join(__dirname, '../deployed-address.txt'), txtContent);

    console.log("\n📋 Next steps:");
    console.log("   1. Update .env with contract address (backend: VOTING_CONTRACT_ADDRESS)");
    console.log("   2. Make sure the backend wallet holds RECORDER_ROLE");
    console.log("   3. Update frontend configuration");
    console.log("   4. Verify contract (optional):");
    console.log(`      npx hardhat verify --network polygonAmoy ${address} ${admin} ${recorder}`);
    console.log("\n🎉 Deployment complete!\n");
}

function resolveRoles(deployerAddress) {
    const admin = process.env.ADMIN_ADDRESS || deployerAddress;
    const recorder = process.env.RECORDER_ADDRESS || deployerAddress;

    for (const [name, value] of [["ADMIN_ADDRESS", admin], ["RECORDER_ADDRESS", recorder]]) {
        if (!hre.ethers.isAddress(value)) {
            throw new Error(`${name} is not a valid address: ${value}`);
        }
    }

    if (!process.env.ADMIN_ADDRESS) {
        console.warn("⚠️  WARNING: ADMIN_ADDRESS not set, the deployer becomes admin.");
        console.warn("   Use a multisig as admin in production, or transfer DEFAULT_ADMIN_ROLE right after deployment.\n");
    }
    if (!process.env.RECORDER_ADDRESS) {
        console.warn("⚠️  WARNING: RECORDER_ADDRESS not set, the deployer becomes recorder.\n");
    }

    return { admin: hre.ethers.getAddress(admin), recorder: hre.ethers.getAddress(recorder) };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });
