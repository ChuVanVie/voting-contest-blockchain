const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    // Parse arguments
    const args = process.argv.slice(2);
    if (args.length < 6) {
        console.error(JSON.stringify({
            success: false,
            error: "Missing arguments. Usage: SIGNER_PRIVATE_KEY=... node record-vote.js <rpcUrl> <contractAddress> <eventId> <choiceId> <voterHash> <voteHash>"
        }));
        process.exit(1);
    }

    const [rpcUrl, contractAddress, eventId, choiceId, voterHash, voteHash] = args;

    // The key comes from the environment, never argv: arguments are visible to every process via ps
    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!privateKey) {
        console.error(JSON.stringify({ success: false, error: "SIGNER_PRIVATE_KEY is not set" }));
        process.exit(1);
    }

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

        // Only report success once the transaction is mined and did not revert, because the
        // backend marks the vote as verified on success. This runs in a queued job, not the API request.
        const receipt = await tx.wait(1);
        if (!receipt || receipt.status !== 1) {
            throw new Error(`Transaction ${tx.hash} reverted`);
        }

        console.log(JSON.stringify({
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber
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
