import { NetworkLevel, STORED_DATA_TIMEOUT } from '@/constants';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import { decompressSync } from 'fflate';
import {
  AccountRecord,
  ChainRegistryRecord,
  SimplifiedChainInfo,
  LocalChainRegistry,
} from '@/types';

// TODO: pull in testnets as well
// TODO: also pull IBC information
// TODO: show status of download to user in topbar.  "checking for update", "querying for new chains", "updating chain information"
// TODO: change to use regularly updated json file for single file download (faster, lighter, less wasteful)
const REGISTRY_KEY = 'localChainRegistry';
const GITHUB_COMMIT_URL =
  'https://api.github.com/repos/Orchestra-Labs/cosmos-chain-registry/commits/master';

export type ChainRegistryCache = Record<
  string,
  {
    'chain.json'?: any;
    'assetlist.json'?: any;
    assets?: Record<string, any>;
  }
>;

export const getStoredChainRegistry = (): ChainRegistryRecord | null => {
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

function extractAssets(assetlist: any, chain: any): Record<string, any> {
  const feeTokens = new Set(chain?.fees?.fee_tokens?.map((f: any) => f.denom));
  const networkName = chain.pretty_name;
  const networkID = chain.chain_id;

  const result: Record<string, any> = {};
  for (const asset of assetlist.assets || []) {
    const base = asset.base;
    const displayUnit = asset.denom_units?.find((d: any) => d.denom === asset.symbol.toLowerCase());
    result[base] = {
      denom: base,
      amount: '1',
      isIbc: false,
      logo: asset.logo_URIs?.png,
      symbol: asset.symbol,
      name: asset.name,
      exponent: displayUnit?.exponent ?? 0,
      isFeeToken: feeTokens.has(base),
      networkName,
      networkID,
    };
  }

  return result;
}

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
    const decoder = new TextDecoder();

    let offset = 0;
    const chainFiles: Record<
      string,
      { 'chain.json'?: any; 'assetlist.json'?: any; assets?: Record<string, any> }
    > = {};
    const simplifiedRegistry: LocalChainRegistry = {};

    while (offset + 512 <= decompressed.length) {
      const name = decoder.decode(decompressed.slice(offset, offset + 100)).replace(/\0.*$/, '');
      if (!name) break;

      const sizeOctal = decoder
        .decode(decompressed.slice(offset + 124, offset + 136))
        .replace(/\0.*$/, '');
      const size = parseInt(sizeOctal.trim(), 8);
      const contentStart = offset + 512;
      const contentEnd = contentStart + size;
      const totalSize = 512 + Math.ceil(size / 512) * 512;
      offset += totalSize;

      if (!name.endsWith('.json')) continue;
      const parts = name.split('/');
      const chainName = parts[1];
      const file = parts[2] as 'chain.json' | 'assetlist.json';
      if (!chainName || !file || !['chain.json', 'assetlist.json'].includes(file)) continue;

      try {
        const content = JSON.parse(decoder.decode(decompressed.slice(contentStart, contentEnd)));
        if (!chainFiles[chainName]) chainFiles[chainName] = {};
        chainFiles[chainName][file] = content;
      } catch (err) {
        console.warn(`Invalid JSON in ${name}`);
      }
    }

    for (const chainName of Object.keys(chainFiles)) {
      const entry = chainFiles[chainName];
      if (entry['chain.json'] && entry['assetlist.json']) {
        entry.assets = extractAssets(entry['assetlist.json'], entry['chain.json']);
      }

      if (entry['chain.json']) {
        simplifiedRegistry[chainName] = extractChainInfo(entry['chain.json'], entry.assets ?? {});
      }
    }

    const payload: ChainRegistryRecord = {
      sha: commit,
      lastUpdated: new Date().toISOString(),
      data: simplifiedRegistry,
    };

    setLocalStorageItem(REGISTRY_KEY, JSON.stringify(payload));
    console.log('Stored flattened registry:', Object.keys(simplifiedRegistry).length, 'chains');
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
): SimplifiedChainInfo[] => {
  return Object.entries(registry)
    .filter(([_, files]) => files['chain.json']?.network_type === networkType)
    .map(([_, files]) => extractChainInfo(files['chain.json'], files.assets));
};

export const filterChainRegistryToSubscriptions = (
  registry: LocalChainRegistry,
  account: AccountRecord,
): LocalChainRegistry => {
  const subscriptions = account.settings.subscribedTo;
  console.log('[ChainRegistry] account subscriptions:', subscriptions);

  const result: LocalChainRegistry = {};

  for (const chainID in subscriptions) {
    const assets = subscriptions[chainID];
    console.log(`[ChainRegistry] assets: for ${chainID}: ${assets}`);

    // TODO: seems this is only matching mainnets, not testnets.  pull in testnets as well
    const match = Object.values(registry).find(
      c => c.chain_id.trim().toLowerCase() === chainID.trim().toLowerCase(),
    );
    console.log(
      '[ChainRegistry] registry chain_ids:',
      Object.values(registry).map(c => c.chain_id),
    );
    console.log(`[ChainRegistry] match?: ${JSON.stringify(match)}}`);

    if (match) {
      result[match.chain_name] = {
        ...match,
        assets: Object.fromEntries(
          Object.entries(match.assets || {}).filter(([k]) => assets.includes(k)),
        ),
      };
    }
  }

  return result;
};

export const extractChainInfo = (raw: any, assets?: Record<string, any>): SimplifiedChainInfo => {
  const networkLevel = raw.network_type === 'mainnet' ? NetworkLevel.MAINNET : NetworkLevel.TESTNET;

  return {
    chain_name: raw.chain_name,
    status: raw.status,
    network_level: networkLevel,
    pretty_name: raw.pretty_name,
    chain_type: raw.chain_type,
    chain_id: raw.chain_id,
    bech32_prefix: raw.bech32_prefix,
    fees: raw.fees,
    staking: raw.staking,
    rpc_uris: raw.apis?.rpc ?? [],
    rest_uris: raw.apis?.rest ?? [],
    logo_uri: raw.logo_URIs?.png || raw.images?.find((img: any) => !!img.png)?.png || null,
    assets: assets ?? {},
  };
};
