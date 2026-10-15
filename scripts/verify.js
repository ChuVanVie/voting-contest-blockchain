const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error("❌ Please set CONTRACT_ADDRESS in .env file");
        process.exit(1);
    }

    // Constructor args: env first, then the deployment record written by deploy.js
    const deploymentPath = path.join(__dirname, `../deployments/${hre.network.name}-latest.json`);
    const deployment = fs.existsSync(deploymentPath) ? JSON.parse(fs.readFileSync(deploymentPath, "utf8")) : {};
    const sameContract = deployment.contractAddress
        && deployment.contractAddress.toLowerCase() === contractAddress.toLowerCase();
    const admin = process.env.ADMIN_ADDRESS || (sameContract ? deployment.admin : undefined);
    const recorder = process.env.RECORDER_ADDRESS || (sameContract ? deployment.recorder : undefined);

    if (!admin || !recorder) {
        console.error("❌ Please set ADMIN_ADDRESS and RECORDER_ADDRESS (the constructor arguments) in .env file");
        process.exit(1);
    }

    console.log("🔍 Verifying contract at:", contractAddress);
    console.log("🌐 Network:", hre.network.name);

    try {
        await hre.run("verify:verify", {
            address: contractAddress,
            constructorArguments: [admin, recorder],
        });

        console.log("✅ Contract verified successfully!");
        console.log("🔗 View on PolygonScan:", `https://amoy.polygonscan.com/address/${contractAddress}#code`);
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("✅ Contract is already verified!");
        } else {
            console.error("❌ Verification failed:", error.message);
            process.exit(1);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
