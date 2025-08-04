import React, { useEffect, useMemo, useRef } from 'react';
import { Button, SlideTray } from '@/ui-kit';
import { SortDialog } from '../SortDialog';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  chainDialogSortOrderAtom,
  dialogSearchTermAtom,
  selectedValidatorChainAtom,
  selectedValidatorChainInfoAtom,
  subscribedChainsAtom,
  validatorDataAtom,
} from '@/atoms';
import { SearchBar } from '../SearchBar';
import { ChainScroller } from '../ChainScroller';
import { SearchType } from '@/constants';
import { SimplifiedChainInfo } from '@/types';
import { useRefreshData } from '@/hooks';
import { filterAndSortChains } from '@/helpers';

interface ChainSelectDialogProps {
  buttonClassName?: string;
  buttonText?: string;
  disabled?: boolean;
}

export const ChainSelectDialog: React.FC<ChainSelectDialogProps> = ({
  buttonClassName = '',
  buttonText = undefined,
  disabled = false,
}) => {
  const slideTrayRef = useRef<{ closeWithAnimation: () => void }>(null);

  const { refreshData } = useRefreshData();

  const setSearchTerm = useSetAtom(dialogSearchTermAtom);
  const subscribedChains = useAtomValue(subscribedChainsAtom);
  const [selectedChainId, setSelectedChainId] = useAtom(selectedValidatorChainAtom);
  const chainInfo = useAtomValue(selectedValidatorChainInfoAtom);
  const searchTerm = useAtomValue(dialogSearchTermAtom);
  const sortOrder = useAtomValue(chainDialogSortOrderAtom);
  const setValidatorState = useSetAtom(validatorDataAtom);

  console.log('[ChainSelectDialog] subscribed chains:', subscribedChains);

  useEffect(() => {
    console.log('[ChainSelectDialog] Selected chain changed:', {
      chainId: selectedChainId,
      chainInfo,
    });
  }, [selectedChainId, chainInfo]);

  const searchType = SearchType.CHAIN;

  const resetDefaults = () => {
    setSearchTerm('');
  };

  const handleChainSelection = (chain: SimplifiedChainInfo) => {
    if (chain.chain_id !== selectedChainId) {
      setSelectedChainId(chain.chain_id);
      setValidatorState([]);
    }

    slideTrayRef.current?.closeWithAnimation();
  };

  const triggerComponent = useMemo(() => {
    console.log(
      '[ChainSelectDialog] triggerComponent updated with chainInfo:',
      chainInfo?.pretty_name,
    );

    // Format the button text to max 9 characters
    const formatButtonText = (text: string | undefined) => {
      if (!text) return 'Chain';
      return text.length > 9 ? `${text.substring(0, 6)}...` : text;
    };

    const displayText = buttonText
      ? formatButtonText(buttonText)
      : formatButtonText(chainInfo?.pretty_name) || 'Chain';

    return (
      <Button
        variant="selectedEnabled"
        size="xsmall"
        className={`px-1 rounded text-xs ${buttonClassName || ''}`}
        disabled={disabled}
      >
        {displayText}
      </Button>
    );
  }, [chainInfo]);

  const filteredChains = useMemo(() => {
    return filterAndSortChains(subscribedChains, searchTerm, sortOrder);
  }, [subscribedChains, searchTerm, sortOrder]);

  useEffect(() => {
    refreshData({ validator: true });
  }, [selectedChainId]);

  return (
    <SlideTray
      ref={slideTrayRef}
      triggerComponent={triggerComponent}
      title="Select Chain"
      onClose={resetDefaults}
      showBottomBorder
    >
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center w-full px-2">
          <div className="text-sm flex w-[5rem]">Tap to select</div>
          <div className="text-sm flex-1 text-center">
            Selected: <span className="text-blue">{chainInfo?.pretty_name || 'None'}</span>
          </div>
          <div className="flex justify-end w-[5rem]">
            <SortDialog searchType={searchType} isDialog />
          </div>
        </div>

        <ChainScroller chains={filteredChains} onChainSelect={handleChainSelection} isDialog />

        <SearchBar searchType={searchType} isDialog />
      </div>
    </SlideTray>
  );
};
