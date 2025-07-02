import { TransactionState } from '@/types';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isValidSwap } from './swapTransactions';
import { isValidSend } from './sendTransactions';
import { NetworkLevel, TextFieldStatus } from '@/constants';

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

export const isValidTransaction = async ({
  sendAddress,
  recipientAddress,
  sendState,
  receiveState,
  sendChainLevel,
  receiveChainLevel,
}: {
  sendAddress: string;
  recipientAddress: string;
  sendState: TransactionState;
  receiveState: TransactionState;
  sendChainLevel: NetworkLevel;
  receiveChainLevel: NetworkLevel;
}) => {
  if (sendChainLevel !== receiveChainLevel) {
    console.warn('[isValidTransaction] Network levels do not match');
    return false;
  }

  if (!(sendAddress && recipientAddress)) {
    return false;
  }

  const sendAsset = sendState.asset;
  const receiveAsset = receiveState.asset;

  const isSwap = isValidSwap({ sendAsset, receiveAsset });
  const isSend = isValidSend({ sendAsset, receiveAsset });
  const result = isSend || isSwap;

  return result;
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
