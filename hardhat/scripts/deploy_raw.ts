import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const rpcUrl = "https://mainnet.megaeth.com/rpc";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  const privateKey = process.env.ETHEREUM_PRIVATE_KEY_MEGAETH;
  if (!privateKey) throw new Error("Missing ETHEREUM_PRIVATE_KEY_MEGAETH");
  
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Deploying with account:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', 'X402Escrow.sol', 'X402Escrow.json');
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("Contract deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
