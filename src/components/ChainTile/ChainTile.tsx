import React from 'react';
import { Asset, SimplifiedChainInfo } from '@/types';
import { ScrollTile } from '@/components';
import { networkLevelAtom, selectedValidatorChainAtom, subscriptionSelectionsAtom } from '@/atoms';
import { useAtomValue } from 'jotai';
import { getPrimaryFeeToken } from '@/helpers';
import { IconContainer } from '@/assets/icons';
import { SYMPHONY_CHAIN_ID_LIST } from '@/constants';

interface ChainTileProps {
  chain: SimplifiedChainInfo;
  onClick: (chain: SimplifiedChainInfo, primaryFeeToken: Asset | null) => void;
  isDialog?: boolean;
}

export const ChainTile: React.FC<ChainTileProps> = ({ chain, onClick, isDialog = false }) => {
  const subscriptionSelections = useAtomValue(subscriptionSelectionsAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const selectedValidatorChain = useAtomValue(selectedValidatorChainAtom);

  const selected = chain.chain_id in subscriptionSelections[networkLevel];
  const isSelectedInDialog = isDialog && chain.chain_id === selectedValidatorChain;

  const formattedTitle = chain.pretty_name
    ? chain.pretty_name.charAt(0).toUpperCase() + chain.pretty_name.slice(1)
    : chain.chain_name.charAt(0).toUpperCase() + chain.chain_name.slice(1);

  const primaryFeeToken = getPrimaryFeeToken(chain);
  const primaryFeeSymbol = primaryFeeToken?.symbol || '';

  const isSymphonyChain = SYMPHONY_CHAIN_ID_LIST.includes(chain.chain_id);

  return (
    <ScrollTile
      title={formattedTitle}
      subtitle={chain.chain_id}
      value={primaryFeeSymbol}
      icon={
        <IconContainer src={chain.logo_uri} alt={chain.chain_name} isFallback={isSymphonyChain} />
      }
      selected={isDialog ? isSelectedInDialog : selected}
      onClick={() => {
        console.log('[ChainTile] clicked - chain:', chain.chain_id);
        onClick(chain, primaryFeeToken);
      }}
    />
  );
};
