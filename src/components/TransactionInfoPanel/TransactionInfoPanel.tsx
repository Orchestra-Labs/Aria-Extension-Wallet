import { Spinner } from '@/assets/icons';
import { TransactionStatus } from '@/constants';
import { useAtomValue } from 'jotai';
import {
  calculatedFeeAtom,
  isLoadingAtom,
  transactionErrorAtom,
  transactionFailedAtom,
  transactionLogAtom,
} from '@/atoms';
import { TransactionResultsTile } from '@/components';
import { formatLowBalanceDisplay } from '@/helpers';

export const TransactionInfoPanel = () => {
  const isLoading = useAtomValue(isLoadingAtom);
  const transactionFailed = useAtomValue(transactionFailedAtom);
  const transactionError = useAtomValue(transactionErrorAtom);
  const transactionLog = useAtomValue(transactionLogAtom);
  const calculatedFee = useAtomValue(calculatedFeeAtom);

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
          transactionLog.entries.map(entry => (
            <div
              key={entry.description}
              className="flex justify-between items-center w-full text-sm text-white mb-1"
            >
              <span className="text-left truncate">{entry.description}</span>
              <span className="flex justify-end text-right w-[1rem]">
                {entry.status === TransactionStatus.SUCCESS && (
                  <span className="h-4 w-4 text-success">✔</span>
                )}
                {entry.status === TransactionStatus.LOADING && (
                  <Spinner className="h-4 w-4 animate-spin fill-blue" />
                )}
                {entry.status === TransactionStatus.ERROR && (
                  <span className="h-4 w-4 text-error">✖</span>
                )}
                {entry.status === TransactionStatus.IDLE && (
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
