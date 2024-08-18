import { ethers, network } from "hardhat";
import { NetworkInterface } from "../../configs/network_interface";
import { chainIdToSupportedNetworks } from "../../configs/supported_networks";
import { Lottery, VRFCoordinatorV2_5Mock } from "../../typechain";
import { expect, assert } from "chai";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { log } from "console";
import { correctTimestampBy } from "../../utils/hardhat-network-utils";

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
      const lastTimestamp = await lotteryContract.getLatestTimestamp();
      lotteryContract = lotteryContract.connect(signers[1]);
      const joinLotteryResponse1 = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await joinLotteryResponse1.wait(1);
      const player1 = await lotteryContract.getPlayer(0);
      log(`player1: ${player1}`);

      lotteryContract = lotteryContract.connect(signers[0]);
      const joinLotteryResponse2 = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await joinLotteryResponse2.wait(1);
      const player2 = await lotteryContract.getPlayer(1);
      log(`player2: ${player2}`);

      lotteryContract = lotteryContract.connect(signers[2]);
      const joinLotteryResponse3 = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await joinLotteryResponse3.wait(1);
      const player3 = await lotteryContract.getPlayer(2);
      log(`player3: ${player3}`);

      lotteryContract = lotteryContract.connect(signers[3]);
      const joinLotteryResponse4 = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await joinLotteryResponse4.wait(1);
      const player4 = await lotteryContract.getPlayer(3);
      log(`player4: ${player4}`);

      lotteryContract = lotteryContract.connect(signers[4]);
      const joinLotteryResponse5 = await lotteryContract.joinLottery({
        value: ACCEPTABLE_LOTTERY_FEE,
      });
      await joinLotteryResponse5.wait(1);
      const player5 = await lotteryContract.getPlayer(4);
      log(`player5: ${player5}`);

      // lotteryContract = lotteryContract.connect(signers[5]);
      // const joinLotteryResponse6 = await lotteryContract.joinLottery({
      //   value: ACCEPTABLE_LOTTERY_FEE,
      // });
      // await joinLotteryResponse5.wait(1);
      // const player6 = await lotteryContract.getPlayer(5);
      // log(`player6: ${player6}`);

      await correctTimestampBy(currentChain.interval);
      lotteryContract = lotteryContract.connect(signers[0]);
      await lotteryContract.performUpkeep("0x");
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
      trxResponse.wait(1);

      const lotteryWinnerPickedFilter =
        lotteryContract.filters.LotteryWinnerPicked;
      const events2 = await lotteryContract.queryFilter(
        lotteryWinnerPickedFilter,
        -1
      );
      const winnerAddress = events2[0].args[0];
      log(`Winner: ${winnerAddress}`);

      const signerAddresses = signers.map((signer) => signer.address);

      assert.equal(signerAddresses.includes(winnerAddress), true);

      const recentWinner = await lotteryContract.getRecentWinner();
      assert.equal(winnerAddress, recentWinner);
      const balance = await ethers.provider.getBalance(lotteryAddress);
      assert.equal(balance, 0n);
      const lotteryState = await lotteryContract.getLotteryState();
      assert.equal(lotteryState, 0n);
      const players = await lotteryContract.getPlayers();
      assert.equal(players.length, 0);
      const latestTimestamp = await lotteryContract.getLatestTimestamp();
      assert.notEqual(latestTimestamp, lastTimestamp);

      async function testAgain() {
        const lotteryAddress = await lotteryContract.getAddress();
        const lastTimestamp = await lotteryContract.getLatestTimestamp();
        lotteryContract = lotteryContract.connect(signers[1]);
        const joinLotteryResponse1 = await lotteryContract.joinLottery({
          value: ACCEPTABLE_LOTTERY_FEE,
        });
        await joinLotteryResponse1.wait(1);
        const player1 = await lotteryContract.getPlayer(0);
        log(`player1: ${player1}`);

        lotteryContract = lotteryContract.connect(signers[0]);
        const joinLotteryResponse2 = await lotteryContract.joinLottery({
          value: ACCEPTABLE_LOTTERY_FEE,
        });
        await joinLotteryResponse2.wait(1);
        const player2 = await lotteryContract.getPlayer(1);
        log(`player2: ${player2}`);

        lotteryContract = lotteryContract.connect(signers[2]);
        const joinLotteryResponse3 = await lotteryContract.joinLottery({
          value: ACCEPTABLE_LOTTERY_FEE,
        });
        await joinLotteryResponse3.wait(1);
        const player3 = await lotteryContract.getPlayer(2);
        log(`player3: ${player3}`);

        lotteryContract = lotteryContract.connect(signers[3]);
        const joinLotteryResponse4 = await lotteryContract.joinLottery({
          value: ACCEPTABLE_LOTTERY_FEE,
        });
        await joinLotteryResponse4.wait(1);
        const player4 = await lotteryContract.getPlayer(3);
        log(`player4: ${player4}`);

        lotteryContract = lotteryContract.connect(signers[4]);
        const joinLotteryResponse5 = await lotteryContract.joinLottery({
          value: ACCEPTABLE_LOTTERY_FEE,
        });
        await joinLotteryResponse5.wait(1);
        const player5 = await lotteryContract.getPlayer(4);
        log(`player5: ${player5}`);

        lotteryContract = lotteryContract.connect(signers[5]);
        const joinLotteryResponse6 = await lotteryContract.joinLottery({
          value: ACCEPTABLE_LOTTERY_FEE,
        });
        await joinLotteryResponse5.wait(1);
        const player6 = await lotteryContract.getPlayer(5);
        log(`player6: ${player6}`);

        await correctTimestampBy(currentChain.interval);
        lotteryContract = lotteryContract.connect(signers[0]);
        await lotteryContract.performUpkeep("0x");
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
        trxResponse.wait(1);

        const lotteryWinnerPickedFilter =
          lotteryContract.filters.LotteryWinnerPicked;
        const events2 = await lotteryContract.queryFilter(
          lotteryWinnerPickedFilter,
          -1
        );
        const winnerAddress = events2[0].args[0];
        log(`Winner: ${winnerAddress}`);

        const signerAddresses = signers.map((signer) => signer.address);

        assert.equal(signerAddresses.includes(winnerAddress), true);

        const recentWinner = await lotteryContract.getRecentWinner();
        assert.equal(winnerAddress, recentWinner);
        const balance = await ethers.provider.getBalance(lotteryAddress);
        assert.equal(balance, 0n);
        const lotteryState = await lotteryContract.getLotteryState();
        assert.equal(lotteryState, 0n);
        const players = await lotteryContract.getPlayers();
        assert.equal(players.length, 0);
        const latestTimestamp = await lotteryContract.getLatestTimestamp();
        assert.notEqual(latestTimestamp, lastTimestamp);
      }
    });
  });
});
