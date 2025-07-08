import React from 'react';
import { AssetTile } from '../AssetTile';
import { useAtomValue } from 'jotai';
import {
  coinListAssetsAtom,
  filteredAssetsAtom,
  filteredDialogAssetsAtom,
  filteredExchangeAssetsAtom,
} from '@/atoms';
import { Asset } from '@/types';

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
  const [renderCount, setRenderCount] = React.useState(0);
  const prevAssetsRef = React.useRef<Asset[]>([]);

  // Determine which atom to use
  const atomSource = isEditPage
    ? coinListAssetsAtom
    : isDialog
      ? isReceiveDialog
        ? filteredExchangeAssetsAtom
        : filteredDialogAssetsAtom
      : filteredAssetsAtom;

  const filteredAssets = useAtomValue(atomSource);
  const assetKeys = useAssetKeys(filteredAssets);

  React.useEffect(() => {
    console.groupCollapsed(`[AssetTiles] Render #${renderCount + 1}`);
    console.log('[AssetTiles] Props:', {
      isSelectable,
      isDialog,
      isReceiveDialog,
      isEditPage,
      multiSelectEnabled,
    });

    console.log('[AssetTiles] Current assets:', filteredAssets.length);
    console.table(
      filteredAssets.map((a, i) => ({
        key: assetKeys[i],
        denom: a.denom,
        symbol: a.symbol,
        amount: a.amount,
        isIbc: a.isIbc,
        network: a.networkName,
      })),
    );

    if (prevAssetsRef.current.length !== filteredAssets.length) {
      console.log(
        '[AssetTiles] Asset count changed from',
        prevAssetsRef.current.length,
        'to',
        filteredAssets.length,
      );
    }

    const newAssets = filteredAssets.filter(
      a => !prevAssetsRef.current.some(prev => prev.denom === a.denom),
    );
    if (newAssets.length > 0) {
      console.log('[AssetTiles] New assets detected:', newAssets);
    }

    prevAssetsRef.current = filteredAssets;
    setRenderCount(c => c + 1);
    console.groupEnd();
  }, [filteredAssets]);

  return (
    <>
      {filteredAssets.map((asset, index) => (
        <AssetTile
          key={assetKeys[index]}
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
