import {
  NetworkLevel,
  STORED_DATA_TIMEOUT,
  SYMPHONY_MAINNET_ID,
  SYMPHONY_TESTNET_ID,
} from '@/constants';
import { getLocalStorageItem, setLocalStorageItem } from './localStorage';
import { decompressSync } from 'fflate';
import {
  AccountRecord,
  ChainRegistryRecord,
  SimplifiedChainInfo,
  LocalChainRegistry,
  Asset,
  Uri,
} from '@/types';

// TODO: also pull IBC information
// TODO: show status of download to user in topbar.  "checking for update", "querying for new chains", "updating chain information"
// TODO: change to use regularly updated json file for single file download (faster, lighter, less wasteful)
const REGISTRY_KEY = 'localChainRegistry';
const GITHUB_COMMIT_URL =
  'https://api.github.com/repos/Orchestra-Labs/cosmos-chain-registry/commits/master';
// NOTE: backup is required, as many don't seem to maintain their entries in the CosmosHub repository
const KEPLR_REGISTRY_URL =
  'https://api.github.com/repos/Orchestra-Labs/keplr-chain-registry/contents/cosmos';

type ChainRegistryFiles = {
  'chain.json'?: any;
  'assetlist.json'?: any;
  assets?: Record<string, Asset>;
};
export type ChainRegistryCache = Record<string, ChainRegistryFiles>;

const fetchKeplrRegistryData = async (): Promise<any[]> => {
  console.groupCollapsed('[fetchKeplrRegistryData] Fetching Keplr registry data');
  try {
    console.log('Fetching directory listing from:', KEPLR_REGISTRY_URL);
    const dirResponse = await fetch(KEPLR_REGISTRY_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'Cache-Control': 'no-cache',
      },
    });

    if (!dirResponse.ok) {
      console.error(`Directory fetch failed: ${dirResponse.status}`);
      return [];
    }

    const dirContents = await dirResponse.json();
    console.log('Directory contents received:', dirContents);

    if (!Array.isArray(dirContents)) {
      console.error('Directory contents is not an array:', dirContents);
      return [];
    }

    const jsonFiles = dirContents.filter((file: any) => {
      const isValid =
        file &&
        typeof file === 'object' &&
        file.type === 'file' &&
        typeof file.name === 'string' &&
        file.name.endsWith('.json') &&
        typeof file.download_url === 'string';

      if (!isValid) {
        console.warn('Skipping invalid file entry:', file);
      }
      return isValid;
    });

    console.log(`Found ${jsonFiles.length} valid JSON files to process`);

    const chainData = await Promise.all(
      jsonFiles.map(async (file: any) => {
        console.groupCollapsed(`[fetchChainFile] Processing ${file.name}`);
        try {
          console.log('Fetching file from:', file.download_url);
          const fileResponse = await fetch(file.download_url);

          if (!fileResponse.ok) {
            console.warn(`File fetch failed: ${fileResponse.status}`);
            return null;
          }

          const data = await fileResponse.json();
          console.log('File content received:', data);

          if (!data || typeof data !== 'object') {
            console.warn('Invalid JSON content');
            return null;
          }

          if (typeof data.chainId !== 'string') {
            console.warn('Missing or invalid chainId');
            return null;
          }

          if (typeof data.chainName !== 'string') {
            console.warn('Missing or invalid chainName');
            return null;
          }

          console.log('Valid chain data found');
          return data;
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          return null;
        } finally {
          console.groupEnd();
        }
      }),
    );

    const validChains = chainData.filter(Boolean);
    console.log(`Successfully fetched ${validChains.length} valid chain configurations`);
    return validChains;
  } catch (error) {
    console.error('Error in fetchKeplrRegistryData:', error);
    return [];
  } finally {
    console.groupEnd();
  }
};

