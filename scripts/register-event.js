const { ethers } = require("ethers");

async function main() {
    // Parse arguments
    const args = process.argv.slice(2);
    if (args.length < 7) {
        console.error(JSON.stringify({
            success: false,
            error: "Missing arguments. Usage: node register-event.js <rpcUrl> <privateKey> <contractAddress> <eventId> <metadataHash> <startTime> <endTime>"
        }));
        process.exit(1);
    }

    const [rpcUrl, privateKey, contractAddress, eventId, metadataHash, startTime, endTime] = args;

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
