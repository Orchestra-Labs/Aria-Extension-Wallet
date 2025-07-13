import React, { useEffect, useRef, useState } from 'react';
import { SlideTray } from '@/ui-kit';
import { IconContainer, LogoIcon } from '@/assets/icons';
import { Asset } from '@/types';
import { SortDialog } from '../SortDialog';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  dialogSearchTermAtom,
  filteredDialogAssetsAtom,
  filteredExchangeAssetsAtom,
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
  const slideTrayRef = useRef<{ closeWithAnimation: () => void }>(null);

  const currentStateAtomSource = isReceiveDialog ? receiveStateAtom : sendStateAtom;
  const filteredAssetsAtomSource = isReceiveDialog
    ? filteredExchangeAssetsAtom
    : filteredDialogAssetsAtom;
  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(assetDialogSortOrderAtom);
  const setSortType = useSetAtom(assetDialogSortTypeAtom);
  const currentState = useAtomValue(currentStateAtomSource);
  const filteredAssets = useAtomValue(filteredAssetsAtomSource);

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
    <IconContainer src={logo} alt={alt} className="h-7 w-7" />
  ) : (
    <IconContainer icon={icon} alt={alt} className="h-7 w-7" />
  );

  const resetDefaults = () => {
    setSearchTerm('');
    setSortOrder(SortOrder.DESC);
    setSortType(AssetSortType.NAME);
  };

  useEffect(() => {
    setDialogSelectedAsset(currentState.asset);
  }, [currentState.asset]);

  const handleAssetSelection = (asset: Asset) => {
    onClick(asset);
    slideTrayRef.current?.closeWithAnimation();
  };

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
            <SortDialog searchType={searchType} isDialog />
          </div>
        </div>

        <AssetScroller
          assets={filteredAssets}
          isSelectable={true}
          onClick={handleAssetSelection}
          isReceiveDialog={isReceiveDialog}
        />

        <SearchBar searchType={searchType} isDialog />
      </div>
    </SlideTray>
  );
};
