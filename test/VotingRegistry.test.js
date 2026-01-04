const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VotingRegistry", function () {
    let votingRegistry;
    let owner, addr1, addr2;

    beforeEach(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();
        const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
        votingRegistry = await VotingRegistry.deploy();
        await votingRegistry.waitForDeployment();
    });

    describe("Event Registration", function () {
        it("Should register a new event", async function () {
            const eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = Math.floor(Date.now() / 1000);
            const endTime = startTime + 86400; // 1 day later

            await votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime);

            const event = await votingRegistry.events(eventId);
            expect(event.eventId).to.equal(eventId);
            expect(event.metadataHash).to.equal(metadataHash);
            expect(event.creator).to.equal(owner.address);
            expect(event.isActive).to.be.true;
        });

        it("Should emit EventRegistered event", async function () {
            const eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = Math.floor(Date.now() / 1000);
            const endTime = startTime + 86400;

            await expect(votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime))
                .to.emit(votingRegistry, "EventRegistered")
                .withArgs(eventId, metadataHash, owner.address, startTime, endTime);
        });

        it("Should not allow duplicate event registration", async function () {
            const eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = Math.floor(Date.now() / 1000);
            const endTime = startTime + 86400;

            await votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime);

            await expect(
                votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime)
            ).to.be.revertedWith("Event already registered");
        });

        it("Should reject invalid time range", async function () {
            const eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = Math.floor(Date.now() / 1000);
            const endTime = startTime - 100; // Invalid: end before start

            await expect(
                votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime)
            ).to.be.revertedWith("Invalid time range");
        });
    });

    describe("Vote Recording", function () {
        let eventId, metadataHash, startTime, endTime;

        beforeEach(async function () {
            eventId = 1;
            metadataHash = ethers.id("event-metadata");
            startTime = Math.floor(Date.now() / 1000) - 100; // Started
            endTime = startTime + 86400;
            await votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime);
        });

        it("Should record a vote successfully", async function () {
            const candidateId = 101;
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await votingRegistry.recordVote(eventId, candidateId, voterHash, voteHash);

            const vote = await votingRegistry.verifyVote(voteHash);
            expect(vote.eventId).to.equal(eventId);
            expect(vote.candidateId).to.equal(candidateId);
            expect(vote.voterHash).to.equal(voterHash);
        });

        it("Should emit VoteRecorded event", async function () {
            const candidateId = 101;
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await expect(votingRegistry.recordVote(eventId, candidateId, voterHash, voteHash))
                .to.emit(votingRegistry, "VoteRecorded")
                .withArgs(voteHash, eventId, candidateId, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
        });

        it("Should increment candidate vote count", async function () {
            const candidateId = 101;
            const voterHash1 = ethers.id("voter-1");
            const voteHash1 = ethers.id("vote-1");
            const voterHash2 = ethers.id("voter-2");
            const voteHash2 = ethers.id("vote-2");

            await votingRegistry.recordVote(eventId, candidateId, voterHash1, voteHash1);
            await votingRegistry.recordVote(eventId, candidateId, voterHash2, voteHash2);

            const count = await votingRegistry.getCandidateVoteCount(eventId, candidateId);
            expect(count).to.equal(2);
        });

        it("Should not allow duplicate vote hash", async function () {
            const candidateId = 101;
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await votingRegistry.recordVote(eventId, candidateId, voterHash, voteHash);

            await expect(
                votingRegistry.recordVote(eventId, candidateId, voterHash, voteHash)
            ).to.be.revertedWith("Vote already recorded");
        });

        it("Should reject vote for inactive event", async function () {
            const inactiveEventId = 999;
            const candidateId = 101;
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await expect(
                votingRegistry.recordVote(inactiveEventId, candidateId, voterHash, voteHash)
            ).to.be.revertedWith("Event not active");
        });
    });

    describe("Vote Verification", function () {
        let eventId;

        beforeEach(async function () {
            eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = Math.floor(Date.now() / 1000) - 100;
            const endTime = startTime + 86400;
            await votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime);
        });

        it("Should verify existing vote", async function () {
            const candidateId = 101;
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await votingRegistry.recordVote(eventId, candidateId, voterHash, voteHash);

            const vote = await votingRegistry.verifyVote(voteHash);
            expect(vote.eventId).to.equal(eventId);
            expect(vote.candidateId).to.equal(candidateId);
            expect(vote.voterHash).to.equal(voterHash);
        });

        it("Should revert for non-existing vote", async function () {
            const invalidVoteHash = ethers.id("non-existing-vote");

            await expect(
                votingRegistry.verifyVote(invalidVoteHash)
            ).to.be.revertedWith("Vote not found");
        });
    });

    describe("Event Queries", function () {
        let eventId;

        beforeEach(async function () {
            eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = Math.floor(Date.now() / 1000) - 100;
            const endTime = startTime + 86400;
            await votingRegistry.registerEvent(eventId, metadataHash, startTime, endTime);
        });

        it("Should get all vote hashes for an event", async function () {
            const candidateId = 101;
            const voterHash1 = ethers.id("voter-1");
            const voteHash1 = ethers.id("vote-1");
            const voterHash2 = ethers.id("voter-2");
            const voteHash2 = ethers.id("vote-2");

            await votingRegistry.recordVote(eventId, candidateId, voterHash1, voteHash1);
            await votingRegistry.recordVote(eventId, candidateId, voterHash2, voteHash2);

            const votes = await votingRegistry.getEventVotes(eventId);
            expect(votes.length).to.equal(2);
            expect(votes[0]).to.equal(voteHash1);
            expect(votes[1]).to.equal(voteHash2);
        });

        it("Should get total vote count for an event", async function () {
            const candidateId = 101;
            const voterHash1 = ethers.id("voter-1");
            const voteHash1 = ethers.id("vote-1");
            const voterHash2 = ethers.id("voter-2");
            const voteHash2 = ethers.id("vote-2");

            await votingRegistry.recordVote(eventId, candidateId, voterHash1, voteHash1);
            await votingRegistry.recordVote(eventId, candidateId, voterHash2, voteHash2);

            const count = await votingRegistry.getEventVoteCount(eventId);
            expect(count).to.equal(2);
        });

        it("Should get vote count for specific candidate", async function () {
            const candidate1 = 101;
            const candidate2 = 102;

            await votingRegistry.recordVote(eventId, candidate1, ethers.id("voter-1"), ethers.id("vote-1"));
            await votingRegistry.recordVote(eventId, candidate1, ethers.id("voter-2"), ethers.id("vote-2"));
            await votingRegistry.recordVote(eventId, candidate2, ethers.id("voter-3"), ethers.id("vote-3"));

            const count1 = await votingRegistry.getCandidateVoteCount(eventId, candidate1);
            const count2 = await votingRegistry.getCandidateVoteCount(eventId, candidate2);

            expect(count1).to.equal(2);
            expect(count2).to.equal(1);
        });
    });
});
