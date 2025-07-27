import { atom } from 'jotai';
import { Asset, SendObject, TransactionResult } from '@/types';
import { sendStateAtom, receiveStateAtom } from './transactionStateAtom';
import { sendIBC, sendTransaction, swapTransaction } from '@/helpers';
import { subscribedChainRegistryAtom } from './chainRegistryAtom';
import { chainWalletAtom } from './walletAtom';
import { networkLevelAtom } from './networkLevelAtom';

// TODO: may not need this pass-through file
// Core transaction execution atoms
export const executeSendAtom = atom(
  null,
  async (
    get,
    _,
    {
      sendObject,
      simulateTransaction,
    }: {
      sendObject: SendObject;
      simulateTransaction: boolean;
    },
  ): Promise<TransactionResult> => {
    console.group('[transactionAtom] Starting standard send transaction');
    console.log('Input parameters:', { sendObject, simulateTransaction });

    try {
      const sendState = get(sendStateAtom);
      const walletState = get(chainWalletAtom(sendState.chainID));
      const chainRegistry = get(subscribedChainRegistryAtom);
      const networkLevel = get(networkLevelAtom);

      console.log('Retrieved state:', {
        sendState,
        walletState: walletState ? { ...walletState, privateKey: '***' } : null,
        networkLevel,
      });

      const sendChain = chainRegistry[networkLevel][sendState.chainID];
      const prefix = sendChain.bech32_prefix;
      const rpcUris = sendChain.rpc_uris;

      console.log('Chain details:', {
        chainId: sendState.chainID,
        prefix,
        rpcUris,
        networkLevel,
      });

      console.log('Executing sendTransaction with params:', {
        address: walletState.address,
        sendObject,
        simulateTransaction,
        prefix,
        rpcUris,
      });

      const startTime = performance.now();
      const result = await sendTransaction(
        walletState.address,
        sendObject,
        simulateTransaction,
        prefix,
        rpcUris,
      );
      const duration = performance.now() - startTime;

      console.log(`Transaction completed in ${duration.toFixed(2)}ms`);
      console.log('Transaction result:', result);

      if (result.success) {
        console.log('Send transaction successful');
      } else {
        console.error('Send transaction failed:', result.message);
      }

      return result;
    } catch (error) {
      console.error('Error in executeSendAtom:', error);
      throw error;
    } finally {
      console.groupEnd();
    }
  },
);

export const executeIBCAtom = atom(
  null,
  async (
    get,
    _,
    {
      sendObject,
      simulateTransaction,
    }: {
      sendObject: any;
      simulateTransaction: boolean;
    },
  ): Promise<TransactionResult> => {
    console.group('[transactionAtom] Starting IBC transaction');
    console.log('Input parameters:', { sendObject, simulateTransaction });

    try {
      const sendState = get(sendStateAtom);
      const receiveState = get(receiveStateAtom);
      const walletState = get(chainWalletAtom(sendState.chainID));
      const chainRegistry = get(subscribedChainRegistryAtom);
      const networkLevel = get(networkLevelAtom);

      console.log('Retrieved state:', {
        sendState,
        receiveState,
        walletState: walletState ? { ...walletState, privateKey: '***' } : null,
        networkLevel,
      });

      const sendChain = chainRegistry[networkLevel][sendState.chainID];
      const receiveChain = chainRegistry[networkLevel][receiveState.chainID];

      console.log('Chain details:', {
        sendChain: sendChain.chain_name,
        receiveChain: receiveChain.chain_name,
        networkLevel: sendChain.network_level,
        prefix: sendChain.bech32_prefix,
        restUris: sendChain.rest_uris,
        rpcUris: sendChain.rpc_uris,
      });

      const ibcObject = {
        fromAddress: walletState.address,
        sendObject,
        sendChain: sendChain.chain_name,
        receiveChain: receiveChain.chain_name,
        networkLevel: sendChain.network_level,
      };

      console.log('Prepared IBC object:', ibcObject);

      const startTime = performance.now();
      const result = await sendIBC({
        ibcObject,
        prefix: sendChain.bech32_prefix,
        restUris: sendChain.rest_uris,
        rpcUris: sendChain.rpc_uris,
        simulateTransaction,
      });
      const duration = performance.now() - startTime;

      console.log(`IBC transaction completed in ${duration.toFixed(2)}ms`);
      console.log('IBC transaction result:', result);

      if (result.success) {
        console.log('IBC transaction successful');
      } else {
        console.error('IBC transaction failed:', result.message);
      }

      return result;
    } catch (error) {
      console.error('Error in executeIBCAtom:', error);
      throw error;
    } finally {
      console.groupEnd();
    }
  },
);

export const executeSwapAtom = atom(
  null,
  async (
    get,
    _,
    {
      sendObject,
      simulateTransaction,
      receiveAsset,
    }: {
      sendObject: any;
      simulateTransaction: boolean;
      receiveAsset: Asset;
    },
  ): Promise<TransactionResult> => {
    console.group('[transactionAtom] Starting swap transaction');
    console.log('Input parameters:', { sendObject, simulateTransaction, receiveAsset });

    try {
      const sendState = get(sendStateAtom);
      const walletState = get(chainWalletAtom(sendState.chainID));
      const chainRegistry = get(subscribedChainRegistryAtom);
      const networkLevel = get(networkLevelAtom);

      console.log('Retrieved state:', {
        sendState,
        walletState: walletState ? { ...walletState, privateKey: '***' } : null,
        networkLevel,
      });

      const swapParams = {
        sendObject,
        resultDenom: receiveAsset.denom,
      };
      const restUris = chainRegistry[networkLevel][sendState.chainID].rest_uris;

      console.log('Swap parameters:', {
        address: walletState.address,
        swapParams,
        restUris,
        simulateTransaction,
      });

      const startTime = performance.now();
      const result = await swapTransaction(
        walletState.address,
        swapParams,
        restUris,
        simulateTransaction,
      );
      const duration = performance.now() - startTime;

      console.log(`Swap transaction completed in ${duration.toFixed(2)}ms`);
      console.log('Swap transaction result:', result);

      if (result.success) {
        console.log('Swap transaction successful');
      } else {
        console.error('Swap transaction failed:', result.message);
      }

      return result;
    } catch (error) {
      console.error('Error in executeSwapAtom:', error);
      throw error;
    } finally {
      console.groupEnd();
    }
  },
);
