export interface NetworkInterface {
  name: string;
  deployName: string;
  rpcUrl?: string;
  chainId: number;
  vrfCoordinator?: string;
  entranceFeeEth: string;
  isLocal: boolean;
  gasLane: string;
  VrfSubscriptionId?: string;
  callbackGasLimit: string;
  interval: string;
}
