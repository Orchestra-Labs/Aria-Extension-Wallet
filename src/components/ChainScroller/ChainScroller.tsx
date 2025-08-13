import React, { useCallback, useRef } from 'react';
import { ChainTile } from '../ChainTile';
import { TileScroller, TileScrollerHandle } from '../TileScroller';
import { useRefreshData } from '@/hooks';
import { Asset, SimplifiedChainInfo } from '@/types';

interface ChainScrollerProps {
  chains: SimplifiedChainInfo[];
  onChainSelect: (chain: SimplifiedChainInfo, viewAll: boolean, feeToken: Asset | null) => void;
  onToggle?: (chain: SimplifiedChainInfo, viewAll: boolean, primaryFeeToken: Asset | null) => void;
  isDialog?: boolean;
  lazyLoad?: boolean;
}

export const ChainScroller: React.FC<ChainScrollerProps> = ({
  chains,
  onChainSelect,
  onToggle,
  isDialog = false,
  lazyLoad = true,
}) => {
  const tileScrollerRef = useRef<TileScrollerHandle>(null);
  const { refreshData } = useRefreshData();

  const handleRefresh = useCallback(() => {
    refreshData({ wallet: true });
  }, [refreshData]);

  const handleClick = (chain: SimplifiedChainInfo, viewAll: boolean, feeToken: Asset | null) => {
    if (tileScrollerRef.current?.shouldPreventClick()) {
      return;
    }
    onChainSelect(chain, viewAll, feeToken);
  };

  const handleToggle = (chain: SimplifiedChainInfo, viewAll: boolean, feeToken: Asset | null) => {
    if (tileScrollerRef.current?.shouldPreventClick()) {
      return;
    }
    onToggle?.(chain, viewAll, feeToken);
  };

  return (
    <TileScroller ref={tileScrollerRef} onRefresh={handleRefresh} lazyLoad={lazyLoad}>
      {chains.length === 0 ? (
        <p className="text-base text-neutral-1">No chains found</p>
      ) : (
        chains.map(chain => (
          <div
            key={chain.chain_id}
            className="tile-item" // Essential for lazy loading
          >
            <ChainTile
              chain={chain}
              onClick={handleClick}
              onToggle={handleToggle}
              isDialog={isDialog}
            />
          </div>
        ))
      )}
    </TileScroller>
  );
};
