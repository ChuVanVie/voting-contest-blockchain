const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VotingRegistry", function () {
    const DAY = 86400;
    const UINT64_MAX = 2n ** 64n - 1n;

    async function deployFixture() {
        const [admin, recorder, outsider, other] = await ethers.getSigners();
        const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
        const votingRegistry = await VotingRegistry.deploy(admin.address, recorder.address);
        await votingRegistry.waitForDeployment();

        const DEFAULT_ADMIN_ROLE = await votingRegistry.DEFAULT_ADMIN_ROLE();
        const RECORDER_ROLE = await votingRegistry.RECORDER_ROLE();

        return { votingRegistry, admin, recorder, outsider, other, DEFAULT_ADMIN_ROLE, RECORDER_ROLE };
    }

    // Event 1 started 100s ago and runs for one day
    async function activeEventFixture() {
        const fixture = await deployFixture();
        const eventId = 1;
        const metadataHash = ethers.id("event-metadata");
        const startTime = (await time.latest()) - 100;
        const endTime = startTime + DAY;
        await fixture.votingRegistry.connect(fixture.recorder).registerEvent(eventId, metadataHash, startTime, endTime);
        return { ...fixture, eventId, metadataHash, startTime, endTime };
    }

    describe("Deployment", function () {
        it("Should grant admin and recorder roles", async function () {
            const { votingRegistry, admin, recorder, DEFAULT_ADMIN_ROLE, RECORDER_ROLE } = await loadFixture(deployFixture);

            expect(await votingRegistry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
            expect(await votingRegistry.hasRole(RECORDER_ROLE, recorder.address)).to.be.true;
            expect(await votingRegistry.hasRole(RECORDER_ROLE, admin.address)).to.be.false;
            expect(await votingRegistry.hasRole(DEFAULT_ADMIN_ROLE, recorder.address)).to.be.false;
            expect(await votingRegistry.paused()).to.be.false;
        });

        it("Should reject zero addresses", async function () {
            const [admin] = await ethers.getSigners();
            const VotingRegistry = await ethers.getContractFactory("VotingRegistry");

            await expect(VotingRegistry.deploy(ethers.ZeroAddress, admin.address)).to.be.revertedWith("Invalid admin");
            await expect(VotingRegistry.deploy(admin.address, ethers.ZeroAddress)).to.be.revertedWith("Invalid recorder");
        });
    });

    describe("Event Registration", function () {
        it("Should register a new event", async function () {
            const { votingRegistry, recorder } = await loadFixture(deployFixture);
            const eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = await time.latest();
            const endTime = startTime + DAY;

            await votingRegistry.connect(recorder).registerEvent(eventId, metadataHash, startTime, endTime);

            const event = await votingRegistry.events(eventId);
            expect(event.eventId).to.equal(eventId);
            expect(event.metadataHash).to.equal(metadataHash);
            expect(event.creator).to.equal(recorder.address);
            expect(event.startTime).to.equal(startTime);
            expect(event.endTime).to.equal(endTime);
            expect(event.isActive).to.be.true;
        });

        it("Should emit EventRegistered event", async function () {
            const { votingRegistry, recorder } = await loadFixture(deployFixture);
            const eventId = 1;
            const metadataHash = ethers.id("event-metadata");
            const startTime = await time.latest();
            const endTime = startTime + DAY;

            await expect(votingRegistry.connect(recorder).registerEvent(eventId, metadataHash, startTime, endTime))
                .to.emit(votingRegistry, "EventRegistered")
                .withArgs(eventId, metadataHash, recorder.address, startTime, endTime);
        });

        it("Should not allow duplicate event registration", async function () {
            const { votingRegistry, recorder, eventId, metadataHash, startTime, endTime } = await loadFixture(activeEventFixture);

            await expect(
                votingRegistry.connect(recorder).registerEvent(eventId, metadataHash, startTime, endTime)
            ).to.be.revertedWith("Event already registered");
        });

        it("Should not allow re-registration of a closed event", async function () {
            const { votingRegistry, recorder, eventId, metadataHash, startTime, endTime } = await loadFixture(activeEventFixture);

            await votingRegistry.connect(recorder).closeEvent(eventId);

            await expect(
                votingRegistry.connect(recorder).registerEvent(eventId, metadataHash, startTime, endTime)
            ).to.be.revertedWith("Event already registered");
        });

        it("Should reject invalid time range", async function () {
            const { votingRegistry, recorder } = await loadFixture(deployFixture);
            const metadataHash = ethers.id("event-metadata");
            const startTime = await time.latest();

            // End before start
            await expect(
                votingRegistry.connect(recorder).registerEvent(1, metadataHash, startTime, startTime - 100)
            ).to.be.revertedWith("Invalid time range");

            // End equal to start
            await expect(
                votingRegistry.connect(recorder).registerEvent(1, metadataHash, startTime, startTime)
            ).to.be.revertedWith("Invalid time range");
        });

        it("Should reject event IDs that do not fit in uint64", async function () {
            const { votingRegistry, recorder } = await loadFixture(deployFixture);
            const startTime = await time.latest();

            await expect(
                votingRegistry.connect(recorder).registerEvent(UINT64_MAX + 1n, ethers.id("m"), startTime, startTime + DAY)
            ).to.be.revertedWith("Event ID too large");

            await expect(
                votingRegistry.connect(recorder).registerEvent(UINT64_MAX, ethers.id("m"), startTime, startTime + DAY)
            ).to.not.be.reverted;
        });

        it("Should not allow non-recorder to register an event", async function () {
            const { votingRegistry, admin, outsider, RECORDER_ROLE } = await loadFixture(deployFixture);
            const startTime = await time.latest();

            for (const account of [outsider, admin]) {
                await expect(
                    votingRegistry.connect(account).registerEvent(1, ethers.id("m"), startTime, startTime + DAY)
                ).to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount")
                    .withArgs(account.address, RECORDER_ROLE);
            }
        });
    });

    describe("Vote Recording", function () {
        it("Should record a vote successfully", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const choiceId = 101;
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await votingRegistry.connect(recorder).recordVote(eventId, choiceId, voterHash, voteHash);

            const vote = await votingRegistry.verifyVote(voteHash);
            expect(vote.eventId).to.equal(eventId);
            expect(vote.choiceId).to.equal(choiceId);
            expect(vote.voterHash).to.equal(voterHash);
            expect(vote.timestamp).to.equal(await time.latest());

            const raw = await votingRegistry.votes(voteHash);
            expect(raw.eventId).to.equal(eventId);
            expect(raw.choiceId).to.equal(choiceId);
            expect(raw.voterHash).to.equal(voterHash);
            expect(raw.exists).to.be.true;
        });

        it("Should emit VoteRecorded event", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const choiceId = 101;
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            const nextTimestamp = (await time.latest()) + 10;
            await time.setNextBlockTimestamp(nextTimestamp);

            await expect(votingRegistry.connect(recorder).recordVote(eventId, choiceId, voterHash, voteHash))
                .to.emit(votingRegistry, "VoteRecorded")
                .withArgs(voteHash, eventId, choiceId, nextTimestamp, 1);
        });

        it("Should count a vote package as its quantity", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);

            await votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"));
            await expect(votingRegistry.connect(recorder).recordVotes(eventId, 101, ethers.id("voter-2"), ethers.id("vote-2"), 50))
                .to.emit(votingRegistry, "VoteRecorded");

            expect(await votingRegistry.getChoiceVoteCount(eventId, 101)).to.equal(51);
            expect(await votingRegistry.getEventVoteTotal(eventId)).to.equal(51);
            expect(await votingRegistry.getEventVoteCount(eventId)).to.equal(2);
            expect((await votingRegistry.verifyVote(ethers.id("vote-2"))).quantity).to.equal(50);
            expect((await votingRegistry.votes(ethers.id("vote-1"))).quantity).to.equal(1);
        });

        it("Should reject a package of zero or too many votes", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const max = await votingRegistry.MAX_QUANTITY();

            await expect(votingRegistry.connect(recorder).recordVotes(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"), 0))
                .to.be.revertedWith("Invalid quantity");
            await expect(votingRegistry.connect(recorder).recordVotes(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"), max + 1n))
                .to.be.revertedWith("Invalid quantity");
        });

        it("Should not allow non-recorder to record a vote package", async function () {
            const { votingRegistry, outsider, eventId } = await loadFixture(activeEventFixture);

            await expect(votingRegistry.connect(outsider).recordVotes(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"), 5))
                .to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount");
        });

        it("Should increment choice vote count", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const choiceId = 101;

            await votingRegistry.connect(recorder).recordVote(eventId, choiceId, ethers.id("voter-1"), ethers.id("vote-1"));
            await votingRegistry.connect(recorder).recordVote(eventId, choiceId, ethers.id("voter-2"), ethers.id("vote-2"));

            expect(await votingRegistry.getChoiceVoteCount(eventId, choiceId)).to.equal(2);
            expect(await votingRegistry.choiceVoteCounts(eventId, choiceId)).to.equal(2);
        });

        it("Should not allow duplicate vote hash", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await votingRegistry.connect(recorder).recordVote(eventId, 101, voterHash, voteHash);

            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, 101, voterHash, voteHash)
            ).to.be.revertedWith("Vote already recorded");

            // Same hash for a different choice is still a duplicate
            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, 102, voterHash, voteHash)
            ).to.be.revertedWith("Vote already recorded");
        });

        it("Should allow the same voter to vote for multiple choices", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const voterHash = ethers.id("voter-1");

            await votingRegistry.connect(recorder).recordVote(eventId, 101, voterHash, ethers.id("vote-1"));
            await votingRegistry.connect(recorder).recordVote(eventId, 102, voterHash, ethers.id("vote-2"));
            await votingRegistry.connect(recorder).recordVote(eventId, 103, voterHash, ethers.id("vote-3"));

            expect(await votingRegistry.getEventVoteCount(eventId)).to.equal(3);
            expect(await votingRegistry.getChoiceVoteCount(eventId, 101)).to.equal(1);
            expect(await votingRegistry.getChoiceVoteCount(eventId, 102)).to.equal(1);
            expect(await votingRegistry.getChoiceVoteCount(eventId, 103)).to.equal(1);
        });

        it("Should reject vote for unregistered event", async function () {
            const { votingRegistry, recorder } = await loadFixture(activeEventFixture);

            await expect(
                votingRegistry.connect(recorder).recordVote(999, 101, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.be.revertedWith("Event not active");
        });

        it("Should reject vote before the event starts", async function () {
            const { votingRegistry, recorder } = await loadFixture(deployFixture);
            const startTime = (await time.latest()) + 1000;
            await votingRegistry.connect(recorder).registerEvent(2, ethers.id("m"), startTime, startTime + DAY);

            await expect(
                votingRegistry.connect(recorder).recordVote(2, 101, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.be.revertedWith("Event not started");

            await time.increaseTo(startTime);
            await expect(
                votingRegistry.connect(recorder).recordVote(2, 101, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.not.be.reverted;
        });

        it("Should reject vote after the event ends", async function () {
            const { votingRegistry, recorder, eventId, endTime } = await loadFixture(activeEventFixture);

            await time.increaseTo(endTime + 1);

            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.be.revertedWith("Event ended");
        });

        it("Should reject choice IDs that do not fit in uint64", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);

            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, UINT64_MAX + 1n, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.be.revertedWith("Choice ID too large");

            await votingRegistry.connect(recorder).recordVote(eventId, UINT64_MAX, ethers.id("voter-1"), ethers.id("vote-2"));
            const vote = await votingRegistry.verifyVote(ethers.id("vote-2"));
            expect(vote.choiceId).to.equal(UINT64_MAX);
        });

        it("Should not allow non-recorder to record a vote", async function () {
            const { votingRegistry, admin, outsider, eventId, RECORDER_ROLE } = await loadFixture(activeEventFixture);

            for (const account of [outsider, admin]) {
                await expect(
                    votingRegistry.connect(account).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"))
                ).to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount")
                    .withArgs(account.address, RECORDER_ROLE);
            }

            expect(await votingRegistry.getEventVoteCount(eventId)).to.equal(0);
        });
    });

    describe("Event Closing", function () {
        it("Should stop accepting votes after closeEvent", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);

            await votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"));

            await expect(votingRegistry.connect(recorder).closeEvent(eventId))
                .to.emit(votingRegistry, "EventClosed")
                .withArgs(eventId, recorder.address, (await time.latest()) + 1);

            expect((await votingRegistry.events(eventId)).isActive).to.be.false;
            expect((await votingRegistry.getFunction("getEvent")(eventId)).isActive).to.be.false;

            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-2"), ethers.id("vote-2"))
            ).to.be.revertedWith("Event not active");

            // Existing data stays readable
            expect(await votingRegistry.getEventVoteCount(eventId)).to.equal(1);
            expect((await votingRegistry.verifyVote(ethers.id("vote-1"))).choiceId).to.equal(101);
        });

        it("Should allow admin to close an event", async function () {
            const { votingRegistry, admin, eventId } = await loadFixture(activeEventFixture);

            await expect(votingRegistry.connect(admin).closeEvent(eventId))
                .to.emit(votingRegistry, "EventClosed");
        });

        it("Should allow closing while paused", async function () {
            const { votingRegistry, admin, recorder, eventId } = await loadFixture(activeEventFixture);

            await votingRegistry.connect(admin).pause();
            await expect(votingRegistry.connect(recorder).closeEvent(eventId)).to.not.be.reverted;
        });

        it("Should not allow closing an unknown or already closed event", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);

            await expect(votingRegistry.connect(recorder).closeEvent(999)).to.be.revertedWith("Event not active");

            await votingRegistry.connect(recorder).closeEvent(eventId);
            await expect(votingRegistry.connect(recorder).closeEvent(eventId)).to.be.revertedWith("Event not active");
        });

        it("Should not allow outsiders to close an event", async function () {
            const { votingRegistry, outsider, eventId, RECORDER_ROLE } = await loadFixture(activeEventFixture);

            await expect(votingRegistry.connect(outsider).closeEvent(eventId))
                .to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount")
                .withArgs(outsider.address, RECORDER_ROLE);
        });
    });

    describe("Pausing", function () {
        it("Should block writes while paused and restore them after unpause", async function () {
            const { votingRegistry, admin, recorder, eventId } = await loadFixture(activeEventFixture);
            const startTime = await time.latest();

            await expect(votingRegistry.connect(admin).pause()).to.emit(votingRegistry, "Paused").withArgs(admin.address);
            expect(await votingRegistry.paused()).to.be.true;

            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.be.revertedWithCustomError(votingRegistry, "EnforcedPause");
            await expect(
                votingRegistry.connect(recorder).registerEvent(2, ethers.id("m"), startTime, startTime + DAY)
            ).to.be.revertedWithCustomError(votingRegistry, "EnforcedPause");

            await expect(votingRegistry.connect(admin).unpause()).to.emit(votingRegistry, "Unpaused").withArgs(admin.address);
            expect(await votingRegistry.paused()).to.be.false;

            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.not.be.reverted;
            await expect(
                votingRegistry.connect(recorder).registerEvent(2, ethers.id("m"), startTime, startTime + DAY)
            ).to.not.be.reverted;
        });

        it("Should only allow admin to pause and unpause", async function () {
            const { votingRegistry, admin, recorder, outsider, DEFAULT_ADMIN_ROLE } = await loadFixture(deployFixture);

            for (const account of [recorder, outsider]) {
                await expect(votingRegistry.connect(account).pause())
                    .to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount")
                    .withArgs(account.address, DEFAULT_ADMIN_ROLE);
            }

            await votingRegistry.connect(admin).pause();

            for (const account of [recorder, outsider]) {
                await expect(votingRegistry.connect(account).unpause())
                    .to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount")
                    .withArgs(account.address, DEFAULT_ADMIN_ROLE);
            }
        });
    });

    describe("Role Management", function () {
        it("Should allow admin to grant and revoke the recorder role", async function () {
            const { votingRegistry, admin, recorder, other, eventId, RECORDER_ROLE } = await loadFixture(activeEventFixture);

            await expect(votingRegistry.connect(admin).grantRole(RECORDER_ROLE, other.address))
                .to.emit(votingRegistry, "RoleGranted")
                .withArgs(RECORDER_ROLE, other.address, admin.address);

            await expect(
                votingRegistry.connect(other).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"))
            ).to.not.be.reverted;

            await expect(votingRegistry.connect(admin).revokeRole(RECORDER_ROLE, recorder.address))
                .to.emit(votingRegistry, "RoleRevoked")
                .withArgs(RECORDER_ROLE, recorder.address, admin.address);

            await expect(
                votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-2"), ethers.id("vote-2"))
            ).to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount")
                .withArgs(recorder.address, RECORDER_ROLE);
        });

        it("Should not allow recorder to grant roles", async function () {
            const { votingRegistry, recorder, outsider, RECORDER_ROLE, DEFAULT_ADMIN_ROLE } = await loadFixture(deployFixture);

            await expect(votingRegistry.connect(recorder).grantRole(RECORDER_ROLE, outsider.address))
                .to.be.revertedWithCustomError(votingRegistry, "AccessControlUnauthorizedAccount")
                .withArgs(recorder.address, DEFAULT_ADMIN_ROLE);
        });
    });

    describe("Vote Verification", function () {
        it("Should verify existing vote", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");

            await votingRegistry.connect(recorder).recordVote(eventId, 101, voterHash, voteHash);

            const vote = await votingRegistry.verifyVote(voteHash);
            expect(vote.eventId).to.equal(eventId);
            expect(vote.choiceId).to.equal(101);
            expect(vote.voterHash).to.equal(voterHash);
        });

        it("Should return 32-byte ABI words for packed fields (backend decodes by fixed offsets)", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const voterHash = ethers.id("voter-1");
            const voteHash = ethers.id("vote-1");
            await votingRegistry.connect(recorder).recordVote(eventId, 101, voterHash, voteHash);

            const data = votingRegistry.interface.encodeFunctionData("verifyVote", [voteHash]);
            const raw = await ethers.provider.call({ to: await votingRegistry.getAddress(), data });
            const hex = raw.slice(2);

            // quantity is appended last, so the first four words keep their offsets
            expect(hex.length).to.equal(5 * 64);
            expect(BigInt("0x" + hex.slice(0, 64))).to.equal(BigInt(eventId));
            expect(BigInt("0x" + hex.slice(64, 128))).to.equal(101n);
            expect("0x" + hex.slice(128, 192)).to.equal(voterHash);
            expect(BigInt("0x" + hex.slice(192, 256))).to.equal(BigInt(await time.latest()));
            expect(BigInt("0x" + hex.slice(256, 320))).to.equal(1n);
        });

        it("Should revert for non-existing vote", async function () {
            const { votingRegistry } = await loadFixture(deployFixture);

            await expect(
                votingRegistry.verifyVote(ethers.id("non-existing-vote"))
            ).to.be.revertedWith("Vote not found");
        });
    });

    describe("Event Queries", function () {
        it("Should get vote hashes for an event with pagination", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const voteHashes = [];
            for (let i = 1; i <= 5; i++) {
                const voteHash = ethers.id(`vote-${i}`);
                voteHashes.push(voteHash);
                await votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id(`voter-${i}`), voteHash);
            }

            expect(await votingRegistry.getEventVotes(eventId, 0, 10)).to.deep.equal(voteHashes);
            expect(await votingRegistry.getEventVotes(eventId, 0, 2)).to.deep.equal(voteHashes.slice(0, 2));
            expect(await votingRegistry.getEventVotes(eventId, 2, 2)).to.deep.equal(voteHashes.slice(2, 4));
            expect(await votingRegistry.getEventVotes(eventId, 4, 2)).to.deep.equal(voteHashes.slice(4));
            expect(await votingRegistry.getEventVotes(eventId, 5, 2)).to.deep.equal([]);
            expect(await votingRegistry.getEventVotes(eventId, 0, 0)).to.deep.equal([]);
            expect(await votingRegistry.getEventVotes(999, 0, 10)).to.deep.equal([]);
            expect(await votingRegistry.eventVotes(eventId, 3)).to.equal(voteHashes[3]);
        });

        it("Should reject page sizes above MAX_PAGE_SIZE", async function () {
            const { votingRegistry, eventId } = await loadFixture(activeEventFixture);
            const max = await votingRegistry.MAX_PAGE_SIZE();

            await expect(votingRegistry.getEventVotes(eventId, 0, max)).to.not.be.reverted;
            await expect(votingRegistry.getEventVotes(eventId, 0, max + 1n)).to.be.revertedWith("Limit too large");
        });

        it("Should get total vote count for an event", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);

            await votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-1"), ethers.id("vote-1"));
            await votingRegistry.connect(recorder).recordVote(eventId, 101, ethers.id("voter-2"), ethers.id("vote-2"));

            expect(await votingRegistry.getEventVoteCount(eventId)).to.equal(2);
        });

        it("Should get vote count for specific choice", async function () {
            const { votingRegistry, recorder, eventId } = await loadFixture(activeEventFixture);
            const choice1 = 101;
            const choice2 = 102;

            await votingRegistry.connect(recorder).recordVote(eventId, choice1, ethers.id("voter-1"), ethers.id("vote-1"));
            await votingRegistry.connect(recorder).recordVote(eventId, choice1, ethers.id("voter-2"), ethers.id("vote-2"));
            await votingRegistry.connect(recorder).recordVote(eventId, choice2, ethers.id("voter-3"), ethers.id("vote-3"));

            expect(await votingRegistry.getChoiceVoteCount(eventId, choice1)).to.equal(2);
            expect(await votingRegistry.getChoiceVoteCount(eventId, choice2)).to.equal(1);
        });

        // ethers v6 reserves contract.getEvent(name), so call the view through getFunction
        it("Should get event details", async function () {
            const { votingRegistry, recorder, eventId, metadataHash, startTime, endTime } = await loadFixture(activeEventFixture);

            const evt = await votingRegistry.getFunction("getEvent")(eventId);
            expect(evt.eventId).to.equal(eventId);
            expect(evt.metadataHash).to.equal(metadataHash);
            expect(evt.creator).to.equal(recorder.address);
            expect(evt.startTime).to.equal(startTime);
            expect(evt.endTime).to.equal(endTime);
            expect(evt.isActive).to.be.true;
        });
    });
});
