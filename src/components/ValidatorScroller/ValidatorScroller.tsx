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
}

export const ValidatorScroller: React.FC<ValidatorScrollerProps> = ({
  validators,
  isSelectable = false,
  onClick,
}) => {
  const tileScrollerRef = useRef<TileScrollerHandle>(null);
  const { refreshData } = useRefreshData();
  const isFetching = useAtomValue(isFetchingValidatorDataAtom);

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
    <TileScroller ref={tileScrollerRef} isRefreshing={isFetching} onRefresh={handleRefresh}>
      {validators.length === 0 ? (
        <p className="text-base text-neutral-1">No validators found</p>
      ) : (
        validators.map(combinedStakingInfo => (
          <ValidatorTile
            key={`${combinedStakingInfo.validator.operator_address}`}
            combinedStakingInfo={combinedStakingInfo}
            isSelectable={isSelectable}
            onClick={handleClick}
          />
        ))
      )}
    </TileScroller>
  );
};
