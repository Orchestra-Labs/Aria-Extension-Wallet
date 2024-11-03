import { Asset } from '@/types';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isValidSwap } from './swapTransactions';
import { isValidSend } from './sendTransactions';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs, { strict: false }));
};

export const convertToGreaterUnit = (amount: number, exponent: number): number => {
  return amount / Math.pow(10, exponent);
};

export const selectTextColorByStatus = (status: string) => {
  let textColor = 'text-white';
  if (status === 'warn') {
    textColor = 'text-warning';
  } else if (status === 'error') {
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

export const isValidTransaction = ({
  sendAsset,
  receiveAsset,
}: {
  sendAsset: Asset;
  receiveAsset: Asset;
}) => {
  const isSwap = isValidSwap({ sendAsset, receiveAsset });
  const isSend = isValidSend({ sendAsset, receiveAsset });
  const result = isSend || isSwap;

  console.log('Checking if valid transaction:', {
    sendAsset,
    receiveAsset,
    isSwap,
    isSend,
    result,
  });

  return result;
};
