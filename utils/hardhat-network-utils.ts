import { network } from "hardhat";

export async function correctTimestampBy(interval: string) {
  await network.provider.send("evm_increaseTime", [interval + 1]);
  await network.provider.send("evm_mine", []);
}
