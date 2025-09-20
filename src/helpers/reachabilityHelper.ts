import { Asset } from '@/types';

export interface ReachableChain {
  chainId: string;
  assets: Asset[];
  poolCount: number;
}

export const getReachableChainsFromOsmosisPools = (osmosisAssets: Asset[]): ReachableChain[] => {
  const chainMap = new Map<string, ReachableChain>();

  // Group assets by origin chain
  for (const asset of osmosisAssets) {
    const originChainId = asset.originChainId;

    if (originChainId && originChainId !== 'unknown') {
      if (!chainMap.has(originChainId)) {
        chainMap.set(originChainId, {
          chainId: originChainId,
          assets: [],
          poolCount: 0,
        });
      }

      const chainInfo = chainMap.get(originChainId)!;
      chainInfo.assets.push(asset);

      // For GAMM tokens, we might want to count pools
      if (asset.denom.startsWith('gamm/pool/')) {
        chainInfo.poolCount += 1;
      }
    }
  }

  // Convert to array and sort by pool count (most liquid chains first)
  return Array.from(chainMap.values()).sort((a, b) => b.poolCount - a.poolCount);
};
