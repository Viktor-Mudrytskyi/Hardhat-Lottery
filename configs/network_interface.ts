export interface NetworkInterface {
  name: string;
  deployName: string;
  rpcUrl?: string;
  chainId: number;
  vrfCoordinator?: string;
  entranceFeeEth: string;
  isLocal: boolean;
  gasLane: string;
  vrfSubscriptionId?: string;
  callbackGasLimit: string;
  interval: string;
}
