import React from 'react';
import { AssetScrollTile } from '../AssetScrollTile';
import { useAtomValue } from 'jotai';
import { filteredAssetsAtom, filteredDialogAssetsAtom, filteredExchangeAssetsAtom } from '@/atoms';
import { Asset } from '@/types';

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
