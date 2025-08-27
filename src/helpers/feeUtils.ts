import { Asset, FeeToken, SimplifiedChainInfo } from '@/types';

export const determineFeeToken = (
  sendAsset: Asset,
  chainInfo: SimplifiedChainInfo,
): { feeToken: FeeToken; symbol: string } | undefined => {
  if (!chainInfo?.fees || !sendAsset) return undefined;

  // Check if the send asset can be used as a fee token
  const sendAssetAsFeeToken = chainInfo.fees.find(feeToken => feeToken.denom === sendAsset.denom);

  if (sendAssetAsFeeToken) {
    console.log('[determineFeeToken] Using send asset as fee token:', sendAsset.originDenom);
    return {
      feeToken: sendAssetAsFeeToken,
      symbol: sendAsset.symbol,
    };
  }

  // Default to the primary fee token (first in the array)
  const primaryFeeToken = chainInfo.fees[0];
  if (primaryFeeToken) {
    console.log('[determineFeeToken] Defaulting to primary fee token:', primaryFeeToken.denom);

    // Try to find the asset to get its symbol
    const feeAsset = chainInfo.assets
      ? Object.values(chainInfo.assets).find(asset => asset.originDenom === primaryFeeToken.denom)
      : undefined;

    return {
      feeToken: primaryFeeToken,
      symbol: feeAsset?.symbol || primaryFeeToken.denom,
    };
  }

  console.warn('[determineFeeToken] No fee tokens available for chain:', chainInfo.chain_id);
  return undefined;
};
