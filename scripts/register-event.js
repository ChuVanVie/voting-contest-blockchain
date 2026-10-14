const { ethers } = require("ethers");

async function main() {
    // Parse arguments
    const args = process.argv.slice(2);
    if (args.length < 6) {
        console.error(JSON.stringify({
            success: false,
            error: "Missing arguments. Usage: SIGNER_PRIVATE_KEY=... node register-event.js <rpcUrl> <contractAddress> <eventId> <metadataHash> <startTime> <endTime>"
        }));
        process.exit(1);
    }

    const [rpcUrl, contractAddress, eventId, metadataHash, startTime, endTime] = args;

    // The key comes from the environment, never argv: arguments are visible to every process via ps
    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!privateKey) {
        console.error(JSON.stringify({ success: false, error: "SIGNER_PRIVATE_KEY is not set" }));
        process.exit(1);
    }

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);

        // Minimal ABI for registerEvent
        const abi = [
            "function registerEvent(uint256 eventId, bytes32 metadataHash, uint256 startTime, uint256 endTime) external"
        ];

        const contract = new ethers.Contract(contractAddress, abi, wallet);

        // Send transaction
        const tx = await contract.registerEvent(eventId, metadataHash, startTime, endTime);

        console.log(JSON.stringify({
            success: true,
            txHash: tx.hash
        }));

    } catch (error) {
        console.error(JSON.stringify({
            success: false,
            error: error.message
        }));
        process.exit(1);
    }
}

main();
