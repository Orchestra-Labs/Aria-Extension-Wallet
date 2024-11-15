import React from 'react';
import { useEffect } from 'react';
import { AssetScrollTile } from '../AssetScrollTile';
import { useSetAtom, useAtomValue } from 'jotai';
import {
  filteredAssetsAtom,
  filteredDialogAssetsAtom,
  exchangeAssetsAtom,
  filteredExchangeAssetsAtom,
} from '@/atoms';
import { Asset } from '@/types';
import { useExchangeAssets } from '@/hooks/useExchangeAssets';

interface AssetTilesProps {
  isSelectable?: boolean;
  onClick?: (asset: Asset) => void;
  isDialog?: boolean;
  isReceiveDialog?: boolean;
  multiSelectEnabled?: boolean;
}

export const AssetTiles: React.FC<AssetTilesProps> = ({
  isSelectable = false,
  onClick,
  isDialog = false,
  isReceiveDialog = false,
  multiSelectEnabled = false,
}) => {
  const filteredAssets = useAtomValue(
    isDialog
      ? isReceiveDialog
        ? filteredExchangeAssetsAtom
        : filteredDialogAssetsAtom
      : filteredAssetsAtom,
  );

  const { availableAssets, isLoading } = useExchangeAssets();
  const setExchangeAssets = useSetAtom(exchangeAssetsAtom);

  useEffect(() => {
    if (isReceiveDialog && availableAssets.length > 0) {
      setExchangeAssets(availableAssets);
    }
  }, [availableAssets, isReceiveDialog]);

  // TODO: center these or change to Loader or other icon
  if (isLoading && isReceiveDialog) {
    return <p className="text-base text-neutral-1">Loading available assets...</p>;
  }
  if (!filteredAssets?.length) {
    return <p className="text-base text-neutral-1">No assets found</p>;
  }

  return (
    <>
      {filteredAssets.map(asset => (
        <AssetScrollTile
          key={asset.denom}
          asset={asset}
          isSelectable={isSelectable}
          isReceiveDialog={isReceiveDialog}
          multiSelectEnabled={multiSelectEnabled}
          onClick={onClick}
        />
      ))}
    </>
  );
};
