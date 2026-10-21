const { ethers } = require("ethers");
const fs = require("fs");

/**
 * Registers events and records votes in one process, for rebuilding a local chain from the database
 * (php artisan blockchain:replay-local). Skips what the chain already holds, so it can run again.
 *
 * Usage: SIGNER_PRIVATE_KEY=... node replay-batch.js <rpcUrl> <contractAddress> <batch.json>
 * batch.json: { events: [{ eventId, metadataHash, startTime, endTime }],
 *               votes:  [{ id, eventId, choiceId, voterHash, voteHash, quantity }] }
 * Prints: { success, events: { [eventId]: txHash | "exists" }, votes: { [id]: { txHash } | { error } } }
 */
async function main() {
    const [rpcUrl, contractAddress, batchFile] = process.argv.slice(2);
    if (!rpcUrl || !contractAddress || !batchFile) {
        console.error(JSON.stringify({ success: false, error: "Usage: node replay-batch.js <rpcUrl> <contractAddress> <batch.json>" }));
        process.exit(1);
    }
    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!privateKey) {
        console.error(JSON.stringify({ success: false, error: "SIGNER_PRIVATE_KEY is not set" }));
        process.exit(1);
    }

    const batch = JSON.parse(fs.readFileSync(batchFile, "utf8"));
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.NonceManager(new ethers.Wallet(privateKey, provider));
    const contract = new ethers.Contract(contractAddress, [
        "function events(uint256) view returns (uint256 eventId, bytes32 metadataHash, address creator, uint256 startTime, uint256 endTime, bool isActive)",
        "function votes(bytes32) view returns (uint256 eventId, uint256 choiceId, bytes32 voterHash, uint256 timestamp, bool exists, uint256 quantity)",
        "function registerEvent(uint256 eventId, bytes32 metadataHash, uint256 startTime, uint256 endTime) external",
        "function recordVote(uint256 eventId, uint256 choiceId, bytes32 voterHash, bytes32 voteHash) external",
        "function recordVotes(uint256 eventId, uint256 choiceId, bytes32 voterHash, bytes32 voteHash, uint256 quantity) external",
    ], wallet);

    const out = { success: true, events: {}, votes: {} };

    for (const e of batch.events || []) {
        try {
            const onChain = await contract.events(e.eventId);
            if (onChain.creator !== ethers.ZeroAddress) {
                out.events[e.eventId] = "exists";
                continue;
            }
            const tx = await contract.registerEvent(e.eventId, e.metadataHash, e.startTime, e.endTime);
            await tx.wait(1);
            out.events[e.eventId] = tx.hash;
        } catch (error) {
            out.events[e.eventId] = { error: error.shortMessage || error.message };
        }
    }

    for (const v of batch.votes || []) {
        try {
            if ((await contract.votes(v.voteHash)).exists) {
                out.votes[v.id] = { exists: true };
                continue;
            }
            const quantity = Number(v.quantity) || 1;
            const tx = quantity === 1
                ? await contract.recordVote(v.eventId, v.choiceId, v.voterHash, v.voteHash)
                : await contract.recordVotes(v.eventId, v.choiceId, v.voterHash, v.voteHash, quantity);
            const receipt = await tx.wait(1);
            out.votes[v.id] = receipt && receipt.status === 1 ? { txHash: tx.hash } : { error: "reverted" };
        } catch (error) {
            out.votes[v.id] = { error: error.shortMessage || error.message };
        }
    }

    console.log(JSON.stringify(out));
}

main().catch((error) => {
    console.error(JSON.stringify({ success: false, error: error.message }));
    process.exit(1);
});
