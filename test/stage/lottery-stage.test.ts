import { ethers, ignition, network } from "hardhat";
import { NetworkInterface } from "../../configs/network_interface";
import { chainIdToSupportedNetworks } from "../../configs/supported_networks";
import { Lottery } from "../../typechain";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { assert } from "chai";
import { log } from "console";

describe("Lottery Stage Tests", function () {
  let currentChain: NetworkInterface;
  let deployer: string;
  let lotteryContract: Lottery;
  let signers: HardhatEthersSigner[];
  const lotteryAdress = "0xB5F9130C04284076e8a55009551f3a9B1b5fcF50";

  before(function () {
    const chain: NetworkInterface | undefined =
      chainIdToSupportedNetworks[network.config.chainId || -1];
    if (chain === undefined) {
      throw new Error("Network not defined or is local");
    }
    if (chain.isLocal) {
      throw new Error("Network is local, cannot perform staging tests");
    }
    currentChain = chain;
  });

  beforeEach(async function () {
    signers = await ethers.getSigners();
    deployer = signers[0].address;
    lotteryContract = await ethers.getContractAt("Lottery", lotteryAdress);
  });

  describe("Fulfill random words test", function () {
    it("Chooses existing address randomly and resets parameters, emits LotteryWinnerPicked event", async function () {
      const startingTimestamp = await lotteryContract.getLatestTimestamp();

      await new Promise(async (resolve, reject) => {
        lotteryContract.once(
          lotteryContract.filters.LotteryWinnerPicked,
          async () => {
            console.log("LotteryWinnerPicked");
            try {
              const lotteryWinnerPickedFilter =
                lotteryContract.filters.LotteryWinnerPicked;
              const events = await lotteryContract.queryFilter(
                lotteryWinnerPickedFilter,
                -1
              );
              const winnerAddress = events[0].args[0];
              const recentWinner = await lotteryContract.getRecentWinner();

              assert.equal(winnerAddress, recentWinner);
              const balance = await ethers.provider.getBalance(
                await lotteryContract.getAddress()
              );
              assert.equal(balance, 0n);
              const lotteryState = await lotteryContract.getLotteryState();
              assert.equal(lotteryState, 0n);
              const endingPlayers = await lotteryContract.getPlayers();
              assert.equal(endingPlayers.length, 0);
              const latestTimestamp =
                await lotteryContract.getLatestTimestamp();
              assert.equal(latestTimestamp > startingTimestamp, true);
              resolve("");
            } catch (error) {
              reject(error);
            }
          }
        );
        await lotteryContract.joinLottery({
          value: ethers.parseEther(currentChain.entranceFeeEth),
        });
        const winnerStartingBalance = await ethers.provider.getBalance(
          deployer
        );
      });
    });
  });
});
