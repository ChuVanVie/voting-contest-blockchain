# 🔗 Voting Contest - Blockchain Module

Smart contracts for transparent, immutable voting records on Polygon Amoy Testnet.

## 📋 Overview

This module contains the VotingRegistry smart contract that records votes on the blockchain for complete transparency and immutability.

## 🚀 Quick Start

### Prerequisites

- Node.js v18+ 
- MetaMask extension installed
- Test MATIC from [Polygon Faucet](https://faucet.polygon.technology/)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your PRIVATE_KEY (from MetaMask)
nano .env
```

### Development Workflow

```bash
# 1. Compile contracts
npm run compile

# 2. Run tests
npm test

# 3. Deploy to Polygon Amoy Testnet
npm run deploy:amoy

# 4. Verify contract (optional)
npm run verify
```

## 🧪 Testing

```bash
# Run all tests
npx hardhat test

# Run tests with gas reporting
REPORT_GAS=true npx hardhat test

# Run coverage
npm run coverage

# Run specific test file
npx hardhat test test/VotingRegistry.test.js
```

## 📦 Deployment

### Step 1: Configure Environment

Edit `.env` file:
```env
PRIVATE_KEY=your_metamask_private_key_without_0x
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=your_api_key_optional
ADMIN_ADDRESS=0x...      # multisig, gets DEFAULT_ADMIN_ROLE (defaults to deployer)
RECORDER_ADDRESS=0x...   # backend wallet, gets RECORDER_ROLE (defaults to deployer)
```

### Step 2: Get Test MATIC

1. Go to https://faucet.polygon.technology/
2. Select "Polygon Amoy"
3. Paste your wallet address
4. Receive 0.5 test MATIC

### Step 3: Deploy

```bash
npm run deploy:amoy
```

The script will:
- ✅ Check your balance
- ✅ Deploy the contract
- ✅ Save contract address to `deployments/` folder
- ✅ Generate `deployed-address.txt` with next steps

### Step 4: Verify Contract (Recommended)

```bash
# Add contract address to .env first
CONTRACT_ADDRESS=0x...

# Then verify
npm run verify
```

## 📝 Contract Details

### VotingRegistry.sol

Main contract for recording votes on blockchain.

**Constructor:** `constructor(address admin, address recorder)`

**Roles (OpenZeppelin AccessControl):**

- `DEFAULT_ADMIN_ROLE` - grants/revokes roles, pauses/unpauses. Use a multisig in production.
- `RECORDER_ROLE` - the backend wallet; the only account allowed to write.

**Key Functions:**

- `registerEvent(eventId, metadataHash, startTime, endTime)` - RECORDER_ROLE, not paused. Reverts if the event ID was already registered or `startTime >= endTime`
- `recordVote(eventId, choiceId, voterHash, voteHash)` - RECORDER_ROLE, not paused, event active and within its time window. Unique per `voteHash`; a voter may cast several votes per event
- `recordVotes(eventId, choiceId, voterHash, voteHash, quantity)` - same rules; one purchase of a vote package, a single record that counts `quantity` times (1 to `MAX_QUANTITY`)
- `closeEvent(eventId)` - RECORDER_ROLE or admin (also while paused). Marks the event inactive; no more votes are accepted and it cannot be re-registered
- `pause()` / `unpause()` - admin only; blocks `registerEvent`, `recordVote` and `recordVotes`
- `verifyVote(voteHash)` - Vote details (eventId, choiceId, voterHash, timestamp, quantity; quantity is appended last so the first four keep their offsets)
- `events(eventId)` / `getEvent(eventId)` - Event details
- `getEventVotes(eventId, offset, limit)` - Paginated vote hashes (limit <= `MAX_PAGE_SIZE`)
- `getEventVoteCount(eventId)` - Number of vote records
- `getEventVoteTotal(eventId)` / `getChoiceVoteCount(eventId, choiceId)` - Votes, summing each record's quantity

Event and choice IDs must fit in `uint64`.

**Events:**

- `EventRegistered` - Emitted when an event is registered
- `VoteRecorded` - Emitted when a vote is recorded (with its quantity)
- `EventClosed` - Emitted when an event is closed

## 🔧 Configuration

### Hardhat Networks

- `hardhat` - Local development network
- `polygonAmoy` - Polygon Amoy Testnet (Chain ID: 80002)

### Gas Settings

- Solidity: 0.8.24
- Optimizer: Enabled (200 runs)
- Gas Price: estimated by the network (EIP-1559)

## 📁 Project Structure

```
voting-contest-blockchain/
├── contracts/
│   └── VotingRegistry.sol      # Main smart contract
├── scripts/
│   ├── deploy.js               # Deployment script
│   └── verify.js               # Verification script
├── test/
│   └── VotingRegistry.test.js  # Test suite
├── deployments/                # Deployment artifacts (auto-generated)
├── hardhat.config.js           # Hardhat configuration
├── package.json                # Dependencies
├── .env.example                # Environment template
└── README.md                   # This file
```

## 🌐 Network Information

**Polygon Amoy Testnet:**
- Chain ID: 80002
- RPC URL: https://rpc-amoy.polygon.technology
- Explorer: https://amoy.polygonscan.com
- Faucet: https://faucet.polygon.technology

## 🔐 Security Notes

⚠️ **IMPORTANT:**

- Never commit `.env` file to Git
- Never share your private key
- Use testnet for development
- Only use test MATIC (no real value)

## 📚 Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Polygon Documentation](https://docs.polygon.technology/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Solidity Documentation](https://docs.soliditylang.org/)

## 🆘 Troubleshooting

### "Insufficient funds" error
→ Get more test MATIC from the faucet

### "Nonce too high" error
→ Reset your account in MetaMask: Settings → Advanced → Reset Account

### "Invalid private key" error
→ Make sure your private key in `.env` doesn't have the `0x` prefix

### Contract compilation errors
→ Run `npx hardhat clean` then `npx hardhat compile`

### Tests failing
→ Make sure you've run `npm install` and dependencies are up to date

## 📞 Support

- Hardhat Discord: https://discord.gg/hardhat
- Polygon Discord: https://discord.gg/polygon
- Stack Overflow: Use tags `[solidity]` `[hardhat]` `[polygon]`

## 📄 License

MIT

---

**Built with ❤️ for VietCV Voting Contest Platform**
