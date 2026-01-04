const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting LOCAL deployment for demo...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Deploy contract
    console.log("⚙️  Deploying VotingRegistry...");
    const VotingRegistry = await hre.ethers.getContractFactory("VotingRegistry");
    const votingRegistry = await VotingRegistry.deploy();

    await votingRegistry.waitForDeployment();

    const address = await votingRegistry.getAddress();

    console.log("\n✅ VotingRegistry deployed to LOCAL network!");
    console.log("📍 Contract Address:", address);
    console.log("👤 Owner:", deployer.address);
    console.log("\n🎯 This is running on Hardhat local network (for demo)");
    console.log("💡 No real POL needed - perfect for testing!\n");

    // First register an event
    console.log("🎯 Registering test event...");
    const eventId = 1;
    const metadataHash = hre.ethers.id("test-event-metadata");
    const startTime = Math.floor(Date.now() / 1000) - 100;
    const endTime = startTime + 86400;

    const registerTx = await votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime);
    await registerTx.wait();
    console.log("✅ Event registered!");

    // Test recording a vote
    console.log("\n🧪 Testing vote recording...");
    const candidateId = 101;
    const voterHash = hre.ethers.id("voter-1");
    const voteHash = hre.ethers.id("vote-1");

    const tx = await votingRegistry.recordVote(eventId, candidateId, voterHash, voteHash);
    await tx.wait();
    console.log("✅ Vote recorded successfully!");

    const vote = await votingRegistry.verifyVote(voteHash);
    console.log("✅ Vote verified!");
    console.log("📊 Vote details:", {
        eventId: vote.eventId.toString(),
        candidateId: vote.candidateId.toString(),
        voterHash: vote.voterHash,
        timestamp: new Date(Number(vote.timestamp) * 1000).toISOString()
    });

    console.log("\n🎉 Demo deployment complete!\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
