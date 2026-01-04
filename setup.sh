#!/bin/bash

echo "🚀 Setting up Voting Contest Blockchain Module..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js version
echo "📋 Checking prerequisites..."
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)

echo "   ✅ Node.js: $NODE_VERSION"
echo "   ✅ npm: $NPM_VERSION"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}   ⚠️  Please edit .env and add your PRIVATE_KEY${NC}"
else
    echo "   ✅ .env file already exists"
fi
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
echo "   This may take a few minutes..."
npm install --save-dev hardhat@^2.19.0 @nomicfoundation/hardhat-toolbox@^4.0.0

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✅ Dev dependencies installed${NC}"
else
    echo -e "${RED}   ❌ Failed to install dev dependencies${NC}"
    exit 1
fi

npm install @openzeppelin/contracts@^5.0.0 dotenv@^16.3.1 ethers@^6.14.0

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✅ Dependencies installed${NC}"
else
    echo -e "${RED}   ❌ Failed to install dependencies${NC}"
    exit 1
fi

echo ""

# Compile contracts
echo "🔨 Compiling smart contracts..."
npx hardhat compile

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✅ Contracts compiled successfully${NC}"
else
    echo -e "${RED}   ❌ Failed to compile contracts${NC}"
    exit 1
fi

echo ""

# Run tests
echo "🧪 Running tests..."
npx hardhat test

if [ $? -eq 0 ]; then
    echo -e "${GREEN}   ✅ All tests passed${NC}"
else
    echo -e "${YELLOW}   ⚠️  Some tests failed${NC}"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Setup complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Configure MetaMask:"
echo "   - Install MetaMask extension"
echo "   - Add Polygon Amoy Testnet"
echo "   - Get test MATIC from https://faucet.polygon.technology/"
echo ""
echo "2. Update .env file:"
echo "   - Edit .env"
echo "   - Add your PRIVATE_KEY (from MetaMask, without 0x prefix)"
echo ""
echo "3. Deploy to testnet:"
echo "   npm run deploy:amoy"
echo ""
echo "4. Verify contract (optional):"
echo "   npm run verify"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
