import { useAtomValue } from 'jotai';
import React from 'react';

import { filteredDialogValidatorsAtom, filteredValidatorsAtom } from '@/atoms';
import { CombinedStakingInfo } from '@/types';

import { ValidatorScrollTile } from '../ValidatorScrollTile';

interface ValidatorTilesProps {
  isSelectable?: boolean;
  onClick?: (asset: CombinedStakingInfo) => void;
  isDialog?: boolean;
}

// TODO: check for registry symbol where symbol equals denom
// const denom = validatorReward.rewards[0]?.denom || 'UNKNOWN';
export const ValidatorTiles: React.FC<ValidatorTilesProps> = ({
  isSelectable = false,
  onClick,
  isDialog = false,
}) => {
  const filteredValidators = useAtomValue(
    isDialog ? filteredDialogValidatorsAtom : filteredValidatorsAtom,
  );

  if (filteredValidators.length === 0) {
    return <p className="text-base text-neutral-1">No validators found</p>;
  }

  return (
    <>
      {filteredValidators.map(combinedStakingInfo => (
        <ValidatorScrollTile
          key={`${combinedStakingInfo.validator.operator_address}`}
          combinedStakingInfo={combinedStakingInfo}
          isSelectable={isSelectable}
          onClick={onClick}
        />
      ))}
    </>
  );
};
