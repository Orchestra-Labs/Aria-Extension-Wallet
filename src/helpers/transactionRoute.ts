import { TransactionType } from '@/constants';
import { SimplifiedChainInfo, TransactionRoute, TransactionStep } from '@/types';
import { truncateWalletAddress } from './truncateString';

export const createStepHash = (step: TransactionStep, amount?: number): string => {
  const { type, via, fromChain, toChain, fromAsset, toAsset } = step;

  const baseString = `${type}-${via}-${fromChain}-${toChain}-${fromAsset.denom}-${toAsset.denom}`;

  // Include amount only for the first step
  const amountString = amount !== undefined ? `-${amount}` : '';

  return `${baseString + amountString}`;
};

export const createRouteHash = ({
  route,
  toAddress, // Include recipient address to force new simulation
}: {
  route: TransactionRoute;
  toAddress: string;
}): string => {
  const stepsHash = route.steps.map(step => step.hash).join('|');
  return `${stepsHash}-${toAddress}`;
};

export const getStepDescription = ({
  step,
  toAddress,
  sendChainInfo,
  receiveChainInfo,
}: {
  step: TransactionStep;
  toAddress: string;
  sendChainInfo: SimplifiedChainInfo;
  receiveChainInfo: SimplifiedChainInfo;
}): string => {
  const shortToAddress = truncateWalletAddress(sendChainInfo.bech32_prefix, toAddress);

  const fromChainName = sendChainInfo.pretty_name;
  const toChainName = receiveChainInfo.pretty_name;

  const fromAssetSymbol = step.fromAsset.symbol;
  const toAssetSymbol = step.toAsset.symbol;

  let description: string;
  switch (step.type) {
    case TransactionType.SEND:
      description = `${fromChainName}: ${fromAssetSymbol} => ${shortToAddress}`;
      break;
    case TransactionType.SWAP:
      description = `${fromChainName}: ${fromAssetSymbol} => ${toAssetSymbol}`;
      break;
    case TransactionType.EXCHANGE:
      const toChain = fromChainName !== toChainName ? `, ${toChainName}` : '';
      description = `${fromChainName}: ${fromAssetSymbol} => ${toAssetSymbol}${toChain}`;
      break;
    case TransactionType.IBC_SEND:
      description = `${fromChainName}: ${fromAssetSymbol} => ${toChainName}`;
      break;
    default:
      description = `Processing ${step.type} transaction`;
  }

  // Add logging for the description
  console.log(`Transaction Step Description: ${description}`, {
    transactionType: step.type,
    fromAsset: step.fromAsset.symbol,
    toAsset: step.type !== TransactionType.SEND ? step.toAsset?.symbol : undefined,
    fromChain: step.fromChain,
    toChain: step.toChain,
    recipientAddress: shortToAddress,
  });

  return description;
};
