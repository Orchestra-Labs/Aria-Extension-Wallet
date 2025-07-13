import React from 'react';
import { Asset, SimplifiedChainInfo } from '@/types';
import { ScrollTile } from '@/components';
import { networkLevelAtom, subscriptionSelectionsAtom } from '@/atoms';
import { useAtomValue } from 'jotai';
import { getPrimaryFeeToken } from '@/helpers';
import { IconContainer } from '@/assets/icons';

interface ChainTileProps {
  chain: SimplifiedChainInfo;
  onClick: (chain: SimplifiedChainInfo, primaryFeeToken: Asset | null) => void;
}

export const ChainTile: React.FC<ChainTileProps> = ({ chain, onClick }) => {
  const subscriptionSelections = useAtomValue(subscriptionSelectionsAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const selected = chain.chain_id in subscriptionSelections[networkLevel];

  const formattedTitle = chain.pretty_name
    ? chain.pretty_name.charAt(0).toUpperCase() + chain.pretty_name.slice(1)
    : chain.chain_name.charAt(0).toUpperCase() + chain.chain_name.slice(1);

  const primaryFeeToken = getPrimaryFeeToken(chain);
  const primaryFeeSymbol = primaryFeeToken?.symbol || '';

  return (
    <ScrollTile
      title={formattedTitle}
      subtitle={chain.chain_id}
      value={primaryFeeSymbol}
      icon={<IconContainer src={chain.logo_uri} alt={chain.chain_name} />}
      selected={selected}
      onClick={() => onClick(chain, primaryFeeToken)}
    />
  );
};
