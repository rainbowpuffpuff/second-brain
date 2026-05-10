import { HardhatUserConfig, defineConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export default defineConfig({
  plugins: [hardhatVerify],
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated"
    },
    megaeth: {
      type: "http",
      url: "https://mainnet.megaeth.com/rpc",
      chainId: 4326,
      accounts: process.env.ETHEREUM_PRIVATE_KEY_MEGAETH ? [process.env.ETHEREUM_PRIVATE_KEY_MEGAETH] : [],
    }
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY || "",
    }
  },
  chainDescriptors: {
    4326: {
      name: "megaeth",
      blockExplorers: {
        etherscan: {
          name: "MegaETH Explorer",
          url: "https://mega.etherscan.io",
          apiUrl: "https://api.etherscan.io/v2/api",
        },
      },
    }
  },
});
