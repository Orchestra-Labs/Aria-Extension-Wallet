import React from 'react';
import { Asset, SimplifiedChainInfo } from '@/types';
import { ScrollTile, Toggle } from '@/components';
import { networkLevelAtom, selectedValidatorChainAtom, subscriptionSelectionsAtom } from '@/atoms';
import { useAtomValue } from 'jotai';
import { getPrimaryFeeToken } from '@/helpers';
import { IconContainer } from '@/assets/icons';
import { SYMPHONY_CHAIN_ID_LIST } from '@/constants';

interface ChainTileProps {
  chain: SimplifiedChainInfo;
  onClick?: (chain: SimplifiedChainInfo, viewAll: boolean, primaryFeeToken: Asset | null) => void;
  onToggle?: (chain: SimplifiedChainInfo, viewAll: boolean, primaryFeeToken: Asset | null) => void;
  isDialog?: boolean;
}

export const ChainTile: React.FC<ChainTileProps> = ({
  chain,
  onClick,
  onToggle,
  isDialog = false,
}) => {
  const subscriptionSelections = useAtomValue(subscriptionSelectionsAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const selectedValidatorChain = useAtomValue(selectedValidatorChainAtom);

  const isSelected = chain.chain_id in subscriptionSelections[networkLevel];
  const isSelectedInDialog = isDialog && chain.chain_id === selectedValidatorChain;
  console.log('[ChainTile onMount] checking value of viewAll');
  console.log('[ChainTile onMount]', subscriptionSelections[networkLevel][chain.chain_id]);
  console.log('[ChainTile onMount]', subscriptionSelections[networkLevel][chain.chain_id]?.viewAll);
  const viewAllIsSelected = subscriptionSelections[networkLevel]?.[chain.chain_id]?.viewAll ?? true;

  const formattedTitle = chain.pretty_name
    ? chain.pretty_name.charAt(0).toUpperCase() + chain.pretty_name.slice(1)
    : chain.chain_name.charAt(0).toUpperCase() + chain.chain_name.slice(1);

  const primaryFeeToken = getPrimaryFeeToken(chain);
  const primaryFeeSymbol = primaryFeeToken?.symbol || '';

  const isSymphonyChain = SYMPHONY_CHAIN_ID_LIST.includes(chain.chain_id);

  const handleToggle = (newState: boolean) => {
    console.log('[ChainTile handleToggle] handleToggle newState:', newState);

    if (onToggle) {
      onToggle(chain, newState, primaryFeeToken);
    }
  };

  const handleClick = () => {
    console.log('[ChainTile handleClick] handleClick');

    if (!isDialog && onClick) {
      onClick(chain, viewAllIsSelected, primaryFeeToken);
    }
  };

  return (
    <ScrollTile
      title={formattedTitle}
      subtitle={'All Coins?'}
      value={primaryFeeSymbol}
      subtitleClickOption={!isDialog && <Toggle isOn={viewAllIsSelected} onChange={handleToggle} />}
      icon={
        <IconContainer src={chain.logo_uri} alt={chain.chain_name} isFallback={isSymphonyChain} />
      }
      selected={isDialog ? isSelectedInDialog : isSelected}
      onClick={handleClick}
    />
  );
};
