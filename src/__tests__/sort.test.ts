import { describe, expect, it } from 'vitest';

import { BondStatus, ValidatorSortType, ValidatorStatusFilter } from '@/constants';
import { filterAndSortAssets, filterAndSortValidators } from '@/helpers/sort';
import type { Asset, CombinedStakingInfo } from '@/types';

describe('filterAndSortAssets', () => {
  const mockAssets: Asset[] = [
    { denom: 'uatom', symbol: 'ATOM', amount: '100' } as Asset,
    { denom: 'uosmo', symbol: 'OSMO', amount: '0' } as Asset,
    { denom: 'ujuno', symbol: 'JUNO', amount: '50' } as Asset,
  ];

  it('filters by search term and sorts by name Asc', () => {
    const result = filterAndSortAssets(mockAssets, 'at', 'name', 'Asc');
    expect(result[0].symbol).toBe('ATOM');
  });

  it('filters out 0 balances if showAllAssets is false', () => {
    const result = filterAndSortAssets(mockAssets, '', 'name', 'Asc', false);
    expect(result.length).toBe(2);
  });

  it('sorts by amount Desc', () => {
    const result = filterAndSortAssets(mockAssets, '', 'amount', 'Desc');
    expect(result[0].amount).toBe('100');
  });
});

describe('filterAndSortValidators', () => {
  const mockValidators: CombinedStakingInfo[] = [
    {
      validator: {
        status: BondStatus.BONDED,
        jailed: false,
        description: { moniker: 'ValidatorOne' },
      },
      delegation: { shares: '100' },
      rewards: [{ amount: '5' }],
      theoreticalApr: '0.1',
      votingPower: '1000',
      uptime: '98',
      balance: { amount: '0' },
      unbondingBalance: { balance: '0' },
    },
    {
      validator: {
        status: BondStatus.UNBONDED,
        jailed: false,
        description: { moniker: 'ValidatorTwo' },
      },
      delegation: { shares: '50' },
      rewards: [{ amount: '2' }],
      theoreticalApr: '0.05',
      votingPower: '500',
      uptime: '95',
      balance: { amount: '10' },
      unbondingBalance: { balance: '0' },
    },
  ];

  it('filters active validators and sorts by NAME Asc', () => {
    const result = filterAndSortValidators(
      mockValidators,
      '',
      ValidatorSortType.NAME,
      'Asc',
      false,
      ValidatorStatusFilter.STATUS_ACTIVE,
    );
    expect(result.length).toBe(2);
    expect(result[0].validator.description.moniker).toBe('ValidatorOne');
    expect(result[1].validator.description.moniker).toBe('ValidatorTwo');
  });

  it('filters by search term and includes validators with user activity', () => {
    const result = filterAndSortValidators(
      mockValidators,
      'two',
      ValidatorSortType.NAME,
      'Asc',
      false,
      ValidatorStatusFilter.STATUS_ACTIVE,
    );
    expect(result.length).toBe(1);
    expect(result[0].validator.description.moniker).toBe('ValidatorTwo');
  });

  it('sorts by delegation Desc', () => {
    const result = filterAndSortValidators(
      mockValidators,
      '',
      ValidatorSortType.DELEGATION,
      'Desc',
      false,
      ValidatorStatusFilter.STATUS_ACTIVE,
    );
    expect(result[0].delegation.shares).toBe('100');
  });
});
