import { loadSymphonyStablecoinsAtom } from '@/atoms';
import { useSetAtom } from 'jotai';

export const useSymphonyStablecoins = () => {
  const loadSymphonyStablecoins = useSetAtom(loadSymphonyStablecoinsAtom);

  const triggerSymphonyStablecoinsRefresh = () => {
    loadSymphonyStablecoins();
  };

  return {
    triggerSymphonyStablecoinsRefresh,
  };
};
