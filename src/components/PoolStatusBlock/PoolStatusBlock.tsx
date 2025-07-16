import { Loader } from '@/components';
import { DEFAULT_ASSET, GREATER_EXPONENT_DEFAULT } from '@/constants';
import { convertToGreaterUnit, formatBalanceDisplay } from '@/helpers';
import { useExchangePoolBalance, useExchangeRequirements } from '@/hooks';
import { useReservePoolBalance } from '@/hooks';
import { useGetTobinTaxRateQuery } from '@/hooks/useGetTobinTaxRateQuery';
import { Button } from '@/ui-kit';

const DEFAULT_ASSET_SYMBOL = DEFAULT_ASSET.symbol || 'MLD';

interface PoolStatusBlockProps {
  onBack: () => void;
}

export const PoolStatusBlock = ({ onBack }: PoolStatusBlockProps) => {
  const { balance: reservePoolBalance, isLoading: loadingReservePoolBalance } =
    useReservePoolBalance();
  const { balance: exchangePoolBalance, isLoading: loadingExchangePoolBalance } =
    useExchangePoolBalance();
  const { totalRequirement } = useExchangeRequirements();
  const { data, isLoading: loadingTaxRate } = useGetTobinTaxRateQuery();

  const reserveAmount = parseFloat(reservePoolBalance?.amount || '0');
  const exchangeAmount = parseFloat(exchangePoolBalance?.amount || '0');
  const requirementAmount = parseFloat(totalRequirement || '0');

  // Collateral = Exchange Balance + Reserve Balance
  const collateral = reserveAmount + exchangeAmount;

  // Collateral to Obligation Ratio
  const collateralToObligationRatio =
    requirementAmount > 0 ? Math.round(collateral / requirementAmount) : 'N/A';

  // Formatted values (rounded to whole numbers)
  const formattedReservePoolBalance = formatBalanceDisplay(
    `${Math.round(
      convertToGreaterUnit(reserveAmount, DEFAULT_ASSET.exponent || GREATER_EXPONENT_DEFAULT),
    )}`,
    DEFAULT_ASSET_SYMBOL,
  );
  const formattedExchangePoolBalance = formatBalanceDisplay(
    `${Math.round(
      convertToGreaterUnit(exchangeAmount, DEFAULT_ASSET.exponent || GREATER_EXPONENT_DEFAULT),
    )}`,
    DEFAULT_ASSET_SYMBOL,
  );
  const formattedExchangeRequirement = formatBalanceDisplay(
    `${Math.round(
      convertToGreaterUnit(requirementAmount, DEFAULT_ASSET.exponent || GREATER_EXPONENT_DEFAULT),
    )}`,
    DEFAULT_ASSET_SYMBOL,
  );
  const formattedTaxRate = Math.round(Number(data?.tax_rate));

  const isLoading = loadingReservePoolBalance || loadingExchangePoolBalance || loadingTaxRate;

  return (
    <div className="py-4 flex flex-grow flex-col items-center relative">
      <div className="flex flex-grow flex-col items-center text-center w-full">
        {isLoading && <Loader scaledHeight />}
        {!isLoading && (
          <div className="flex flex-col gap-2.5 w-full">
            {/* Collateral to Obligation Ratio */}
            <div>
              <div className="flex justify-between items-center w-full px-4">
                <div className="flex flex-1">
                  <span>&nbsp;</span>
                </div>
                <div className="flex flex-1">
                  <span>&nbsp;</span>
                </div>
                <div className="flex">
                  <p className="text-sm text-neutral-1 whitespace-nowrap truncate">
                    Collateral : Obligation Ratio
                  </p>
                </div>
                <div className="flex flex-1">
                  <span>&nbsp;</span>
                </div>
                <div className="flex flex-1 justify-center">
                  <Button
                    variant="selectedEnabled"
                    size="xsmall"
                    className="px-1 rounded text-xs"
                    onClick={onBack}
                  >
                    Back
                  </Button>
                </div>
              </div>
              <div className="flex justify-center w-full px-4">
                <p className="text-h5 text-white font-bold">{collateralToObligationRatio}:1</p>
              </div>
            </div>

            {/* Exchange Balance vs Exchange Requirements */}
            <div className="flex justify-between w-full">
              <div className="w-1/2 text-center">
                <p className="text-sm text-neutral-1 whitespace-nowrap truncate">
                  Exchange Balance
                </p>
                <p className="text-h5 text-white font-bold">{formattedExchangePoolBalance}</p>
              </div>
              <div className="w-1/2 text-center">
                <p className="text-sm text-neutral-1 whitespace-nowrap truncate">
                  Exchange Requirements
                </p>
                <p className="text-h5 text-white font-bold">{formattedExchangeRequirement}</p>
              </div>
            </div>

            {/* Reserve Balance vs Tax Rate */}
            <div className="flex justify-between w-full">
              <div className="w-1/2 text-center">
                <p className="text-sm text-neutral-1 whitespace-nowrap truncate">Reserve Balance</p>
                <p className="text-h5 text-white font-bold">{formattedReservePoolBalance}</p>
              </div>
              <div className="w-1/2 text-center">
                <p className="text-sm text-neutral-1 whitespace-nowrap truncate">Tax Rate</p>
                <p className="text-h5 text-white font-bold">{formattedTaxRate}%</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
