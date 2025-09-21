import axios from 'axios';
import { ChainRegistryData, CommitHashes, IbcRegistryRecord } from '@/types';
import { processIbcData } from './ibcUtils';
import { decompressSync } from 'fflate';

const GITHUB_API_BASE = 'https://api.github.com/repos/Orchestra-Labs/cosmos-chain-registry';
const GITHUB_COMMIT_URL = `${GITHUB_API_BASE}/commits`;

export const getLatestCommitHashes = async (): Promise<CommitHashes> => {
  try {
    const [mainnetResponse, testnetResponse] = await Promise.all([
      axios.get(`${GITHUB_COMMIT_URL}?path=_IBC&per_page=1`),
      axios.get(`${GITHUB_COMMIT_URL}?path=testnets/_IBC&per_page=1`),
    ]);

    return {
      mainnetHash: mainnetResponse.data[0]?.sha || '',
      testnetHash: testnetResponse.data[0]?.sha || '',
    };
  } catch (error) {
    console.error('Failed to fetch commit hashes:', error);
    return {
      mainnetHash: '',
      testnetHash: '',
    };
  }
};

export const fetchIbcRegistry = async (
  chainRegistry: ChainRegistryData,
  commitHashes: CommitHashes,
): Promise<IbcRegistryRecord> => {
  try {
    // Fetch both mainnet and testnet IBC data in parallel
    const [mainnetTarball, testnetTarball] = await Promise.all([
      axios.get(
        `https://codeload.github.com/Orchestra-Labs/cosmos-chain-registry/tar.gz/${commitHashes.mainnetHash}`,
        {
          responseType: 'arraybuffer',
          params: {
            // Only include the _IBC directory
            dir: '_IBC',
          },
        },
      ),
      axios.get(
        `https://codeload.github.com/Orchestra-Labs/cosmos-chain-registry/tar.gz/${commitHashes.testnetHash}`,
        {
          responseType: 'arraybuffer',
          params: {
            // Only include the testnets/_IBC directory
            dir: 'testnets/_IBC',
          },
        },
      ),
    ]);

    // Process tarballs
    const processTarball = (buffer: ArrayBuffer) => {
      const decompressed = decompressSync(new Uint8Array(buffer));
      const decoder = new TextDecoder();
      const files: any[] = [];

      let offset = 0;
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

        try {
          const content = JSON.parse(decoder.decode(decompressed.slice(contentStart, contentEnd)));
          files.push(content);
        } catch (error) {
          console.warn(`Failed to parse JSON in ${name}:`, error);
        }
      }

      return files;
    };

    const [mainnetFiles, testnetFiles] = await Promise.all([
      processTarball(mainnetTarball.data),
      processTarball(testnetTarball.data),
    ]);

    // Process the files
    const [mainnetIbc, testnetIbc] = await Promise.all([
      processIbcData(mainnetFiles, chainRegistry.mainnet),
      processIbcData(testnetFiles, chainRegistry.testnet),
    ]);

    const registry: IbcRegistryRecord = {
      data: {
        mainnet: mainnetIbc || {},
        testnet: testnetIbc || {},
      },
      lastUpdated: new Date().toISOString(),
      commitHashes,
    };

    return registry;
  } catch (error) {
    console.error('[IBC] Failed to fetch and process registry:', error);
    throw error;
  }
};
