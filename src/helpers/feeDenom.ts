import { LOCAL_MAINNET_ASSET_REGISTRY } from '@/constants';
import { Asset } from '@/types';

export const getValidFeeDenom = (sendDenom?: string, exchangeAssets: Asset[] = []): string => {
  console.log('Input sendDenom:', sendDenom); // Log the input sendDenom value

  // Check if sendDenom exists in registry and is a fee token
  const isNativeCoin = sendDenom === LOCAL_MAINNET_ASSET_REGISTRY.note.denom;
  const isStablecoin = exchangeAssets.some(asset => asset.denom === sendDenom);
  if (sendDenom && (isNativeCoin || isStablecoin)) {
    console.log(`Valid fee token found: ${sendDenom}`); // Log if it's a valid fee token
    return sendDenom;
  }

  // Log if sendDenom is not a valid fee token
  console.log(
    `sendDenom is invalid or not a fee token. Defaulting to: ${LOCAL_MAINNET_ASSET_REGISTRY.note.denom}`,
  );

  // Default to note if sendDenom isn't valid fee token
  return LOCAL_MAINNET_ASSET_REGISTRY.note.denom;
};
