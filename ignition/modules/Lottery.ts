import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { chainIdToSupportedNetworks } from "../../networks/supported_networks";
import { NetworkInterface } from "../../networks/network_interface";
import { ethers, network } from "hardhat";
import VRFCoordinatorV2MockModule from "./mock/VRFCoordinatorV2Mock";
import { log } from "console";

const LotteryModule = buildModule("LotteryModule", (m) => {
  log("LotteryModule ignition!!");
  const MOCK_VRF_FUND = ethers.parseEther("2");
  const chain: NetworkInterface | undefined =
    chainIdToSupportedNetworks[network.config.chainId || -1];
  if (chain === undefined) {
    throw new Error("Network not defined");
  }
  // Entrance fee
  let entranceFee = ethers.parseEther(chain.entranceFeeEth);
  // Subscription id
  let subscriptionId;
  // VRF coordinator
  let vrfCoordinatorAdress;

  let vrfCoordinatorMock;

  if (!chain.isLocal) {
    vrfCoordinatorAdress = chain.vrfCoordinator!;
    subscriptionId = chain.VrfSubscriptionId;
  } else {
    const { vrfCoordinatorV2Mock } = m.useModule(VRFCoordinatorV2MockModule);
    vrfCoordinatorMock = vrfCoordinatorV2Mock;
    vrfCoordinatorAdress = vrfCoordinatorV2Mock;
    const trxResponse = m.call(vrfCoordinatorV2Mock, "createSubscription");
    const subscriptionIdEvent = m.readEventArgument(
      trxResponse,
      "SubscriptionCreated",
      "subId"
    );
    subscriptionId = subscriptionIdEvent;
    m.call(vrfCoordinatorV2Mock, "fundSubscription", [
      subscriptionId,
      MOCK_VRF_FUND,
    ]);
  }

  // Gas lane
  const gasLane = chain.gasLane;

  // Callback gas limit
  const callbackGasLimit = chain.callbackGasLimit;
  // Interval
  const interval = chain.interval;

  const lottery = m.contract("Lottery", [
    entranceFee,
    vrfCoordinatorAdress,
    gasLane,
    subscriptionId!,
    callbackGasLimit,
    interval,
  ]);

  if (chain.isLocal) {
    m.call(vrfCoordinatorMock!, "addConsumer", [subscriptionId!, lottery]);
  }

  log(`Lottery ignited`);
  log("-------------------------------------");

  // if (chain.isLocal && vrfCoordinatorMock) {
  return {
    lottery,
    ...(chain.isLocal && vrfCoordinatorMock ? { vrfCoordinatorMock } : {}),
  };
});

export default LotteryModule;
