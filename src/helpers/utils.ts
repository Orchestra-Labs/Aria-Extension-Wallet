import { Asset, SimplifiedChainInfo, TransactionDetails, TransactionState } from '@/types';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  DEFAULT_MAINNET_ASSET,
  DEFAULT_TESTNET_ASSET,
  NetworkLevel,
  SYMPHONY_MAINNET_ID,
  SYMPHONY_TESTNET_ID,
  TextFieldStatus,
  TransactionType,
} from '@/constants';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs, { strict: false }));
};

export const convertToGreaterUnit = (amount: number, exponent: number): number => {
  return amount / Math.pow(10, exponent);
};

export const selectTextColorByStatus = (status: string, defaultColor: string = 'text-white') => {
  let textColor = defaultColor;

  if (status === TextFieldStatus.WARN) {
    textColor = 'text-warning';
  } else if (status === TextFieldStatus.ERROR) {
    textColor = 'text-error';
  }

  return textColor;
};

export const isValidUrl = (url: string): boolean => {
  const urlPattern = new RegExp(
    '^(https?:\\/\\/)?' + // protocol
      '((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|' + // domain name
      '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR IP (v4) address
      '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+]*)*' + // port and path
      '(\\?[;&a-zA-Z\\d%_.~+=-]*)?' + // query string
      '(\\#[-a-zA-Z\\d_]*)?$', // fragment locator
    'i',
  );

  return !!urlPattern.test(url);
};

// Validate numeric input and restrict to selectedAsset.exponent decimal places
export const getRegexForDecimals = (exponent: number) => {
  return new RegExp(`^\\d*\\.?\\d{0,${exponent}}$`);
};

export const calculateRemainingTime = (completionTime: string): string => {
  const now = new Date();
  const endTime = new Date(completionTime);
  const remainingMs = endTime.getTime() - now.getTime();

  if (remainingMs <= 0) return 'Unbonding Complete';

  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${days}d ${hours}h ${minutes}m`;
};

export const getPrimaryFeeToken = (chain: SimplifiedChainInfo): Asset | null => {
  if (!chain?.assets) {
    console.warn('[Utils] No assets found for chain:', chain?.chain_id);
    return null;
  }

  // First try to find an asset that matches the first fee token denom
  const chainFeeList = chain.fees || [];
  if (chainFeeList.length > 0) {
    const primaryFeeDenom = chainFeeList[0].denom;
    const matchingAsset = Object.values(chain.assets).find(
      asset => asset.denom === primaryFeeDenom, // check against current denom
    );

    if (matchingAsset) {
      console.log(`[Utils] Found fee token for chain ${chain.chain_id}:`, primaryFeeDenom);
      return matchingAsset;
    }
  }

  // Then try to find an asset marked as isFeeToken
  const feeTokenAsset = Object.values(chain.assets).find(asset => asset.isFeeToken);
  if (feeTokenAsset) {
    console.log(`[Utils] Found isFeeToken asset for chain ${chain.chain_id}:`, feeTokenAsset.denom);
    return feeTokenAsset;
  }

  // Fallback to the first asset if no fee token is found
  const firstAsset = Object.values(chain.assets)[0];
  if (firstAsset) {
    console.log(
      `[Utils] Using first asset as fallback for chain ${chain.chain_id}:`,
      firstAsset.denom, // check against current denom
    );
    return firstAsset;
  }

  console.warn(`[Utils] No suitable fee token found for chain ${chain.chain_id}`);
  return null;
};

export function getSymphonyChainId(networkLevel: NetworkLevel): string {
  return networkLevel === NetworkLevel.MAINNET ? SYMPHONY_MAINNET_ID : SYMPHONY_TESTNET_ID;
}

export function getSymphonyDefaultAsset(networkLevel: NetworkLevel): Asset {
  return networkLevel === NetworkLevel.MAINNET ? DEFAULT_MAINNET_ASSET : DEFAULT_TESTNET_ASSET;
}

export const categorizeTransaction = async ({
  sendAddress,
  recipientAddress,
  sendState,
  receiveState,
  isSend = false,
  isIBC = false,
  isSwap = false,
  isExchange = false,
}: {
  sendAddress: string;
  recipientAddress: string;
  sendState: TransactionState;
  receiveState: TransactionState;
  isSend?: boolean;
  isIBC?: boolean;
  isSwap?: boolean;
  isExchange?: boolean;
}): Promise<TransactionDetails> => {
  // Basic validation
  if (!(sendAddress && recipientAddress)) {
    return {
      type: TransactionType.INVALID,
      isValid: false,
      isIBC: false,
      isSwap: false,
      isExchange: false,
    };
  }

  const sendAsset = sendState.asset;
  const receiveAsset = receiveState.asset;

  // Validate the transaction type
  const isValid = sendAsset && receiveAsset && (isSend || isIBC || isSwap || isExchange);

  // Determine transaction type
  let type: TransactionType;
  if (!isValid) {
    type = TransactionType.INVALID;
  } else if (isExchange) {
    type = TransactionType.EXCHANGE;
  } else if (isIBC && isSwap) {
    type = TransactionType.IBC_SWAP;
  } else if (isIBC) {
    type = TransactionType.IBC_SEND;
  } else if (isSwap) {
    type = TransactionType.SWAP;
  } else {
    type = TransactionType.SEND;
  }

  return {
    type,
    isValid,
    isIBC,
    isSwap,
    isExchange,
  };
};
