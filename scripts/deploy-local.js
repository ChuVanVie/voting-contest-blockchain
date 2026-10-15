const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting LOCAL deployment for demo...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying with account:", deployer.address);
    console.log("💰 Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

    // Admin should be a multisig and recorder the backend wallet; locally both default to the deployer
    const admin = process.env.ADMIN_ADDRESS || deployer.address;
    const recorder = process.env.RECORDER_ADDRESS || deployer.address;
    if (!process.env.ADMIN_ADDRESS) {
        console.warn("⚠️  ADMIN_ADDRESS not set, using deployer as admin (use a multisig in production)");
    }
    if (!process.env.RECORDER_ADDRESS) {
        console.warn("⚠️  RECORDER_ADDRESS not set, using deployer as recorder");
    }

    // Deploy contract
    console.log("⚙️  Deploying VotingRegistry...");
    const VotingRegistry = await hre.ethers.getContractFactory("VotingRegistry");
    const votingRegistry = await VotingRegistry.deploy(admin, recorder);

    await votingRegistry.waitForDeployment();

    const address = await votingRegistry.getAddress();

    console.log("\n✅ VotingRegistry deployed to LOCAL network!");
    console.log("📍 Contract Address:", address);
    console.log("🛡️  Admin:", admin);
    console.log("✍️  Recorder:", recorder);
    console.log("\n🎯 This is running on Hardhat local network (for demo)");
    console.log("💡 No real POL needed - perfect for testing!\n");

    // The demo writes below need RECORDER_ROLE on the deployer
    const recorderRole = await votingRegistry.RECORDER_ROLE();
    if (!(await votingRegistry.hasRole(recorderRole, deployer.address))) {
        console.log("ℹ️  Deployer has no RECORDER_ROLE, skipping demo event and vote.\n");
        return;
    }

    // First register an event
    console.log("🎯 Registering test event...");
    const eventId = 1;
    const metadataHash = hre.ethers.id("test-event-metadata");
    const latestBlock = await hre.ethers.provider.getBlock("latest");
    const startTime = latestBlock.timestamp - 100;
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
        choiceId: vote.choiceId.toString(),
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
