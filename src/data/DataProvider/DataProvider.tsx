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
import { useEffect, useMemo, useState } from 'react';

export const DataProvider: React.FC = () => {
  const { refreshData } = useRefreshData();
  const { refreshRegistry, chainRegistry } = useRegistryDataRefresh();
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

  // Check if we have all required data to start loading
  const isReadyToLoadInitial = useMemo(() => {
    return (
      !!userAccount &&
      Object.keys(chainRegistry?.mainnet || {}).length > 0 &&
      Object.keys(walletAddresses).length > 0 &&
      !isGeneratingAddresses
    );
  }, [chainRegistry, userAccount, walletAddresses, isGeneratingAddresses]);

  // Initialize registry data when user account changes
  // Replace the current useEffect for address generation with this:
  useEffect(() => {
    const loadPhase1 = async () => {
      if (!userAccount || phase1LoadComplete) return;

      try {
        await refreshRegistry();
        await generateAddresses();
        setPhase1LoadComplete(true);
      } catch (error) {
        console.error('[DataProvider] Phase 1 load failed:', error);
      }
    };

    loadPhase1();
  }, [userAccount, phase1LoadComplete]);

  useEffect(() => {
    const loadPhase2 = async () => {
      if (!phase1LoadComplete || !isReadyToLoadInitial || phase2LoadComplete) return;

      try {
        await refreshData();
        setPhase2LoadComplete(true);
      } catch (error) {
        console.error('[DataProvider] Phase 2 load failed:', error);
      }
    };

    loadPhase2();
  }, [phase1LoadComplete, isReadyToLoadInitial, phase2LoadComplete]);

  // Handle initial data load completion
  useEffect(() => {
    if (!isInitialDataLoad || !phase2LoadComplete) return;

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
    phase2LoadComplete,
    isFetchingWallet,
    isFetchingValidators,
    walletAssets,
    validatorData,
  ]);

  // Refresh data when network level changes
  useEffect(() => {
    if (!userAccount || !phase2LoadComplete) return;

    refreshData();
  }, [networkLevel, userAccount, phase2LoadComplete]);

  return null;
};
