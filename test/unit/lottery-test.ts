import { ethers, ignition, network } from "hardhat";
import { chainIdToSupportedNetworks } from "../../networks/supported_networks";
import LotteryModule from "../../ignition/modules/Lottery";
import { log } from "console";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { Lottery, VRFCoordinatorV2Mock } from "../../typechain";
import VRFCoordinatorV2MockModule from "../../ignition/modules/mock/VRFCoordinatorV2Mock";

const chain = chainIdToSupportedNetworks[network.config.chainId || -1];

chain === undefined || !chain.isLocal
  ? describe.skip
  : describe("Lottery Unit Tests", function () {
      let lotteryContract: Lottery;
      let lotteryAddress: string;
      let deployer: HardhatEthersSigner;
      let signers: HardhatEthersSigner[];
      let entranceFee: bigint;
      let vrfCoordinatorMockContract: VRFCoordinatorV2Mock;

      this.beforeEach(async function () {
        const ignitedLottery = await ignition.deploy(LotteryModule);
        lotteryContract = await ethers.getContractAt(
          "Lottery",
          ignitedLottery.lottery
        );

        vrfCoordinatorMockContract = await ethers.getContractAt(
          "VRFCoordinatorV2Mock",
          ignitedLottery.vrfCoordinatorMock!
        );
        signers = await ethers.getSigners();
        lotteryAddress = await lotteryContract.getAddress();
        entranceFee = await lotteryContract.getEntranceFee();
        deployer = await signers[0];

        log(`Lottery deployed at ${lotteryAddress}`);
        log(`VRF deployed at ${await vrfCoordinatorMockContract.getAddress()}`);
      });

      describe("constructor", function () {
        it("initializes the lottery correctly", async function () {
          const lotteryState = await lotteryContract.getLotteryState();
          const interval = await lotteryContract.getInterval();
          assert.equal(lotteryState.toString(), "0");
          assert.equal(interval.toString(), chain.interval);
        });
      });

      describe("enterLottery", function () {
        it("reverts when you don't send enough ETH", async function () {
          await expect(
            lotteryContract.joinLottery()
          ).to.be.revertedWithCustomError(
            lotteryContract,
            "Lottery__InvalidEntranceFee"
          );
        });

        it("Records players when they enter", async function () {
          await lotteryContract.joinLottery({ value: entranceFee });
          const playerFromContract = await lotteryContract.getPlayer(0);
          assert.equal(playerFromContract, deployer.address);
        });

        it("Emits an event when a player enters", async function () {
          await expect(lotteryContract.joinLottery({ value: entranceFee }))
            .to.emit(lotteryContract, "LotteryJoined")
            .withArgs(deployer.address);
        });

        it("Doesn't allow entrance when lottery is calculating", async function () {
          await lotteryContract.joinLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [chain.interval + 1]);
          await network.provider.send("evm_mine", []);
          await lotteryContract.performUpkeep(ethers.randomBytes(0));
          await expect(
            lotteryContract.joinLottery({ value: entranceFee })
          ).to.be.revertedWithCustomError(
            lotteryContract,
            "Lottery__NotOpened"
          );
        });
      });

      describe("checkUpkeep", function () {
        it("returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [chain.interval + 1]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await lotteryContract.checkUpkeep("0x");
          assert(!upkeepNeeded);
        });

        it("returns false if lottery isn't open", async function () {
          await lotteryContract.joinLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [chain.interval + 1]);
          await network.provider.send("evm_mine", []);
          await lotteryContract.performUpkeep(ethers.randomBytes(0));
          const lotteryState = await lotteryContract.getLotteryState();
          const { upkeepNeeded } = await lotteryContract.checkUpkeep("0x");
          assert.equal(upkeepNeeded, false);
          assert.equal(lotteryState.toString(), "1");
        });
      });

      describe("performUpkeep", function () {
        it("Can only run if checkUpkeep is true", async function () {
          await lotteryContract.joinLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [chain.interval + 1]);
          await network.provider.send("evm_mine", []);
          const tx = await lotteryContract.performUpkeep("0x");
          assert(tx);
        });

        it("Reverts if checkUpkeep is false", async function () {
          await expect(
            lotteryContract.performUpkeep("0x")
          ).to.be.revertedWithCustomError(
            lotteryContract,
            "Lottery__LotteryUpkeepNotNeeded"
          );
        });

        it("Updates the lottery state, emits an event, and calls the VRF coordinator", async function () {
          await lotteryContract.joinLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [chain.interval + 1]);
          await network.provider.send("evm_mine", []);
          const txResponse = await lotteryContract.performUpkeep("0x");
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt?.logs[1].topics[1] || "-1";
          log(`requestId: ${requestId}`);
          const lotteryState = await lotteryContract.getLotteryState();
          assert(parseInt(requestId) > 0);
          assert(lotteryState.toString() == "1");
        });
      });

      describe("fulfillRandomWords", function () {
        beforeEach(async function () {
          await lotteryContract.joinLottery({ value: entranceFee });
          await network.provider.send("evm_increaseTime", [chain.interval + 1]);
          await network.provider.send("evm_mine", []);
        });

        it("Can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorMockContract.fulfillRandomWords(0, lotteryAddress)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorMockContract.fulfillRandomWords(1, lotteryAddress)
          ).to.be.revertedWith("nonexistent request");
        });
      });
    });

module.exports.tags = ["Unit", "All"];
