import { Spinner } from '@/assets/icons';
import { TransactionStatus } from '@/constants';
import { useAtomValue } from 'jotai';
import {
  calculatedFeeAtom,
  isLoadingAtom,
  transactionErrorAtom,
  transactionFailedAtom,
  transactionRouteAtom,
} from '@/atoms';
import { TransactionResultsTile } from '@/components';
import { formatLowBalanceDisplay } from '@/helpers';

export const TransactionInfoPanel = () => {
  const isLoading = useAtomValue(isLoadingAtom);
  const transactionFailed = useAtomValue(transactionFailedAtom);
  const transactionError = useAtomValue(transactionErrorAtom);
  const calculatedFee = useAtomValue(calculatedFeeAtom);
  const transactionRoute = useAtomValue(transactionRouteAtom);

  return (
    <>
      {/* 
          TODO: add labels above text in info block
          TODO: view error then resolve to list
        */}
      {/* Info Section */}
      <div
        className={`flex flex-grow mx-2 my-4 border rounded-md border-neutral-4 justify-center ${
          isLoading || transactionError
            ? 'items-center '
            : 'flex-col items-start overflow-y-auto p-4'
        }`}
      >
        {isLoading && <Spinner className="h-16 w-16 animate-spin fill-blue" />}
        {transactionFailed && (
          <TransactionResultsTile isSuccess={false} size="sm" message={transactionError} />
        )}
        {!isLoading &&
          !transactionFailed &&
          transactionRoute.steps.map((step, index) => (
            <div
              key={`${step.type}-${index}`}
              className="flex justify-between items-center w-full text-sm text-white mb-1"
            >
              <span className="text-left truncate">{step.log.description}</span>
              <span className="flex justify-end text-right w-[1rem]">
                {step.log.status === TransactionStatus.SUCCESS && (
                  <span className="h-4 w-4 text-success">✔</span>
                )}
                {step.log.status === TransactionStatus.PENDING && (
                  <Spinner className="h-4 w-4 animate-spin fill-blue" />
                )}
                {step.log.status === TransactionStatus.ERROR && (
                  <span className="h-4 w-4 text-error">✖</span>
                )}
                {step.log.status === TransactionStatus.IDLE && (
                  <span className="h-4 w-4 text-gray-500">—</span>
                )}
              </span>
            </div>
          ))}
      </div>

      {/* TODO: move fee section to own component (reused in other places) */}
      {/* Fee Section */}
      <div className="flex justify-between items-center text-blue text-sm font-bold mx-2">
        <p>Estimated Fee</p>
        <p className={calculatedFee.textClass}>
          {calculatedFee && calculatedFee.feeAmount > 0
            ? formatLowBalanceDisplay(`${calculatedFee.calculatedFee}`, calculatedFee.feeUnit)
            : '-'}
        </p>
      </div>
    </>
  );
};
