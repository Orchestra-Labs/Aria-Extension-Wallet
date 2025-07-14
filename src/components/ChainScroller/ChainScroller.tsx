import React, { useCallback, useRef } from 'react';
import { ChainTile } from '../ChainTile';
import { TileScroller, TileScrollerHandle } from '../TileScroller';
import { useRefreshData } from '@/hooks';
import { Asset, SimplifiedChainInfo } from '@/types';

interface ChainScrollerProps {
  chains: SimplifiedChainInfo[];
  onChainSelect: (chain: SimplifiedChainInfo, feeToken: Asset | null) => void;
  isDialog?: boolean;
}

export const ChainScroller: React.FC<ChainScrollerProps> = ({
  chains,
  onChainSelect,
  isDialog = false,
}) => {
  const tileScrollerRef = useRef<TileScrollerHandle>(null);
  const { refreshData } = useRefreshData();

  const handleRefresh = useCallback(() => {
    refreshData({ wallet: true, validator: false });
  }, [refreshData]);

  const handleClick = (chain: SimplifiedChainInfo, feeToken: Asset | null) => {
    if (tileScrollerRef.current?.shouldPreventClick()) {
      return;
    }
    onChainSelect(chain, feeToken);
  };

  return (
    <TileScroller ref={tileScrollerRef} onRefresh={handleRefresh}>
      {chains.length === 0 ? (
        <p className="text-base text-neutral-1">No chains found</p>
      ) : (
        chains.map(chain => (
          <ChainTile key={chain.chain_id} chain={chain} onClick={handleClick} isDialog={isDialog} />
        ))
      )}
    </TileScroller>
  );
};
