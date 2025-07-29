import {
  DEFAULT_WC_NAMESPACE,
  DEFAULT_WC_RGB,
  LOCAL_CHAIN_REGISTRY,
  NetworkLevel,
} from '@/constants';
import { SimplifiedChainInfo } from '@/types';
import { CosmosChainInfo } from '@/types/walletConnect';
import { IWalletKit, WalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';

export let walletkit: IWalletKit;

export async function createWalletKit() {
  if (walletkit) return walletkit;

  const core = new Core({
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  });

  walletkit = await WalletKit.init({
    core,
    metadata: {
      name: 'Aria Wallet',
      description: 'Cosmos-oriented multi-chain wallet',
      url: 'chrome-extension://jmcdoggondondkjlmbbommdgcncgaclp',
      icons: ['https://orchestralabs.org/favicon.ico'],
    },
    signConfig: {
      disableRequestQueue: true,
    },
  });

  const clientId = await walletkit.engine.signClient.core.crypto.getClientId();
  console.log(`WalletKit initialized with Client ID: ${clientId}`);
  return walletkit;
}

export const formatChainIdForWC = (chainId: string, namespace = 'cosmos') => {
  return `${namespace}:${chainId}`;
};

export const convertToCosmosChainInfo = (
  chainId: string,
  chainInfo: SimplifiedChainInfo,
): CosmosChainInfo => {
  return {
    chainId,
    name: chainInfo.pretty_name,
    logo: chainInfo.logo_uri || '',
    rgb: DEFAULT_WC_RGB,
    rpc: chainInfo.rpc_uris[0]?.address || '', // TODO: change to take best URI
    namespace: DEFAULT_WC_NAMESPACE,
  };
};

export const getCosmosChainsFromRegistry = (
  registry: {
    mainnet: Record<string, SimplifiedChainInfo>;
    testnet: Record<string, SimplifiedChainInfo>;
  },
  networkLevel: NetworkLevel = NetworkLevel.MAINNET,
): Record<string, CosmosChainInfo> => {
  const chains = registry?.[networkLevel] ?? LOCAL_CHAIN_REGISTRY[networkLevel];
  const result: Record<string, CosmosChainInfo> = {};

  for (const [chainId, chainInfo] of Object.entries(chains)) {
    try {
      result[formatChainIdForWC(chainId)] = convertToCosmosChainInfo(chainId, chainInfo);
    } catch (error) {
      // Skip invalid chains but continue processing others
      console.error(`Failed to convert chain ${chainId}:`, error);
    }
  }

  return result;
};
