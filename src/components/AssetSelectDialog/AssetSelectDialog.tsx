import { useAtomValue, useSetAtom } from 'jotai';
import React, { useEffect, useRef, useState } from 'react';

import { LogoIcon } from '@/assets/icons';
import {
  assetDialogSortOrderAtom,
  assetDialogSortTypeAtom,
  dialogSearchTermAtom,
  receiveStateAtom,
  sendStateAtom,
} from '@/atoms';
import { Asset } from '@/types';
import { SlideTray } from '@/ui-kit';

import { SearchBar } from '../SearchBar';
import { SortDialog } from '../SortDialog';
import { TileScroller } from '../TileScroller';

interface AssetSelectDialogProps {
  isReceiveDialog?: boolean;
  onClick: (asset: Asset) => void;
}

export const AssetSelectDialog: React.FC<AssetSelectDialogProps> = ({
  isReceiveDialog = false,
  onClick,
}) => {
  const slideTrayRef = useRef<{ closeWithAnimation: () => void }>(null);

  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const setSortOrder = useSetAtom(assetDialogSortOrderAtom);
  const setSortType = useSetAtom(assetDialogSortTypeAtom);
  const currentState = useAtomValue(isReceiveDialog ? receiveStateAtom : sendStateAtom);

  const [dialogSelectedAsset, setDialogSelectedAsset] = useState(currentState.asset);

  const resetDefaults = () => {
    setSearchTerm('');
    setSortOrder('Desc');
    setSortType('name');
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
      triggerComponent={
        dialogSelectedAsset.logo ? (
          <img
            src={dialogSelectedAsset.logo}
            alt={dialogSelectedAsset.symbol || 'Unknown Asset'}
            className="h-7 w-7 text-neutral-1 hover:bg-blue-hover hover:text-blue-dark cursor-pointer"
            width={20}
          />
        ) : (
          <LogoIcon
            className="h-7 w-7 text-neutral-1 hover:bg-blue-hover hover:text-blue-dark cursor-pointer"
            width={20}
          />
        )
      }
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
            <SortDialog isDialog />
          </div>
        </div>

        <TileScroller
          activeIndex={0}
          isSelectable={true}
          onSelectAsset={handleAssetSelection}
          isDialog={true}
          isReceiveDialog={isReceiveDialog}
        />

        <SearchBar isDialog />
      </div>
    </SlideTray>
  );
};
