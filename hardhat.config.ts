import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ignition-ethers";
import "solidity-coverage";
import "hardhat-gas-reporter";
import {
  ethSepoliaNetwork,
  hardhatLocal,
  localhost,
} from "./configs/supported_networks";
dotenv.config();

const privateKey = process.env.PRIVATE_KEY || "";
// const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
const coinmarketCapApiKey = process.env.COIMARKETCAP_API_KEY;
const ethSepoliaGasPriceApi = process.env.SEPOLIA_ETH_GAS_PRICE_API;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
      },
      {
        version: "0.8.0",
      },
      {
        version: "0.8.19",
      },
    ],
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
  defaultNetwork: "hardhat",
  networks: {
    // Local
    [hardhatLocal.deployName]: {
      chainId: hardhatLocal.chainId,
    },
    [localhost.deployName]: {
      chainId: localhost.chainId,
      url: localhost.rpcUrl,
    },
    // Testnets
    [ethSepoliaNetwork.deployName]: {
      url: ethSepoliaNetwork.rpcUrl,
      accounts: [privateKey],
      chainId: ethSepoliaNetwork.chainId,
    },
  },
  gasReporter: {
    // enabled: true,
    enabled: false,
    currency: "USD",
    coinmarketcap: coinmarketCapApiKey,
    gasPriceApi: ethSepoliaGasPriceApi, // ETH Sepolia gas price
  },
};

export default config;
