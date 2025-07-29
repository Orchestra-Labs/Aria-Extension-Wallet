export interface CosmosChainInfo {
  chainId: string;
  name: string;
  logo: string;
  rgb: string;
  rpc: string;
  namespace: string;
  // Add other relevant chain properties
}

export type CosmosChains = Record<string, CosmosChainInfo>;
