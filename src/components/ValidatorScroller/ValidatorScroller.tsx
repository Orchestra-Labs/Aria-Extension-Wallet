import React, { useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { ValidatorTile } from '../ValidatorTile';
import { isFetchingValidatorDataAtom } from '@/atoms';
import { CombinedStakingInfo } from '@/types';
import { TileScroller, TileScrollerHandle } from '../TileScroller';
import { useRefreshData } from '@/hooks';

interface ValidatorScrollerProps {
  validators: CombinedStakingInfo[];
  onClick?: (asset: CombinedStakingInfo) => void;
  isSelectable?: boolean;
  lazyLoad?: boolean;
}

export const ValidatorScroller: React.FC<ValidatorScrollerProps> = ({
  validators,
  isSelectable = false,
  onClick,
  lazyLoad = true,
}) => {
  const tileScrollerRef = useRef<TileScrollerHandle>(null);
  const { refreshData } = useRefreshData();
  const isFetching = useAtomValue(isFetchingValidatorDataAtom);

  console.log('[ValidatorScroller] Received validators:', validators);
  const handleRefresh = useCallback(() => {
    refreshData({ validator: true, wallet: false });
  }, [refreshData]);

  const handleClick = (combinedStakingInfo: CombinedStakingInfo) => {
    // Check if we should prevent the click
    if (tileScrollerRef.current?.shouldPreventClick()) {
      return;
    }
    onClick?.(combinedStakingInfo);
  };

  return (
    <TileScroller
      ref={tileScrollerRef}
      isRefreshing={isFetching}
      onRefresh={handleRefresh}
      lazyLoad={lazyLoad}
    >
      {validators.length === 0 ? (
        <p className="text-base text-neutral-1">No validators found</p>
      ) : (
        validators.map(combinedStakingInfo => (
          <div
            key={`${combinedStakingInfo.validator.operator_address}`}
            className="tile-item" // NOTE: Important for lazy loading
          >
            <ValidatorTile
              combinedStakingInfo={combinedStakingInfo}
              isSelectable={isSelectable}
              onClick={handleClick}
            />
          </div>
        ))
      )}
    </TileScroller>
  );
};
