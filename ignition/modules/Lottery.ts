import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LotteryModule", (m) => {
  const lottery = m.contract("Lottery", [
    10,
    "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
  ]);
  return { lottery };
});
