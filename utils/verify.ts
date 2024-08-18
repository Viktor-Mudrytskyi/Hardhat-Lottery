import { run } from "hardhat";
async function verify(contractAddress: string, args?: string[]): Promise<void> {
  console.log("Verifying contract...");
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    });
  } catch (e) {
    console.log(e);
  }
}

export { verify };
