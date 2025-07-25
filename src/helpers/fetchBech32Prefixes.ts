import axios from 'axios';
import { getPrefixes, prefixesNeedRefresh, savePrefixes } from './dataHelpers';
import { ChainData } from '@/types';

// TODO: delete this file?  may not be needed since we're grabbing prefix data from the cosmos registry
const SLIP_0173_URL = 'https://raw.githubusercontent.com/satoshilabs/slips/master/slip-0173.md';

export const fetchBech32Prefixes = async (): Promise<ChainData[]> => {
  const prefixStorage = getPrefixes();

  if (prefixStorage && !prefixesNeedRefresh(prefixStorage)) {
    return prefixStorage.data;
  }

  try {
    const response = await axios.get<string>(SLIP_0173_URL);
    const markdownContent = response.data;

    const chainData = parseBech32Markdown(markdownContent);
    savePrefixes(chainData);
    return chainData;
  } catch (error) {
    if (prefixStorage) {
      return prefixStorage.data;
    }

    return [];
  }
};

const parseBech32Markdown = (markdown: string): ChainData[] => {
  const lines: string[] = markdown.split('\n');
  const chains: ChainData[] = [];

  // Find the start of the table
  const tableStart = lines.findIndex(line =>
    /\|.*coin.*\|.*mainnet.*\|.*testnet.*\|.*regtest.*/i.test(line),
  );
  if (tableStart === -1) {
    return chains;
  }

  for (let i = tableStart + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('| --')) continue;

    const columns: string[] = line.split('|').map(col => col.trim().replace(/[`\\]/g, ''));
    if (columns.length < 4) continue;

    const coin: string = columns[1] || '';
    const mainnet: string = columns[2] || '';
    const testnet: string = columns[3] || mainnet;

    chains.push({
      coin,
      mainnet,
      testnet,
    });
  }

  return chains;
};
