import React from 'react';
import { AssetScrollTile } from '../AssetScrollTile';
import { useAtomValue } from 'jotai';
import {
  coinListAssetsAtom,
  filteredAssetsAtom,
  filteredDialogAssetsAtom,
  filteredExchangeAssetsAtom,
} from '@/atoms';
import { Asset } from '@/types';

interface AssetTilesProps {
  isSelectable?: boolean;
  onClick?: (asset: Asset) => void;
  isDialog?: boolean;
  isReceiveDialog?: boolean;
  isEditPage?: boolean;
  multiSelectEnabled?: boolean;
}

export const AssetTiles: React.FC<AssetTilesProps> = ({
  isSelectable = false,
  onClick,
  isDialog = false,
  isReceiveDialog = false,
  isEditPage = false,
  multiSelectEnabled = false,
}) => {
  const filteredAssets = useAtomValue(
    isEditPage
      ? coinListAssetsAtom
      : isDialog
        ? isReceiveDialog
          ? filteredExchangeAssetsAtom
          : filteredDialogAssetsAtom
        : filteredAssetsAtom,
  );

  console.log('[AssetTiles] Rendering assets:', filteredAssets);
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