const mergeKeplrData = (chainInfo: SimplifiedChainInfo, keplrData: any): SimplifiedChainInfo => {
  console.groupCollapsed(`[mergeKeplrData] Merging data for chain: ${chainInfo.chain_id}`);
  try {
    console.log('Original chainInfo:', chainInfo);
    console.log('Keplr data to merge:', keplrData);

    // Skip Symphony chains and invalid data
    if ([SYMPHONY_MAINNET_ID, SYMPHONY_TESTNET_ID].includes(chainInfo.chain_id)) {
      console.log('Skipping merge for Symphony chain');
      return chainInfo;
    }

    if (!keplrData) {
      console.warn('No Keplr data provided to merge');
      return chainInfo;
    }

    // Validate chainInfo structure
    if (!chainInfo || typeof chainInfo !== 'object') {
      console.error('Invalid chainInfo structure:', chainInfo);
      return chainInfo;
    }

    // Create safe URI objects with detailed logging
    const createUri = (url: unknown, providerName?: string): Uri => {
      console.groupCollapsed(`[createUri] Creating URI from:`, url);
      try {
        if (typeof url !== 'string') {
          console.warn(`URL is not a string:`, url);
          return {
            address: '',
            provider: providerName || 'Invalid',
          };
        }

        if (!url.startsWith('http')) {
          console.warn(`Invalid URL format (doesn't start with http):`, url);
          return {
            address: '',
            provider: providerName || 'Invalid',
          };
        }

        console.log(`Creating valid URI for:`, url);
        return {
          address: url,
          provider: providerName || 'Keplr',
        };
      } finally {
        console.groupEnd();
      }
    };

    // Extract provider info with validation
    const providerName = (() => {
      try {
        if (keplrData.nodeProvider && typeof keplrData.nodeProvider === 'object') {
          console.log('Found nodeProvider:', keplrData.nodeProvider);
          return typeof keplrData.nodeProvider.name === 'string'
            ? keplrData.nodeProvider.name
            : undefined;
        }
        console.log('No valid nodeProvider found');
        return undefined;
      } catch (error) {
        console.warn('Error extracting provider name:', error);
        return undefined;
      }
    })();

    // Extract bech32 prefix with validation
    const bech32Prefix = (() => {
      try {
        if (keplrData.bech32Config && typeof keplrData.bech32Config === 'object') {
          console.log('Found bech32Config:', keplrData.bech32Config);
          return typeof keplrData.bech32Config.bech32PrefixAccAddr === 'string'
            ? keplrData.bech32Config.bech32PrefixAccAddr
            : chainInfo.bech32_prefix;
        }
        console.log('Using default bech32 prefix');
        return chainInfo.bech32_prefix;
      } catch (error) {
        console.warn('Error extracting bech32 prefix:', error);
        return chainInfo.bech32_prefix;
      }
    })();

    // Log RPC URI processing
    const rpcUris = (() => {
      console.groupCollapsed('[RPC URIs] Processing RPC endpoints');
      try {
        if (typeof keplrData.rpc === 'string') {
          console.log('Processing Keplr RPC:', keplrData.rpc);
          const uri = createUri(keplrData.rpc, providerName);
          console.log('Created RPC URI:', uri);
          return [uri];
        }
        console.log('Using existing RPC URIs:', chainInfo.rpc_uris);
        return chainInfo.rpc_uris;
      } finally {
        console.groupEnd();
      }
    })();

    // Log REST URI processing
    const restUris = (() => {
      console.groupCollapsed('[REST URIs] Processing REST endpoints');
      try {
        if (typeof keplrData.rest === 'string') {
          console.log('Processing Keplr REST:', keplrData.rest);
          const uri = createUri(keplrData.rest, providerName);
          console.log('Created REST URI:', uri);
          return [uri];
        }
        console.log('Using existing REST URIs:', chainInfo.rest_uris);
        return chainInfo.rest_uris;
      } finally {
        console.groupEnd();
      }
    })();

    const mergedInfo = {
      ...chainInfo,
      rpc_uris: rpcUris,
      rest_uris: restUris,
      bech32_prefix: bech32Prefix,
    };

    console.log('Merged chain info:', mergedInfo);
    return mergedInfo;
  } catch (error) {
    console.error('Error in mergeKeplrData:', error);
    return chainInfo;
  } finally {
    console.groupEnd();
  }
};

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

