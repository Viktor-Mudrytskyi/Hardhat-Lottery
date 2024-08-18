import { ethers, network } from "hardhat";
import { NetworkInterface } from "../../configs/network_interface";
import { chainIdToSupportedNetworks } from "../../configs/supported_networks";
import { Lottery, VRFCoordinatorV2_5Mock } from "../../typechain";
import { expect, assert } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { log } from "console";
import { correctTimestampBy } from "../../utils/hardhat-network-utils";
import { rejects } from "assert";

describe("Lottery Unit Tests", function () {
  const BASE_FEE = ethers.parseEther("0.25");
  const GAS_PRICE_LINK = 1e9;
  const WEI_PER_UNIT_LINK = "3872618692831434";
  const MOCK_LINK = "1000000000000000000000";
  const ACCEPTABLE_LOTTERY_FEE = ethers.parseEther("0.1");
  let currentChain: NetworkInterface;
  let lotteryContract: Lottery;
  let vrfCoordinatorV2_5MockContract: VRFCoordinatorV2_5Mock;
  let signers: HardhatEthersSigner[];
  let subscriptionId: bigint;

  before(async function () {
    const chain: NetworkInterface | undefined =
      chainIdToSupportedNetworks[network.config.chainId || -1];
    if (chain === undefined) {
      throw new Error("Network not defined or is local");
    }
    if (!chain.isLocal) {
      throw new Error("Network is not local");
    }
    currentChain = chain;
  });

  beforeEach(async function () {
    let entranceFeeWei = ethers.parseEther(currentChain.entranceFeeEth);
    vrfCoordinatorV2_5MockContract = await ethers.deployContract(
      "VRFCoordinatorV2_5Mock",
      [BASE_FEE, GAS_PRICE_LINK, WEI_PER_UNIT_LINK]
    );

    const mockCoordinatorAddress =
      await vrfCoordinatorV2_5MockContract.getAddress();
    log(`mockCoordinatorAddress: ${mockCoordinatorAddress}`);

    const createSubResponse =
      await vrfCoordinatorV2_5MockContract.createSubscription();
    await createSubResponse.wait(1);

    const subscriptionCreatedFilter =
      vrfCoordinatorV2_5MockContract.filters.SubscriptionCreated;

    const subscriptionCreatedEvent =
      await vrfCoordinatorV2_5MockContract.queryFilter(
        subscriptionCreatedFilter
      );

    subscriptionId = subscriptionCreatedEvent[0].args[0];

    if (subscriptionId === undefined) {
      throw new Error("Failed to create subscription");
    }

    const fundSubscriptionResponse =
      await vrfCoordinatorV2_5MockContract.fundSubscription(
        subscriptionId,
        MOCK_LINK
      );

    await fundSubscriptionResponse.wait(1);

    lotteryContract = await ethers.deployContract("Lottery", [
      entranceFeeWei,
      mockCoordinatorAddress,
      currentChain.gasLane,
      subscriptionId,
      currentChain.callbackGasLimit,
      currentChain.interval,
    ]);

    const lotteryAddress = await lotteryContract.getAddress();
    log(`lotteryContract: ${lotteryAddress}`);

    await vrfCoordinatorV2_5MockContract.addConsumer(
      subscriptionId,
      lotteryAddress
    );

    signers = await ethers.getSigners();
  });

  it("Deploys and sets testing configs properly", async function () {
    assert.notEqual(currentChain, undefined);
    assert.notEqual(lotteryContract, undefined);
    assert.notEqual(vrfCoordinatorV2_5MockContract, undefined);
    assert.notEqual(signers, undefined);
    const getSubscriptionResponse =
      await vrfCoordinatorV2_5MockContract.getSubscription(subscriptionId);

    assert.equal(getSubscriptionResponse.subOwner, signers[0].address);
    assert.equal(getSubscriptionResponse.balance.toString(), MOCK_LINK);
  });

  describe("Join lottery test", function () {
    it("Cant join with less than entrance fee", async function () {
      const unacceptableLotteryFee = ethers.parseEther("0.01");
      await expect(
        lotteryContract.joinLottery({ value: unacceptableLotteryFee })
      ).to.be.revertedWithCustomError(
        lotteryContract,
        "Lottery__InvalidEntranceFee"
      );
    });
    it("Player is recorded in lottery after joining and LotteryJoined event is emitted", async function () {
      const trxResponse = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await trxResponse.wait(1);
      const filter = lotteryContract.filters.LotteryJoined;
      const events = await lotteryContract.queryFilter(filter, -1);
      const joinedEvent = events[0];
      const emittedValue = joinedEvent.args[0];
      assert.equal(joinedEvent.fragment.name, "LotteryJoined");
      assert.equal(emittedValue, signers[0].address);
      const playerFromContract = await lotteryContract.getPlayer(0);
      assert.equal(playerFromContract, signers[0].address);
    });
  });

  describe("Check upkeep test", function () {
    it("Check upkeep returns false if interval has not passed", async function () {
      const trxResponse = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await trxResponse.wait(1);
      const checkUpkeepResponse = await lotteryContract.checkUpkeep("0x");

      assert.equal(checkUpkeepResponse[0], false);

      await correctTimestampBy(currentChain.interval);
      const checkUpkeepResponse2 = await lotteryContract.checkUpkeep("0x");

      assert.equal(checkUpkeepResponse2[0], true);
    });
    it("Check upkeep return false if zero players joined and contract balance is 0", async function () {
      await network.provider.send("evm_increaseTime", [
        currentChain.interval + 1,
      ]);
      await network.provider.send("evm_mine", []);

      const checkUpkeepResponse = await lotteryContract.checkUpkeep("0x");

      assert.equal(checkUpkeepResponse[0], false);
      const trxResponse = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await trxResponse.wait(1);

      const checkUpkeepResponse2 = await lotteryContract.checkUpkeep("0x");

      assert.equal(checkUpkeepResponse2[0], true);
    });
  });

  describe("Perform upkeep test", function () {
    it("Reverts if checkUpkeep returns false", async function () {
      await expect(lotteryContract.performUpkeep("0x"))
        .to.be.revertedWithCustomError(
          lotteryContract,
          "Lottery__LotteryUpkeepNotNeeded"
        )
        .withArgs(0, 0, 0);
    });

    it("Contract state is changed to CALCULATING after successful performUpkeep", async function () {
      const trxResponse = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await trxResponse.wait(1);

      await correctTimestampBy(currentChain.interval);

      await lotteryContract.performUpkeep("0x");
      const state = await lotteryContract.getLotteryState();
      assert.equal(state, 1n);
    });

    it("Perform upkeep emits event", async function () {
      const joinLotteryResponse = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await joinLotteryResponse.wait(1);
      await correctTimestampBy(currentChain.interval);
      await lotteryContract.performUpkeep("0x");
      const lotteryRandomIdFilter = lotteryContract.filters.LotteryRandomId;
      const events = await lotteryContract.queryFilter(
        lotteryRandomIdFilter,
        -1
      );
      const emittedValue = events[0].args[0];

      assert.equal(emittedValue, 1n);
    });
  });

  describe("Fulfill random words test", function () {
    it("Chooses existing address randomly and resets parameters, emits LotteryWinnerPicked event", async function () {
      const lotteryAddress = await lotteryContract.getAddress();

      const players: string[] = [];
      for (let index = 0; index < 6; index++) {
        const connectedLottery = lotteryContract.connect(signers[index]);
        const joinLotteryResponse = await connectedLottery.joinLottery({
          value: ACCEPTABLE_LOTTERY_FEE,
        });
        await joinLotteryResponse.wait(1);
        players.push(signers[index].address);
        log(`player${index}: ${signers[index].address}`);
      }

      const startingTimestamp = await lotteryContract.getLatestTimestamp();

      await correctTimestampBy(currentChain.interval);

      await new Promise(async (resolve, reject) => {
        lotteryContract.once(
          lotteryContract.filters.LotteryWinnerPicked,
          async () => {
            try {
              const lotteryWinnerPickedFilter =
                lotteryContract.filters.LotteryWinnerPicked;
              const events = await lotteryContract.queryFilter(
                lotteryWinnerPickedFilter,
                -1
              );
              const winnerAddress = events[0].args[0];

              const recentWinner = await lotteryContract.getRecentWinner();
              log(`recentWinner: ${recentWinner}`);
              assert.equal(winnerAddress, recentWinner);
              const balance = await ethers.provider.getBalance(lotteryAddress);
              assert.equal(balance, 0n);
              const lotteryState = await lotteryContract.getLotteryState();
              assert.equal(lotteryState, 0n);
              const endingPlayers = await lotteryContract.getPlayers();
              assert.equal(endingPlayers.length, 0);
              const latestTimestamp =
                await lotteryContract.getLatestTimestamp();
              assert.equal(latestTimestamp > startingTimestamp, true);
              resolve("");
            } catch (err) {
              reject(err);
            }
          }
        );
        const tx = await lotteryContract.performUpkeep("0x");
        await tx.wait(1);
        const lotteryRandomIdFilter = lotteryContract.filters.LotteryRandomId;
        const events = await lotteryContract.queryFilter(
          lotteryRandomIdFilter,
          -1
        );
        const requestId = events[0].args[0];
        const trxResponse =
          await vrfCoordinatorV2_5MockContract.fulfillRandomWords(
            requestId,
            lotteryAddress
          );
        await trxResponse.wait(1);
      });
    });
  });
});
