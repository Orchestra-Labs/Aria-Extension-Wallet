import React, { useEffect, useRef, useState } from 'react';
import { SlideTray, SlideTrayHandle } from '@/ui-kit';
import { IconContainer, LogoIcon } from '@/assets/icons';
import { Asset } from '@/types';
import { SortDialog } from '../SortDialog';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  dialogSearchTermAtom,
  filteredDialogAssetsAtom,
  filteredReceiveAssetsAtom,
  isFetchingRegistryDataAtom,
  receiveStateAtom,
  sendStateAtom,
} from '@/atoms';
import { SearchBar } from '../SearchBar';
import { AssetScroller } from '../AssetScroller';
import { AssetSortType, SearchType, SortOrder, SYMPHONY_MAINNET_ASSET_REGISTRY } from '@/constants';

interface AssetSelectDialogProps {
  isReceiveDialog?: boolean;
  onClick: (asset: Asset) => void;
}

export const AssetSelectDialog: React.FC<AssetSelectDialogProps> = ({
  isReceiveDialog = false,
  onClick,
}) => {
  const slideTrayRef = useRef<SlideTrayHandle>(null);

  const currentStateAtomSource = isReceiveDialog ? receiveStateAtom : sendStateAtom;
  const filteredAssetsAtomSource = isReceiveDialog
    ? filteredReceiveAssetsAtom
    : filteredDialogAssetsAtom;
  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(assetDialogSortOrderAtom);
  const setSortType = useSetAtom(assetDialogSortTypeAtom);
  const currentState = useAtomValue(currentStateAtomSource);
  const filteredAssets = useAtomValue(filteredAssetsAtomSource);
  const isFetchingRegistry = useAtomValue(isFetchingRegistryDataAtom);

  const [dialogSelectedAsset, setDialogSelectedAsset] = useState(currentState.asset);

  const searchType = SearchType.ASSET;

  const alt = dialogSelectedAsset.symbol || 'Unknown Asset';
  const logo = dialogSelectedAsset.logo || SYMPHONY_MAINNET_ASSET_REGISTRY.note.logo;
  const icon = (
    <LogoIcon
      className="h-7 w-7 text-neutral-1 hover:bg-blue-hover hover:text-blue-dark cursor-pointer"
      width={20}
    />
  );
  const triggerComponent = logo ? (
    <IconContainer
      src={logo}
      alt={alt}
      className="h-7 w-7 hover:bg-blue-hover hover:text-blue-dark hover:border hover:border-solid hover:border-blue-hover cursor-pointer"
    />
  ) : (
    <IconContainer icon={icon} alt={alt} className="h-7 w-7" />
  );

  const resetDefaults = () => {
    setSearchTerm('');
    setSortOrder(SortOrder.DESC);
    setSortType(AssetSortType.NAME);
  };

  const handleAssetSelection = (asset: Asset) => {
    console.log('[AssetSelectDialog] Selected asset:', asset);
    console.log('[AssetSelectDialog] Current asset:', currentState.asset);
    onClick(asset);
    slideTrayRef.current?.closeWithAnimation();
  };

  useEffect(() => {
    setDialogSelectedAsset(currentState.asset);
  }, [currentState.asset]);

  return (
    <SlideTray
      ref={slideTrayRef}
      triggerComponent={triggerComponent}
      title={isReceiveDialog ? 'Receive' : 'Send'}
      onClose={resetDefaults}
      showBottomBorder
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center w-full px-2">
          <div className="text-sm flex w-[5rem]">Tap to select</div>
          <div className="text-sm flex-1 text-center">
            Selected: <span className="text-blue">{dialogSelectedAsset.symbol || 'None'}</span>
          </div>
          <div className="flex justify-end w-[5rem]">
            <SortDialog
              searchType={searchType}
              exclude={isReceiveDialog ? [AssetSortType.AMOUNT] : undefined}
              isDialog
            />
          </div>
        </div>

        {isFetchingRegistry ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-neutral-1">Loading assets...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-neutral-1">No assets found</p>
          </div>
        ) : (
          <AssetScroller
            assets={filteredAssets}
            onClick={handleAssetSelection}
            isSelectable
            isReceiveDialog={isReceiveDialog}
          />
        )}

        <SearchBar searchType={searchType} isDialog />
      </div>
    </SlideTray>
  );
};
