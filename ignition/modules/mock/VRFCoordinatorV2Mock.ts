import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { log } from "console";
import { ethers, network } from "hardhat";
import { chainIdToSupportedNetworks } from "../../../networks/supported_networks";
import { NetworkInterface } from "../../../networks/network_interface";

const VRFCoordinatorV2MockModule = buildModule(
  "VRFCoordinatorV2MockModule",
  (m) => {
    const chain: NetworkInterface | undefined =
      chainIdToSupportedNetworks[network.config.chainId || -1];
    if (chain === undefined || !chain.isLocal) {
      throw new Error("Not a local network");
    }

    const BASE_FEE = ethers.parseEther("0.25");
    const GAS_PRICE_LINK = 1e9;
    log("VRFCoordinatorV2MockModule ignition!!!");
    const vrfCoordinatorV2Mock = m.contract("VRFCoordinatorV2Mock", [
      BASE_FEE,
      GAS_PRICE_LINK,
    ]);

    log(`VRFCoordinatorV2Mock deployed`);

    log("-------------------------------------");
    return { vrfCoordinatorV2Mock };
  }
);

export default VRFCoordinatorV2MockModule;
