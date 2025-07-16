import { useAtomValue } from 'jotai';
import React from 'react';

import {
  coinListAssetsAtom,
  filteredAssetsAtom,
  filteredDialogAssetsAtom,
  filteredExchangeAssetsAtom,
} from '@/atoms';
import { Asset } from '@/types';

import { AssetScrollTile } from '../AssetScrollTile';

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
