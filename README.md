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

**Key Functions:**

- `recordVote(voteId, eventId, voterId, targetId)` - Record a new vote
- `verifyVote(voteId)` - Verify if a vote exists
- `getVote(voteId)` - Get vote details

**Events:**

- `VoteRecorded` - Emitted when a vote is recorded

## 🔧 Configuration

### Hardhat Networks

- `hardhat` - Local development network
- `polygonAmoy` - Polygon Amoy Testnet (Chain ID: 80002)

### Gas Settings

- Optimizer: Enabled (200 runs)
- Gas Price: 35 gwei

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
