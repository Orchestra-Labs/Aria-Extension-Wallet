import {
  claimRewards,
  claimAndRestake,
  claimAndUnstake,
  stakeToValidator,
} from '@/helpers/stakingTransactions';
import { Intent, FullValidatorInfo, Asset } from '@/types';
import {
  DEFAULT_FEE_TOKEN,
  GREATER_EXPONENT_DEFAULT,
  LOCAL_CHAIN_REGISTRY,
  SYMPHONY_MAINNET_ID,
} from '@/constants';

type ValidatorTarget =
  | string
  | {
      operator_address: string;
      moniker: string;
      commission: string;
    };

export const handleIntent = async (
  intent: Intent,
  {
    address,
    walletAssets,
    validators,
    symphonyAssets,
  }: {
    address: string;
    walletAssets: Asset[];
    validators: FullValidatorInfo[];
    symphonyAssets: Asset[];
  },
) => {
  console.log('[handleIntent] Received intent:', intent);
  const { action, amount, coin, target, unitReference = 'coin' } = intent;

  if (!address || validators.length === 0) {
    console.error('[handleIntent] Missing wallet address or validator list');
    return;
  }

  const userDelegations = validators.filter(v => parseFloat(v.balance.amount) > 0);

  const resolveCoinDenom = (
    input: { name?: string; symbol?: string; denom?: string } | undefined,
  ): { asset: Asset; matchedField: 'denom' | 'symbol' | 'name' } | undefined => {
    if (!input) return;
    const lower = (val?: string) => val?.toLowerCase();
    for (const key of ['denom', 'symbol', 'name'] as const) {
      const match = symphonyAssets.find(a => lower(a[key]) === lower(input[key]));
      if (match) return { asset: match, matchedField: key };
    }
    console.error('[handleIntent] No matching coin found for:', input);
    return;
  };

  const resolved = resolveCoinDenom(coin);
  if (!resolved) return;

  const { asset } = resolved;
  const resolvedDenom = asset.denom;
  const walletAsset = walletAssets.find(a => a.denom === resolvedDenom);
  const available = walletAsset ? parseFloat(walletAsset.amount) : 0;

  console.log('[handleIntent] Resolved denom:', resolvedDenom);
  console.log('[handleIntent] Wallet asset found:', walletAsset);
  console.log('[handleIntent] Available balance:', available);

  // TODO: get chain information dynamically.  pass in registry, check validator lists for matches, etc
  const chain = LOCAL_CHAIN_REGISTRY.mainnet[SYMPHONY_MAINNET_ID];
  const feeToken = DEFAULT_FEE_TOKEN;

  const resolveValidator = (input: ValidatorTarget): FullValidatorInfo | undefined => {
    if (typeof input === 'object') {
      return (
        validators.find(v => v.validator.operator_address === input.operator_address) ||
        validators.find(
          v => v.validator.description.moniker.toLowerCase() === input.moniker?.toLowerCase(),
        )
      );
    }
    return (
      validators.find(v => v.validator.operator_address === input) ||
      validators.find(v => v.validator.description.moniker.toLowerCase() === input.toLowerCase())
    );
  };

  const simulateFee = async (simulateFn: () => Promise<any>): Promise<number | null> => {
    const result = await simulateFn();
    if (!result || !result.success || result.data?.code !== 0) {
      console.error('[handleIntent] Simulation failed.', result);
      return null;
    }
    const gasWanted = parseFloat(result.data.gasWanted || '0');
    const feeAmount = gasWanted * 0.025;
    const feeInGreaterUnit = feeAmount / Math.pow(10, GREATER_EXPONENT_DEFAULT);
    console.log('[handleIntent] Simulated fee:', feeInGreaterUnit);
    return feeInGreaterUnit;
  };

  switch (action) {
    case 'claim': {
      const targets = (target ? [resolveValidator(target)] : userDelegations).filter(
        (v): v is FullValidatorInfo => !!v,
      );

      if (targets.length === 0) {
        console.error('[handleIntent] No valid validators found for claim');
        return;
      }

      const fee = await simulateFee(() => claimRewards(chain, targets, feeToken, true));
      if (fee === null || fee > available) {
        console.error('[handleIntent] Insufficient balance for claim fee');
        return;
      }

      return await claimRewards(chain, targets, feeToken);
    }

    case 'claimAndRestake': {
      const targets = (target ? [resolveValidator(target)] : userDelegations).filter(
        (v): v is FullValidatorInfo => !!v,
      );

      if (targets.length === 0) {
        console.error('[handleIntent] No valid validators found for claimAndRestake');
        return;
      }

      const fee = await simulateFee(() => claimAndRestake(chain, targets, feeToken, true));
      if (fee === null || fee > available) {
        console.error('[handleIntent] Insufficient balance for claimAndRestake fee');
        return;
      }

      return await claimAndRestake(chain, targets, feeToken);
    }

    case 'unstake': {
      const targets = (target ? [resolveValidator(target)] : userDelegations).filter(
        (v): v is FullValidatorInfo => !!v,
      );

      if (targets.length === 0) {
        console.error('[handleIntent] No valid validators found for unstake');
        return;
      }

      const fee = await simulateFee(() =>
        claimAndUnstake({
          chain,
          validatorInfoArray: targets,
          amount: amount?.toString(),
          feeToken,
          simulateOnly: true,
        }),
      );
      if (fee === null || fee > available) {
        console.error('[handleIntent] Insufficient balance for unstake fee');
        return;
      }

      return await claimAndUnstake({
        chain,
        validatorInfoArray: targets,
        amount: amount?.toString(),
        feeToken,
      });
    }

    case 'stake': {
      if (!target || !asset) {
        console.error('[handleIntent] Missing target or token info for staking.');
        return;
      }

      const validator = resolveValidator(target);
      if (!validator) {
        console.error('[handleIntent] No validator matching target:', target);
        return;
      }

      const fee = await simulateFee(() =>
        stakeToValidator(
          '1',
          resolvedDenom,
          address,
          validator.validator.operator_address,
          chain,
          feeToken,
          true,
        ),
      );
      if (fee === null || fee >= available) {
        console.error('[handleIntent] Insufficient balance for stake fee');
        return;
      }

      const exponent = asset.exponent || GREATER_EXPONENT_DEFAULT;
      let finalAmount: number;
      if (amount === 'all') {
        finalAmount = available - fee;
      } else {
        const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount || '0');
        if (isNaN(numericAmount)) {
          console.error('[handleIntent] Invalid stake amount');
          return;
        }
        if (numericAmount + fee > available) {
          console.error('[handleIntent] Stake amount + fee exceeds available balance');
          return;
        }
        finalAmount =
          unitReference === 'denom' ? numericAmount * Math.pow(10, exponent) : numericAmount;
      }

      const before = available;
      const feeRaw = fee * Math.pow(10, exponent);
      const after = before - finalAmount - feeRaw;

      if (after < 0) {
        console.error('[handleIntent] Stake amount + fee exceeds available balance');
        return;
      }

      const result = await stakeToValidator(
        finalAmount.toString(),
        resolvedDenom,
        address,
        validator.validator.operator_address,
        chain,
        feeToken,
      );

      return {
        ...result,
      };
    }

    default:
      console.warn('[handleIntent] Unknown action:', action);
  }
};