function extractAssets(assetlist: any, chain: any): Record<string, Asset> {
  const feeTokens = new Set(
    chain?.fees?.fee_tokens?.map((f: any) => f.denom) ||
      chain?.feeCurrencies?.map((f: any) => f.coinMinimalDenom) ||
      [],
  );
  const networkName = chain.pretty_name || chain.chainName || 'Unknown';
  const networkID = chain.chain_id || chain.chainId || 'Unknown';

  const result: Record<string, Asset> = {};
  for (const asset of assetlist.assets || []) {
    // Handle both Cosmos registry and Keplr currency formats
    const isKeplrFormat = !!asset.coinMinimalDenom;
    const base = isKeplrFormat ? asset.coinMinimalDenom : asset.base;
    const symbol = isKeplrFormat ? asset.coinDenom : asset.symbol;
    const name = isKeplrFormat ? asset.coinDenom : asset.name || asset.symbol || 'Unknown';
    const logo = isKeplrFormat ? asset.coinImageUrl || '' : asset.logo_URIs?.png || '';
    const exponent = isKeplrFormat
      ? asset.coinDecimals ?? 6
      : asset.denom_units?.find((d: any) => d.denom === asset.display)?.exponent ?? 6;

    result[base] = {
      denom: base,
      amount: '0',
      exchangeRate: '-',
      isIbc: false,
      logo,
      symbol,
      name,
      exponent,
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

    const [commit, keplrData] = await Promise.all([
      fetchLatestChainRegistryCommit(),
      fetchKeplrRegistryData(),
    ]);

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
    const chainFiles: Record<string, ChainRegistryFiles> = {};
    const mainnetRegistry: LocalChainRegistry = {};
    const testnetRegistry: LocalChainRegistry = {};

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
      let chainName, file;

      if (parts[1] === 'testnets') {
        chainName = parts[2];
        file = parts[3] as 'chain.json' | 'assetlist.json';
      } else {
        chainName = parts[1];
        file = parts[2] as 'chain.json' | 'assetlist.json';
      }

      if (!chainName || !file || !['chain.json', 'assetlist.json'].includes(file)) continue;

      try {
        const content = JSON.parse(decoder.decode(decompressed.slice(contentStart, contentEnd)));
        const registryKey = parts[1] === 'testnets' ? `testnets/${chainName}` : chainName;

        if (!chainFiles[registryKey]) chainFiles[registryKey] = {};
        chainFiles[registryKey][file] = content;
      } catch (err) {
        console.warn(`Invalid JSON in ${name}`);
      }
    }

    const keplrDataMap = new Map<string, any>();
    if (keplrData && Array.isArray(keplrData)) {
      keplrData.forEach(chain => {
        keplrDataMap.set(chain.chainId, chain);
      });
    }

    // Fetch Keplr assets as fallback
    const keplrAssetsMap = new Map<string, Record<string, Asset>>();
    for (const chain of keplrData) {
      if (chain.currencies && Array.isArray(chain.currencies)) {
        const assets = extractAssets({ assets: chain.currencies }, chain);
        keplrAssetsMap.set(chain.chainId, assets);
      }
    }

    for (const registryKey of Object.keys(chainFiles)) {
      const entry = chainFiles[registryKey];
      if (entry['chain.json']) {
        // Try to get assets from GitHub chain registry first
        let assets: Record<string, Asset> = {};
        if (entry['assetlist.json']) {
          assets = extractAssets(entry['assetlist.json'], entry['chain.json']);
        } else {
          // Fallback to Keplr assets if GitHub assets are not available
          const chainId = entry['chain.json'].chain_id;
          assets = keplrAssetsMap.get(chainId) || {};
          console.log(
            `[ChainRegistry] No assets found in GitHub for ${chainId}, using Keplr assets:`,
            Object.keys(assets).length > 0 ? 'Found' : 'None',
          );
        }

        let info = extractChainInfo(entry['chain.json'], assets);

        const keplrChainData = keplrDataMap.get(info.chain_id);
        if (keplrChainData) {
          info = mergeKeplrData(info, keplrChainData);
        }

        const isTestnet = registryKey.startsWith('testnets/');
        const targetRegistry = isTestnet ? testnetRegistry : mainnetRegistry;

        targetRegistry[info.chain_id] = info;
      }
    }

    const payload: ChainRegistryRecord = {
      sha: commit,
      lastUpdated: new Date().toISOString(),
      data: {
        mainnet: mainnetRegistry,
        testnet: testnetRegistry,
      },
    };

    setLocalStorageItem(REGISTRY_KEY, JSON.stringify(payload));
    console.log(
      '[ChainRegistry] Stored flattened mainnet registry:',
      Object.keys(mainnetRegistry).length,
      'chains',
    );
    console.log(
      '[ChainRegistry] Stored flattened testnet registry:',
      Object.keys(testnetRegistry).length,
      'chains',
    );
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
  const subscriptions = account.settings.chainSubscriptions;
  console.log('[ChainRegistry] account subscriptions:', JSON.stringify(subscriptions));
  console.log('[ChainRegistry] registry chains:', Object.keys(registry));

  const result: LocalChainRegistry = {};

  for (const chainID in subscriptions) {
    const assets = subscriptions[chainID];
    console.log(`[ChainRegistry] Processing chainID: ${chainID}`);
    console.log(`[ChainRegistry] Looking for assets:`, assets);

    // Case-insensitive search
    const match = Object.values(registry).find(c => {
      const matchFound = c.chain_id.trim().toLowerCase() === chainID.trim().toLowerCase();
      // console.log(`[ChainRegistry] Comparing:
      //   Registry chain_id: ${c.chain_id}
      //   Looking for: ${chainID}
      //   Match: ${matchFound}`);
      return matchFound;
    });

    if (match) {
      console.log(`[ChainRegistry] Found match for ${chainID}:`, match.chain_id);
      // console.log(`[ChainRegistry] Available assets in match:`, Object.keys(match.assets || {}));

      const filteredAssets = Object.fromEntries(
        Object.entries(match.assets || {}).filter(([denom]) => {
          const included = assets.includes(denom);
          // console.log(`[ChainRegistry] Checking asset ${denom}: ${included}`);
          return included;
        }),
      );

      // console.log(`[ChainRegistry] Filtered assets:`, Object.keys(filteredAssets));

      result[match.chain_id] = {
        ...match,
        assets: filteredAssets,
      };
    } else {
      console.warn(`[ChainRegistry] No match found for chainID: ${chainID}`);
      console.log(
        `[ChainRegistry] Available chain_ids:`,
        Object.values(registry).map(c => c.chain_id),
      );
    }
  }

  return result;
};

export const extractChainInfo = (raw: any, assets?: Record<string, Asset>): SimplifiedChainInfo => {
  const networkLevel = raw.network_type === 'mainnet' ? NetworkLevel.MAINNET : NetworkLevel.TESTNET;

  const createUriFromApi = (endpoint: any): Uri => ({
    address: endpoint.address,
    provider: endpoint.provider || 'Unknown',
  });

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
    rpc_uris: raw.apis?.rpc?.map(createUriFromApi) || [],
    rest_uris: raw.apis?.rest?.map(createUriFromApi) || [],
    logo_uri: raw.logo_URIs?.png || raw.images?.find((img: any) => !!img.png)?.png || null,
    assets: assets ?? {},
  };
};
