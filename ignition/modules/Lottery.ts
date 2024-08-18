import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { chainIdToSupportedNetworks } from "../../configs/supported_networks";
import { NetworkInterface } from "../../configs/network_interface";
import { ethers, network } from "hardhat";
import { verify } from "crypto";

const LotteryModule = buildModule("LotteryModule", (m) => {
  const chain: NetworkInterface | undefined =
    chainIdToSupportedNetworks[network.config.chainId || -1];
  if (chain === undefined || chain.isLocal) {
    throw new Error("Network not defined or is local");
  }

  // Entrance fee
  let entranceFeeWei = ethers.parseEther(chain.entranceFeeEth);

  const lottery = m.contract("Lottery", [
    entranceFeeWei,
    chain.vrfCoordinator!,
    chain.gasLane,
    chain.vrfSubscriptionId!,
    chain.callbackGasLimit,
    chain.interval,
  ]);

  return { lottery };
});

export default LotteryModule;
