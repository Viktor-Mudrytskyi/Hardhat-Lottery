import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-chai-matchers";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ignition-ethers";
import {
  ethSepoliaNetwork,
  polygonCardonaNetwork,
} from "./networks/supported_networks";

const privateKey = process.env.PRIVATE_KEY || "";
const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
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
    ],
  },
  typechain: {
    outDir: "typechain",
    target: "ethers-v6",
  },
  networks: {
    // object naame corresponds to network parameter
    [ethSepoliaNetwork.deployName]: {
      url: ethSepoliaNetwork.rpcUrl,
      accounts: [privateKey],
      chainId: ethSepoliaNetwork.chainId,
    },
    [polygonCardonaNetwork.deployName]: {
      url: polygonCardonaNetwork.rpcUrl,
      accounts: [privateKey],
      chainId: polygonCardonaNetwork.chainId,
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337, // Hardhat uses chainId 31337 by default
      // Accounts for local host are placed by default
    },
  },
};

export default config;
