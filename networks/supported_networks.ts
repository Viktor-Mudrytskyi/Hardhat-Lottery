import { NetworkInterface } from "./network_interface";
import * as dotenv from "dotenv";

dotenv.config();

const ethSepoliaRpc = process.env.ETH_SEPOLIA_RPC_URL;
const polygonCardonaRpc = process.env.POLYGON_CARDONA_RPC_URL;

if (!ethSepoliaRpc || !polygonCardonaRpc) {
    throw new Error(
        "Please set your ETH_SEPOLIA_RPC_URL and POLYGON_CARDONA_RPC_URL in a .env file",
    );
}

export const ethSepoliaNetwork: NetworkInterface = {
    name: "Ethereum Sepolia",
    deployName: "eth-sepolia",
    rpcUrl: ethSepoliaRpc,
    chainId: 11155111,
    token: "ETH",
    tokenPriceFeedUsd: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    ethUsdFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
};

export const polygonCardonaNetwork: NetworkInterface = {
    name: "Polygon Cardona",
    deployName: "polygon-cardona",
    rpcUrl: polygonCardonaRpc,
    chainId: 2442,
    token: "MATIC",
    tokenPriceFeedUsd: "0x7C85dD6eBc1d318E909F22d51e756Cf066643341",
    ethUsdFeed: "0x97d9F9A00dEE0004BE8ca0A8fa374d486567eE2D",
};

export const chainIdToSupportedNetworks = {
    [ethSepoliaNetwork.chainId]: ethSepoliaNetwork,
    [polygonCardonaNetwork.chainId]: polygonCardonaNetwork,
};
