export interface IbcConnection {
  client_id: string;
  connection_id: string;
  channel_id: string;
}

export interface IbcRegistry {
  [chainPair: string]: {
    [chainId: string]: IbcConnection;
  };
}

export interface IbcRegistryData {
  mainnet: IbcRegistry;
  testnet: IbcRegistry;
}

export interface CommitHashes {
  mainnetHash: string;
  testnetHash: string;
}

export interface IbcRegistryRecord {
  data: IbcRegistryData;
  lastUpdated: string;
  commitHashes: CommitHashes;
}
