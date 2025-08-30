import { useAtomValue } from 'jotai';
import { fullRegistryChainInfoAtom } from '@/atoms';
import { OfflineAminoSigner } from '@cosmjs/amino';
import { OfflineDirectSigner } from '@cosmjs/proto-signing';
import {
  getCombinedCosmosSigner,
  getEvmStandardSigner,
  getSessionToken,
  getSvmStandardSigner,
} from '@/helpers';
import { WalletClient } from 'viem';
import { Adapter } from '@solana/wallet-adapter-base';

export const useGetSigner = () => {
  const getChainInfo = useAtomValue(fullRegistryChainInfoAtom);

  const getChainPrefix = (chainId: string): string => {
    const chainInfo = getChainInfo(chainId);
    return chainInfo?.bech32_prefix || 'cosmos';
  };

  // Create a combined signer that supports both Amino and Direct signing
  const getCosmosSigner = async (
    chainId: string,
  ): Promise<OfflineAminoSigner & OfflineDirectSigner> => {
    const sessionToken = getSessionToken();
    if (!sessionToken?.mnemonic) {
      throw new Error('No session token or mnemonic found');
    }

    const prefix = getChainPrefix(chainId);

    try {
      // Use the existing function from signers file
      return await getCombinedCosmosSigner(sessionToken.mnemonic, prefix);
    } catch (error) {
      console.error('Error creating signer for chain:', chainId, error);
      throw new Error(`Failed to create signer for chain ${chainId}`);
    }
  };

  const getEvmSigner = async (chainId: string): Promise<WalletClient> => {
    const sessionToken = getSessionToken();
    if (!sessionToken?.mnemonic) {
      throw new Error('No session token or mnemonic found');
    }

    const chain = getChainInfo(chainId);

    try {
      return await getEvmStandardSigner(sessionToken.mnemonic, chain);
    } catch (error) {
      console.error('Error creating EVM signer for chain:', chainId, error);
      throw new Error(`Failed to create EVM signer for chain ${chainId}`);
    }
  };

  const getSvmSigner = async (): Promise<Adapter> => {
    const sessionToken = getSessionToken();
    if (!sessionToken?.mnemonic) {
      throw new Error('No session token or mnemonic found');
    }

    try {
      return (await getSvmStandardSigner(sessionToken.mnemonic)) as unknown as Adapter;
    } catch (error) {
      console.error('Error creating SVM signer:', error);
      throw new Error('Failed to create SVM signer');
    }
  };

  return {
    getCosmosSigner,
    getEvmSigner,
    getSvmSigner,
  };
};
