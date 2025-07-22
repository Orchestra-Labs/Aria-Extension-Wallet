import { BondStatus, TextFieldStatus } from '@/constants';
import { ValidatorInfo } from '@/types';

export const getValidatorStatus = (validator: ValidatorInfo) => {
  if (validator.jailed) return { label: 'Jailed', color: TextFieldStatus.ERROR };
  if (validator.status === BondStatus.UNBONDING)
    return { label: 'Unbonding', color: TextFieldStatus.WARN };
  if (validator.status === BondStatus.UNBONDED)
    return { label: 'Inactive', color: TextFieldStatus.WARN };
  return { label: 'Active', color: TextFieldStatus.GOOD };
};

export const getUptimeStatus = (validator: ValidatorInfo, uptime: number) => {
  if (validator.jailed || validator.status === BondStatus.UNBONDED) return TextFieldStatus.ERROR;
  if (uptime < 90) return TextFieldStatus.ERROR;
  if (uptime < 98) return TextFieldStatus.WARN;
  return TextFieldStatus.GOOD;
};

export const getVotingPowerStatus = (power: number, evenSplit: number) => {
  if (power === 0) return TextFieldStatus.ERROR;
  if (power > evenSplit * 2) return TextFieldStatus.ERROR;
  if (power > evenSplit * 1.5) return TextFieldStatus.WARN;
  return TextFieldStatus.GOOD;
};

export const getFeeTextClass = (percentage: number) => {
  if (percentage > 1) return 'text-error';
  if (percentage > 0.75) return 'text-warn';
  return 'text-blue';
};
