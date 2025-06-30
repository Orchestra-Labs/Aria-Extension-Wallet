import { STORED_DATA_TIMEOUT } from '@/constants';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import { decompressSync } from 'fflate';

// TODO: show status of download to user in topbar.  "checking for update", "querying for new chains", "updating chain information"
// TODO: change to use regularly updated json file for single file download (faster, lighter, less wasteful)
const REGISTRY_KEY = 'cosmosChains';
const GITHUB_COMMIT_URL =
  'https://api.github.com/repos/Orchestra-Labs/cosmos-chain-registry/commits/master';

type StoredChainRegistry = {
  sha: string;
  lastUpdated: string;
  data: ChainRegistryCache;
};

export type ChainRegistryCache = Record<string, { 'chain.json': any }>;

export type SimplifiedChainInfo = {
  chain_name: string;
  status: string;
  network_type: string;
  pretty_name: string;
  chain_type: string;
  chain_id: string;
  bech32_prefix: string;
  fees?: any;
  staking?: any;
  persistent_peers?: any[];
  rpc_apis?: any[];
  rest_apis?: any[];
  logo_uri?: string;
};

export const getStoredChainRegistry = (): StoredChainRegistry | null => {
  const raw = getLocalStorageItem(REGISTRY_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse stored chain registry');
    return null;
  }
};

export const chainRegistryNeedsRefresh = (): boolean => {
  const stored = getStoredChainRegistry();
  if (!stored) return true;

  const lastCheckTime = new Date(stored.lastUpdated).getTime();
  return Date.now() - lastCheckTime >= STORED_DATA_TIMEOUT;
};

export const shouldUpdateChainRegistry = (): boolean => {
  const stored = getStoredChainRegistry();
  return !stored || chainRegistryNeedsRefresh();
};

export const fetchLatestChainRegistryCommit = async (): Promise<string | null> => {
  try {
    const response = await fetch(GITHUB_COMMIT_URL, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const data = await response.json();
    return data.sha;
  } catch (error) {
    console.error('Failed to fetch chain-registry commit:', error);
    return null;
  }
};

export const checkChainRegistryUpdate = async (): Promise<boolean> => {
  if (!chainRegistryNeedsRefresh()) return false;

  const latest = await fetchLatestChainRegistryCommit();
  if (!latest) return false;

  const stored = getStoredChainRegistry();
  const hasChanged = stored?.sha !== latest;

  if (hasChanged) {
    console.log('Chain-registry commit updated:', latest);
  } else {
    console.log('Chain-registry commit unchanged.');
  }

  return hasChanged;
};

export const fetchAndStoreChainRegistry = async (): Promise<void> => {
  try {
    console.log('[ChainRegistry] Starting full fetch & store');

    const commit = await fetchLatestChainRegistryCommit();
    if (!commit) throw new Error('Could not resolve latest commit');

    const archiveUrl = `https://codeload.github.com/Orchestra-Labs/cosmos-chain-registry/tar.gz/${commit}`;
    console.log('[ChainRegistry] Fetching archive from:', archiveUrl);

    const response = await fetch(archiveUrl);
    if (!response.ok) {
      const text = await response.text();
      console.error(`Failed to download tarball: ${response.status}`, text);
      throw new Error(`Tarball fetch failed`);
    }

    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const decompressed = decompressSync(new Uint8Array(buffer));

    const chainFiles: ChainRegistryCache = {};
    const decoder = new TextDecoder();

    let offset = 0;
    while (offset + 512 <= decompressed.length) {
      const name = new TextDecoder()
        .decode(decompressed.slice(offset, offset + 100))
        .replace(/\0.*$/, '');
      if (!name) break;

      const sizeOctal = new TextDecoder()
        .decode(decompressed.slice(offset + 124, offset + 136))
        .replace(/\0.*$/, '');
      const size = parseInt(sizeOctal.trim(), 8);
      const contentStart = offset + 512;
      const contentEnd = contentStart + size;

      if (name.endsWith('/chain.json')) {
        const parts = name.split('/');
        const chainName = parts[1];

        try {
          const content = JSON.parse(decoder.decode(decompressed.slice(contentStart, contentEnd)));
          chainFiles[chainName] = { 'chain.json': content };
        } catch (err) {
          console.warn(`Invalid JSON in ${name}`);
        }
      }

      const totalSize = 512 + Math.ceil(size / 512) * 512;
      offset += totalSize;
    }

    const payload: StoredChainRegistry = {
      sha: commit,
      lastUpdated: new Date().toISOString(),
      data: chainFiles,
    };

    setLocalStorageItem(REGISTRY_KEY, JSON.stringify(payload));
    console.log('Stored entire registry:', Object.keys(chainFiles).length, 'chains');
  } catch (err) {
    console.error('Failed to fetch and store full registry:', err);
  }
};

export const ensureChainRegistryExists = async (): Promise<void> => {
  const stored = getStoredChainRegistry();
  if (!stored) {
    console.log('[ChainRegistry] No registry found in localStorage, fetching...');
    await fetchAndStoreChainRegistry();
  }
};

export const listChainsByNetworkType = (
  registry: ChainRegistryCache,
  networkType: 'mainnet' | 'testnet',
): string[] => {
  return Object.entries(registry)
    .filter(([_, files]) => files['chain.json']?.network_type === networkType)
    .map(([chainName]) => chainName);
};

export const getChainsByNetworkType = (
  registry: ChainRegistryCache,
  networkType: 'mainnet' | 'testnet',
): any[] => {
  return Object.entries(registry)
    .filter(([_, files]) => files['chain.json']?.network_type === networkType)
    .map(([_, files]) => files['chain.json']);
};

export const extractChainInfo = (raw: any): SimplifiedChainInfo => {
  return {
    chain_name: raw.chain_name,
    status: raw.status,
    network_type: raw.network_type,
    pretty_name: raw.pretty_name,
    chain_type: raw.chain_type,
    chain_id: raw.chain_id,
    bech32_prefix: raw.bech32_prefix,
    fees: raw.fees,
    staking: raw.staking,
    persistent_peers: raw.peers?.persistent_peers ?? [],
    rpc_apis: raw.apis?.rpc ?? [],
    rest_apis: raw.apis?.rest ?? [],
    logo_uri: raw.logo_URIs?.png || raw.images?.find((img: any) => !!img.png)?.png || null,
  };
};
