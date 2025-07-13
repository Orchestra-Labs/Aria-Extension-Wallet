import React, { useCallback, useRef } from 'react';
import { AssetTile } from '../AssetTile';
import { useAtomValue } from 'jotai';
import { isFetchingWalletDataAtom } from '@/atoms';
import { Asset } from '@/types';
import { TileScroller, TileScrollerHandle } from '../TileScroller';
import { useRefreshData } from '@/hooks';

interface AssetScrollerProps {
  assets: Asset[];
  isSelectable?: boolean;
  onClick?: (asset: Asset) => void;
  isReceiveDialog?: boolean;
  multiSelectEnabled?: boolean;
}

export const AssetScroller: React.FC<AssetScrollerProps> = ({
  assets,
  isSelectable = false,
  onClick,
  isReceiveDialog = false,
  multiSelectEnabled = false,
}) => {
  const tileScrollerRef = useRef<TileScrollerHandle>(null);
  const { refreshData } = useRefreshData();

  const isFetching = useAtomValue(isFetchingWalletDataAtom);
  const assetKeys = useAssetKeys(assets);

  const handleRefresh = useCallback(() => {
    refreshData({ wallet: true, validator: false });
  }, [refreshData]);

  const handleClick = (asset: Asset) => {
    // Check if we should prevent the click
    if (tileScrollerRef.current?.shouldPreventClick()) {
      return;
    }
    onClick?.(asset);
  };

  console.log('[AssetScroller] Rendering AssetScroller with assets:', assets);

  return (
    <TileScroller ref={tileScrollerRef} isRefreshing={isFetching} onRefresh={handleRefresh}>
      {assets.length === 0 ? (
        <p className="text-base text-neutral-1">No assets found</p>
      ) : (
        assets.map((asset, index) => (
          <AssetTile
            key={assetKeys[index]}
            asset={asset}
            isSelectable={isSelectable}
            isReceiveDialog={isReceiveDialog}
            multiSelectEnabled={multiSelectEnabled}
            onClick={handleClick}
          />
        ))
      )}
    </TileScroller>
  );
};

// Memoize the key generator to avoid recreating it on every render
const useAssetKeys = (assets: Asset[]) => {
  return React.useMemo(() => {
    return assets.map((asset, index) => {
      // Stringify all identifiable properties as a base key
      const propertiesKey = JSON.stringify({
        denom: asset.denom,
        networkID: asset.networkID,
        amount: asset.amount,
        isIbc: asset.isIbc,
        symbol: asset.symbol,
        logo: asset.logo,
      });
      return `${propertiesKey}|${index}`;
    });
  }, [assets]);
};
