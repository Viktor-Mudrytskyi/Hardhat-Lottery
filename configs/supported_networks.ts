import * as dotenv from "dotenv";
import { NetworkInterface } from "./network_interface";

dotenv.config();

const ethSepoliaRpc = process.env.ETH_SEPOLIA_RPC_URL;

if (!ethSepoliaRpc) {
  throw new Error(
    "Please set your ETH_SEPOLIA_RPC_URL and POLYGON_CARDONA_RPC_URL in a .env file"
  );
}

export const ethSepoliaNetwork: NetworkInterface = {
  name: "Ethereum Sepolia",
  deployName: "eth-sepolia",
  rpcUrl: ethSepoliaRpc,
  chainId: 11155111,
  vrfCoordinator: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
  entranceFeeEth: "0.005",
  isLocal: false,
  gasLane: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
  vrfSubscriptionId:
    "48235071697253916649246285372953863505341286224160827263486974774179303788771",
  callbackGasLimit: "500000",
  interval: "60",
};

export const hardhatLocal: NetworkInterface = {
  name: "Hard-Hat",
  deployName: "hardhat",
  chainId: 31337,
  entranceFeeEth: "0.005",
  isLocal: true,
  gasLane: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
  callbackGasLimit: "500000",
  interval: "60",
};

export const localhost: NetworkInterface = {
  name: "Localhost",
  deployName: "localhost",
  chainId: 31337,
  entranceFeeEth: "0.005",
  rpcUrl: "http://127.0.0.1:8545/",
  isLocal: true,
  gasLane: "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae",
  callbackGasLimit: "500000",
  interval: "60",
};

export const chainIdToSupportedNetworks = {
  [ethSepoliaNetwork.chainId]: ethSepoliaNetwork,
  [hardhatLocal.chainId]: hardhatLocal,
  [localhost.chainId]: localhost,
};
