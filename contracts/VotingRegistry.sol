// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VotingRegistry
 * @dev Smart contract to record and verify votes on Polygon blockchain
 * @notice This contract stores vote records immutably and transparently
 */
contract VotingRegistry {
    
    // Structs
    // Structs
    struct Vote {
        uint256 eventId;
        uint256 choiceId;       // ID of candidate or submission
        bytes32 voterHash;      // Hashed voter ID for privacy
        uint256 timestamp;
        bool exists;
    }
    
    struct Event {
        uint256 eventId;
        bytes32 metadataHash;   // Event metadata hash
        address creator;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
    }
    
    // State variables
    mapping(bytes32 => Vote) public votes;              // voteHash => Vote
    mapping(uint256 => Event) public events;            // eventId => Event
    mapping(uint256 => bytes32[]) public eventVotes;    // eventId => voteHashes[]
    mapping(uint256 => mapping(uint256 => uint256)) public choiceVoteCounts; // eventId => choiceId => count
    
    // Events
    event VoteRecorded(
        bytes32 indexed voteHash,
        uint256 indexed eventId,
        uint256 indexed choiceId,
        uint256 timestamp
    );
    
    event EventRegistered(
        uint256 indexed eventId,
        bytes32 metadataHash,
        address indexed creator,
        uint256 startTime,
        uint256 endTime
    );
    
    // Modifiers
    modifier onlyActiveEvent(uint256 _eventId) {
        require(events[_eventId].isActive, "Event not active");
        require(block.timestamp >= events[_eventId].startTime, "Event not started");
        require(block.timestamp <= events[_eventId].endTime, "Event ended");
        _;
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
    ) external {
        require(!events[_eventId].isActive, "Event already registered");
        require(_endTime > _startTime, "Invalid time range");
        
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
     * @dev Record a vote on blockchain
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
    ) external onlyActiveEvent(_eventId) {
        require(!votes[_voteHash].exists, "Vote already recorded");
        
        votes[_voteHash] = Vote({
            eventId: _eventId,
            choiceId: _choiceId,
            voterHash: _voterHash,
            timestamp: block.timestamp,
            exists: true
        });
        
        eventVotes[_eventId].push(_voteHash);
        choiceVoteCounts[_eventId][_choiceId]++;
        
        emit VoteRecorded(_voteHash, _eventId, _choiceId, block.timestamp);
    }
    
    /**
     * @dev Verify a vote exists and get its details
     * @param _voteHash Vote hash to verify
     * @return eventId Event identifier
     * @return choiceId Choice identifier
     * @return voterHash Hashed voter identifier
     * @return timestamp Vote timestamp
     */
    function verifyVote(bytes32 _voteHash) 
        external 
        view 
        returns (
            uint256 eventId,
            uint256 choiceId,
            bytes32 voterHash,
            uint256 timestamp
        ) 
    {
        require(votes[_voteHash].exists, "Vote not found");
        Vote memory vote = votes[_voteHash];
        return (vote.eventId, vote.choiceId, vote.voterHash, vote.timestamp);
    }
    
    /**
     * @dev Get all vote hashes for an event
     * @param _eventId Event identifier
     * @return Array of vote hashes
     */
    function getEventVotes(uint256 _eventId) external view returns (bytes32[] memory) {
        return eventVotes[_eventId];
    }
    
    /**
     * @dev Get total vote count for an event
     * @param _eventId Event identifier
     * @return Total number of votes
     */
    function getEventVoteCount(uint256 _eventId) external view returns (uint256) {
        return eventVotes[_eventId].length;
    }
    
    /**
     * @dev Get vote count for a specific choice
     * @param _eventId Event identifier
     * @param _choiceId Choice identifier
     * @return Number of votes for the choice
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
