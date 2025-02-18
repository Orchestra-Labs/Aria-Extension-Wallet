import { Loader } from '@/components';
import { DEFAULT_ASSET, ROUTES } from '@/constants';
import { formatBalanceDisplay } from '@/helpers';
import { useExchangePoolBalance } from '@/hooks';
import { useReservePoolBalance } from '@/hooks';
import { useGetTobinTaxRateQuery } from '@/hooks/useGetTobinTaxRateQuery';
import { Button } from '@/ui-kit';
import { Link } from 'react-router-dom';

const DEFAULT_ASSET_SYMBOL = DEFAULT_ASSET.symbol || 'MLD';

export const PoolStatus = () => {
  const { balance: reservePoolBalance, isLoading: loadingReservePoolBalance } =
    useReservePoolBalance();
  const { balance: exchangePoolBalance, isLoading: loadingExchangePoolBalance } =
    useExchangePoolBalance();
  const { data, isLoading: loadingTaxRate } = useGetTobinTaxRateQuery();

  const formattedReservePoolBalance = formatBalanceDisplay(
    reservePoolBalance?.amount ?? '0',
    DEFAULT_ASSET_SYMBOL,
  );
  const formattedExchangePoolBalance = formatBalanceDisplay(
    exchangePoolBalance?.amount ?? '0',
    DEFAULT_ASSET_SYMBOL,
  );
  const formattedTaxRate = Number(data?.tax_rate).toFixed(2)

  const isLoading = loadingReservePoolBalance || loadingExchangePoolBalance || loadingTaxRate;

  return (
    <div className="h-full flex flex-col overflow-hidden p-4">
      <div className="h-44 border rounded-xl border-neutral-4 flex relative overflow-hidden">
        <div className="p-4 flex flex-grow flex-col items-center relative">
          <div className="flex flex-grow flex-col items-center text-center">
            {isLoading && <Loader scaledHeight />}
            {!isLoading && (
              <div className="flex flex-col gap-2.5">
                  <div>
                  <p className="text-sm text-neutral-1 line-clamp-1">Tax rate</p>
                  <p className="text-h5 text-white font-bold line-clamp-1">{formattedTaxRate}</p>
                </div>
            
                <div>
                  <p className="text-sm text-neutral-1 line-clamp-1">Exchange pool</p>
                  <p className="text-h5 text-white font-bold line-clamp-1">
                    {formattedExchangePoolBalance}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-neutral-1 line-clamp-1">Reserve pool</p>
                  <p className="text-h5 text-white font-bold line-clamp-1">
                    {formattedReservePoolBalance}
                  </p>
                </div>
              
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-2.5 right-2.5">
          <Button variant={'selected'} size="xsmall" className="px-1 rounded text-xs" asChild>
            <Link to={ROUTES.APP.ROOT}>Back</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
