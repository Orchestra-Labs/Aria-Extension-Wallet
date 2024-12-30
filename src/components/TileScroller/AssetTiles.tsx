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
  console.log('isEditPage:', isEditPage);
  console.log('isDialog:', isDialog);
  console.log('isReceiveDialog:', isReceiveDialog);
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
