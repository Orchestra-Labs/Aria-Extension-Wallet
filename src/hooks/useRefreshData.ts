import { useValidatorDataRefresh } from './useValidatorDataRefresh';
import { useWalletDataRefresh } from './useWalletDataRefresh';

export function useRefreshData() {
  const { triggerWalletDataRefresh } = useWalletDataRefresh();
  const { triggerValidatorDataRefresh } = useValidatorDataRefresh();

  const refreshData = async ({
    wallet = true,
    validator = true,
  }: { wallet?: boolean; validator?: boolean; address?: string } = {}) => {
    console.log('[useRefreshData] Refreshing data', { wallet, validator });

    if (wallet) {
      console.log('[useRefreshData] Triggering wallet refresh');
      triggerWalletDataRefresh();
    }
    if (validator) {
      console.log('[useRefreshData] Triggering validator refresh');
      triggerValidatorDataRefresh();
    }
  };

  return { refreshData };
}
