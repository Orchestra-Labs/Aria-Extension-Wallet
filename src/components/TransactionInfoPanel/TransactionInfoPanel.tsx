import { Spinner } from '@/assets/icons';
import { TransactionStatus } from '@/constants';
import { useAtomValue } from 'jotai';
import {
  calculatedTotalFeeDisplayAtom,
  transactionErrorAtom,
  transactionFailedAtom,
  transactionRouteAtom,
} from '@/atoms';
import { formatLowBalanceDisplay } from '@/helpers';
import { getStepLogAtom } from '@/atoms/transactionLogsAtom';
import { TransactionStep } from '@/types';

export const TransactionInfoPanel = () => {
  const transactionFailed = useAtomValue(transactionFailedAtom);
  const transactionError = useAtomValue(transactionErrorAtom);
  const transactionRoute = useAtomValue(transactionRouteAtom);
  const calculatedFee = useAtomValue(calculatedTotalFeeDisplayAtom);

  const isSimulation = transactionRoute.isSimulation;

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case TransactionStatus.SUCCESS:
        return <span className="h-4 w-4 text-success">✔</span>;
      case TransactionStatus.PENDING:
        return <Spinner className="h-4 w-4 animate-spin fill-blue" />;
      case TransactionStatus.ERROR:
        return <span className="h-4 w-4 text-error">✖</span>;
      case TransactionStatus.IDLE:
      default:
        return <span className="h-4 w-4 text-gray-500">—</span>;
    }
  };

  // Component to render each step with its log
  const TransactionStepItem = ({ step, index }: { step: TransactionStep; index: number }) => {
    const log = useAtomValue(getStepLogAtom(step.hash));

    return (
      <div
        key={`${step.type}-${index}`}
        className="flex justify-between items-center w-full text-sm text-white mb-1"
      >
        <span className="text-left truncate">{log?.description || 'Processing...'}</span>
        <span className="flex justify-end text-right w-[1rem]">
          {getStatusIcon(log?.status || TransactionStatus.IDLE)}
        </span>
      </div>
    );
  };

  return (
    <>
      {/* 
          TODO: add labels above text in info block
          TODO: view error then resolve to list
        */}
      {/* Info Section */}
      <div
        className={`flex flex-grow mx-2 my-2 border rounded-md border-neutral-4 justify-center ${
          //isTxPending ||
          transactionFailed && !isSimulation
            ? 'items-center '
            : 'flex-col items-start overflow-y-auto p-4'
        }`}
      >
        {/* {isTxPending && <Spinner className="h-16 w-16 animate-spin fill-blue" />} */}
        {/* {transactionFailed && !isSimulation && (
          <TransactionResultsTile isSuccess={false} size="sm" message={transactionError} />
        )} */}
        {transactionRoute.steps.length === 0 ? (
          <span className="text-white text-sm">Calculating transaction route...</span>
        ) : (
          transactionRoute.steps.map((step, index) => (
            <TransactionStepItem key={`${step.type}-${index}`} step={step} index={index} />
          ))
        )}
      </div>

      {/* TODO: move fee section to own component (reused in other places) */}
      {/* Fee Section */}
      <div className="flex justify-between items-center text-blue text-sm font-bold mx-2">
        {transactionFailed ? (
          <>
            <p>Error:</p>
            <p className="text-error truncate max-w-[50%]">
              {transactionError ? transactionError : 'Unidentified error'}
            </p>
          </>
        ) : (
          <>
            <p>Estimated Fee</p>
            <p className={calculatedFee.textClass}>
              {calculatedFee && calculatedFee.feeAmount > 0
                ? formatLowBalanceDisplay(`${calculatedFee.calculatedFee}`, calculatedFee.feeUnit)
                : '-'}
            </p>
          </>
        )}
      </div>
    </>
  );
};
