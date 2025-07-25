import {
  isFetchingWalletDataAtom,
  isInitialDataLoadAtom,
  userAccountAtom,
  validatorDataAtom,
  allWalletAssetsAtom,
  isFetchingValidatorDataAtom,
  networkLevelAtom,
  walletAddressesAtom,
  isGeneratingAddressesAtom,
} from '@/atoms';

import { useRefreshData, useRegistryDataRefresh, useAddressGeneration } from '@/hooks';
import { useAtom, useAtomValue } from 'jotai';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const DataProviderContext = createContext<{
  prepAddressDataReload: () => void;
}>({
  prepAddressDataReload: () => console.warn('DataProvider not initialized'),
});

export const useDataProviderControls = () => useContext(DataProviderContext);

interface DataProviderProps {
  children?: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { refreshData } = useRefreshData();
  const { refreshRegistry, subscribedChainRegistry } = useRegistryDataRefresh();
  const { generateAddresses } = useAddressGeneration();

  const [isInitialDataLoad, setIsInitialDataLoad] = useAtom(isInitialDataLoadAtom);
  const validatorData = useAtomValue(validatorDataAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const networkLevel = useAtomValue(networkLevelAtom);
  const walletAssets = useAtomValue(allWalletAssetsAtom);
  const walletAddresses = useAtomValue(walletAddressesAtom);

  const isGeneratingAddresses = useAtomValue(isGeneratingAddressesAtom);
  const isFetchingWallet = useAtomValue(isFetchingWalletDataAtom);
  const isFetchingValidators = useAtomValue(isFetchingValidatorDataAtom);

  const [phase1LoadComplete, setPhase1LoadComplete] = useState(false);
  const [phase2LoadComplete, setPhase2LoadComplete] = useState(false);
  const [phase3LoadComplete, setPhase3LoadComplete] = useState(false);

  // Check if we have all required data to start loading
  const isReadyToLoadInitial = useMemo(() => {
    return (
      !!userAccount &&
      Object.keys(subscribedChainRegistry?.mainnet || {}).length > 0 &&
      Object.keys(walletAddresses).length > 0 &&
      !isGeneratingAddresses
    );
  }, [subscribedChainRegistry, userAccount, walletAddresses, isGeneratingAddresses]);

  const prepAddressDataReload = useCallback(() => {
    console.log('[DataProvider] Preparing address data reload');
    setPhase2LoadComplete(false);
    setPhase3LoadComplete(false);
  }, []);

  // Initialize registry data when user account changes
  // Replace the current useEffect for address generation with this:
  useEffect(() => {
    const loadPhase1 = async () => {
      if (!userAccount || phase1LoadComplete) return;

      try {
        await refreshRegistry();
        setPhase1LoadComplete(true);
      } catch (error) {
        console.error('[DataProvider] Phase 1 load failed:', error);
      }
    };

    loadPhase1();
  }, [userAccount, phase1LoadComplete]);

  useEffect(() => {
    const loadPhase2 = async () => {
      if (!userAccount || !phase1LoadComplete || phase2LoadComplete) return;

      try {
        await generateAddresses();
        setPhase2LoadComplete(true);
      } catch (error) {
        console.error('[DataProvider] Phase 2 load failed:', error);
      }
    };

    loadPhase2();
  }, [userAccount, phase1LoadComplete]);

  useEffect(() => {
    const loadPhase3 = async () => {
      if (!phase1LoadComplete || !phase2LoadComplete || !isReadyToLoadInitial || phase3LoadComplete)
        return;

      try {
        await refreshData();
        setPhase3LoadComplete(true);
      } catch (error) {
        console.error('[DataProvider] Phase 3 load failed:', error);
      }
    };

    loadPhase3();
  }, [phase2LoadComplete, isReadyToLoadInitial]);

  // Handle initial data load completion
  useEffect(() => {
    if (!isInitialDataLoad || !phase3LoadComplete) return;

    const hasLoaded =
      !isFetchingWallet &&
      !isFetchingValidators &&
      (walletAssets?.length > 0 || validatorData?.length > 0);

    if (hasLoaded) {
      console.log('[DataProvider] Initial data load complete');
      setIsInitialDataLoad(false);
    }
  }, [
    isInitialDataLoad,
    phase3LoadComplete,
    isFetchingWallet,
    isFetchingValidators,
    walletAssets,
    validatorData,
  ]);

  // Refresh data when network level changes
  useEffect(() => {
    if (!userAccount || !phase3LoadComplete) return;

    refreshData();
  }, [networkLevel]);

  return (
    <DataProviderContext.Provider value={{ prepAddressDataReload }}>
      {children}
    </DataProviderContext.Provider>
  );
};
