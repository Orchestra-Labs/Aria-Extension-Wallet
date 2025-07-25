import { useCallback, useState } from 'react';
import { useRegistryDataRefresh, useAddressGeneration, useRefreshData } from '@/hooks';

export const usePhasedDataLoading = () => {
  const { refreshRegistry } = useRegistryDataRefresh();
  const { generateAddresses } = useAddressGeneration();
  const { refreshData } = useRefreshData();

  const [phase1LoadComplete, setPhase1LoadComplete] = useState(false);
  const [phase2LoadComplete, setPhase2LoadComplete] = useState(false);
  const [phase3LoadComplete, setPhase3LoadComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const executePhases = useCallback(async () => {
    setIsProcessing(true);
    try {
      // Phase 1: Refresh registry
      await refreshRegistry();
      setPhase1LoadComplete(true);

      // Phase 2: Generate addresses
      await generateAddresses();
      setPhase2LoadComplete(true);

      // Phase 3: Refresh all data
      await refreshData();
      setPhase3LoadComplete(true);
    } catch (error) {
      console.error('Phased loading failed:', error);
      // Reset phases if failed
      setPhase1LoadComplete(false);
      setPhase2LoadComplete(false);
      setPhase3LoadComplete(false);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [refreshRegistry, generateAddresses, refreshData]);

  const resetPhases = useCallback(() => {
    setPhase1LoadComplete(false);
    setPhase2LoadComplete(false);
    setPhase3LoadComplete(false);
  }, []);

  return {
    executePhases,
    resetPhases,
    isProcessing,
    phase1LoadComplete,
    phase2LoadComplete,
    phase3LoadComplete,
  };
};
