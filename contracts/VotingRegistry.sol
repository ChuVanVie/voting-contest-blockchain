// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title VotingRegistry
 * @dev Smart contract to record and verify votes on Polygon blockchain
 * @notice This contract stores vote records immutably and transparently.
 *         Writes are restricted to RECORDER_ROLE (the backend wallet); DEFAULT_ADMIN_ROLE
 *         (intended to be a multisig) manages roles and can pause writes.
 */
contract VotingRegistry is AccessControl, Pausable {

    // Roles
    bytes32 public constant RECORDER_ROLE = keccak256("RECORDER_ROLE");

    // Upper bound for one page of getEventVotes, keeps eth_call within RPC gas caps
    uint256 public constant MAX_PAGE_SIZE = 1000;

    // Largest vote package one record may carry (the platform sells far smaller ones)
    uint256 public constant MAX_QUANTITY = 1_000_000;

    // Structs
    // Packed into 2 storage slots: voterHash | eventId + choiceId + timestamp + quantity + exists
    struct Vote {
        bytes32 voterHash;      // Hashed voter ID for privacy
        uint64 eventId;
        uint64 choiceId;        // ID of candidate or submission
        uint64 timestamp;
        uint32 quantity;        // Votes this record counts for: 1, or the size of a bought vote package
        bool exists;
    }

    // Field order and types are read by the backend through the events(uint256) getter: do not change
    struct Event {
        uint256 eventId;
        bytes32 metadataHash;   // Event metadata hash
        address creator;        // Non-zero once registered, used as the existence flag
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }

    // State variables
    mapping(bytes32 => Vote) private _votes;            // voteHash => Vote (read through votes())
    mapping(uint256 => Event) public events;            // eventId => Event
    mapping(uint256 => bytes32[]) public eventVotes;    // eventId => voteHashes[]
    mapping(uint256 => mapping(uint256 => uint256)) public choiceVoteCounts; // eventId => choiceId => votes (sum of quantities)
    mapping(uint256 => uint256) public eventVoteTotals;  // eventId => votes (sum of quantities)

    // Events
    event VoteRecorded(
        bytes32 indexed voteHash,
        uint256 indexed eventId,
        uint256 indexed choiceId,
        uint256 timestamp,
        uint256 quantity
    );

    event EventRegistered(
        uint256 indexed eventId,
        bytes32 metadataHash,
        address indexed creator,
        uint256 startTime,
        uint256 endTime
    );

    event EventClosed(
        uint256 indexed eventId,
        address indexed closedBy,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyActiveEvent(uint256 _eventId) {
        require(events[_eventId].isActive, "Event not active");
        require(block.timestamp >= events[_eventId].startTime, "Event not started");
        require(block.timestamp <= events[_eventId].endTime, "Event ended");
        _;
    }

    /**
     * @param _admin Account granted DEFAULT_ADMIN_ROLE (use a multisig in production)
     * @param _recorder Account granted RECORDER_ROLE (the backend wallet)
     */
    constructor(address _admin, address _recorder) {
        require(_admin != address(0), "Invalid admin");
        require(_recorder != address(0), "Invalid recorder");

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(RECORDER_ROLE, _recorder);
    }

    /**
     * @dev Register a new voting event on blockchain
     * @param _eventId Unique event identifier
     * @param _metadataHash Hash of event metadata (can be IPFS hash)
     * @param _startTime Event start timestamp
     * @param _endTime Event end timestamp
     */
    function registerEvent(
        uint256 _eventId,
        bytes32 _metadataHash,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyRole(RECORDER_ROLE) whenNotPaused {
        require(events[_eventId].creator == address(0), "Event already registered");
        require(_eventId <= type(uint64).max, "Event ID too large");
        require(_startTime < _endTime, "Invalid time range");

        events[_eventId] = Event({
            eventId: _eventId,
            metadataHash: _metadataHash,
            creator: msg.sender,
            startTime: _startTime,
            endTime: _endTime,
            isActive: true
        });

        emit EventRegistered(_eventId, _metadataHash, msg.sender, _startTime, _endTime);
    }

    /**
     * @dev Close an event so that no more votes are accepted. Cannot be reopened.
     *      Callable by RECORDER_ROLE or DEFAULT_ADMIN_ROLE, also while paused.
     * @param _eventId Event identifier
     */
    function closeEvent(uint256 _eventId) external {
        if (!hasRole(RECORDER_ROLE, msg.sender) && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, RECORDER_ROLE);
        }
        require(events[_eventId].isActive, "Event not active");

        events[_eventId].isActive = false;

        emit EventClosed(_eventId, msg.sender, block.timestamp);
    }

    /**
     * @dev Record one vote on blockchain. A voter may cast several votes in one event
     *      (max_votes_per_user > 1); uniqueness is enforced on the vote hash only.
     * @param _eventId Event identifier
     * @param _choiceId Candidate/submission identifier
     * @param _voterHash Hashed voter identifier (for privacy)
     * @param _voteHash Unique vote hash
     */
    function recordVote(
        uint256 _eventId,
        uint256 _choiceId,
        bytes32 _voterHash,
        bytes32 _voteHash
    ) external onlyRole(RECORDER_ROLE) whenNotPaused onlyActiveEvent(_eventId) {
        _record(_eventId, _choiceId, _voterHash, _voteHash, 1);
    }

    /**
     * @dev Record one purchase of several votes (a vote package) as a single record that counts
     *      `_quantity` times towards the choice and event totals.
     * @param _quantity Votes in the purchase, 1 to MAX_QUANTITY
     */
    function recordVotes(
        uint256 _eventId,
        uint256 _choiceId,
        bytes32 _voterHash,
        bytes32 _voteHash,
        uint256 _quantity
    ) external onlyRole(RECORDER_ROLE) whenNotPaused onlyActiveEvent(_eventId) {
        _record(_eventId, _choiceId, _voterHash, _voteHash, _quantity);
    }

    function _record(
        uint256 _eventId,
        uint256 _choiceId,
        bytes32 _voterHash,
        bytes32 _voteHash,
        uint256 _quantity
    ) private {
        require(!_votes[_voteHash].exists, "Vote already recorded");
        require(_choiceId <= type(uint64).max, "Choice ID too large");
        require(_quantity >= 1 && _quantity <= MAX_QUANTITY, "Invalid quantity");

        // eventId fits in uint64: registerEvent enforces it and the event is registered
        _votes[_voteHash] = Vote({
            voterHash: _voterHash,
            eventId: uint64(_eventId),
            choiceId: uint64(_choiceId),
            timestamp: uint64(block.timestamp),
            quantity: uint32(_quantity),
            exists: true
        });

        eventVotes[_eventId].push(_voteHash);
        choiceVoteCounts[_eventId][_choiceId] += _quantity;
        eventVoteTotals[_eventId] += _quantity;

        emit VoteRecorded(_voteHash, _eventId, _choiceId, block.timestamp, _quantity);
    }

    /**
     * @dev Pause registerEvent and recordVote
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Resume registerEvent and recordVote
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Raw vote record, the former public mapping getter's fields plus quantity (appended last)
     * @param _voteHash Vote hash
     */
    function votes(bytes32 _voteHash)
        external
        view
        returns (
            uint256 eventId,
            uint256 choiceId,
            bytes32 voterHash,
            uint256 timestamp,
            bool exists,
            uint256 quantity
        )
    {
        Vote memory vote = _votes[_voteHash];
        return (vote.eventId, vote.choiceId, vote.voterHash, vote.timestamp, vote.exists, vote.quantity);
    }

    /**
     * @dev Verify a vote exists and get its details
     * @param _voteHash Vote hash to verify
     * @return eventId Event identifier
     * @return choiceId Choice identifier
     * @return voterHash Hashed voter identifier
     * @return timestamp Vote timestamp
     * @return quantity Votes the record counts for (appended last so older readers of the first four still work)
     */
    function verifyVote(bytes32 _voteHash)
        external
        view
        returns (
            uint256 eventId,
            uint256 choiceId,
            bytes32 voterHash,
            uint256 timestamp,
            uint256 quantity
        )
    {
        require(_votes[_voteHash].exists, "Vote not found");
        Vote memory vote = _votes[_voteHash];
        return (vote.eventId, vote.choiceId, vote.voterHash, vote.timestamp, vote.quantity);
    }

    /**
     * @dev Get one page of vote hashes for an event
     * @param _eventId Event identifier
     * @param _offset Index of the first vote hash to return
     * @param _limit Maximum number of vote hashes to return (at most MAX_PAGE_SIZE)
     * @return page Array of vote hashes, empty when _offset is past the end
     */
    function getEventVotes(uint256 _eventId, uint256 _offset, uint256 _limit)
        external
        view
        returns (bytes32[] memory page)
    {
        require(_limit <= MAX_PAGE_SIZE, "Limit too large");

        bytes32[] storage all = eventVotes[_eventId];
        uint256 total = all.length;
        if (_offset >= total) {
            return new bytes32[](0);
        }

        uint256 size = total - _offset;
        if (size > _limit) {
            size = _limit;
        }

        page = new bytes32[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = all[_offset + i];
        }
    }

    /**
     * @dev Number of vote records for an event (a package purchase is one record; see getEventVoteTotal)
     * @param _eventId Event identifier
     * @return Number of vote records
     */
    function getEventVoteCount(uint256 _eventId) external view returns (uint256) {
        return eventVotes[_eventId].length;
    }

    /**
     * @dev Votes for an event: the sum of every record's quantity
     * @param _eventId Event identifier
     * @return Total number of votes
     */
    function getEventVoteTotal(uint256 _eventId) external view returns (uint256) {
        return eventVoteTotals[_eventId];
    }

    /**
     * @dev Get vote count for a specific choice
     * @param _eventId Event identifier
     * @param _choiceId Choice identifier
     * @return Number of votes for the choice (sum of quantities)
     */
    function getChoiceVoteCount(uint256 _eventId, uint256 _choiceId)
        external
        view
        returns (uint256)
    {
        return choiceVoteCounts[_eventId][_choiceId];
    }

    /**
     * @dev Get event details
     * @param _eventId Event identifier
     * @return eventId Event identifier
     * @return metadataHash Hash of event metadata
     * @return creator Address of event creator
     * @return startTime Event start timestamp
     * @return endTime Event end timestamp
     * @return isActive Whether event is active
     */
    function getEvent(uint256 _eventId)
        external
        view
        returns (
            uint256 eventId,
            bytes32 metadataHash,
            address creator,
            uint256 startTime,
            uint256 endTime,
            bool isActive
        )
    {
        Event memory evt = events[_eventId];
        return (
            evt.eventId,
            evt.metadataHash,
            evt.creator,
            evt.startTime,
            evt.endTime,
            evt.isActive
        );
    }
}
