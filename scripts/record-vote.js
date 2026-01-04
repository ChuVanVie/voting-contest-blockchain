const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    // Parse arguments
    const args = process.argv.slice(2);
    if (args.length < 6) {
        console.error(JSON.stringify({
            success: false,
            error: "Missing arguments. Usage: node record-vote.js <rpcUrl> <privateKey> <contractAddress> <eventId> <choiceId> <voterHash> <voteHash>"
        }));
        process.exit(1);
    }

    const [rpcUrl, privateKey, contractAddress, eventId, choiceId, voterHash, voteHash] = args;

    try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);

        // Minimal ABI for recordVote
        const abi = [
            "function recordVote(uint256 eventId, uint256 choiceId, bytes32 voterHash, bytes32 voteHash) external"
        ];

        const contract = new ethers.Contract(contractAddress, abi, wallet);

        // Send transaction
        const tx = await contract.recordVote(eventId, choiceId, voterHash, voteHash);

        // We don't necessarily wait for full confirmation here to keep it fast for the API,
        // but we return the hash immediately.

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
