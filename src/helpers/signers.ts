import {
  AccountData,
  AminoSignResponse,
  OfflineAminoSigner,
  Secp256k1HdWallet,
  StdSignDoc,
} from '@cosmjs/amino';
import { DirectSecp256k1HdWallet, OfflineDirectSigner } from '@cosmjs/proto-signing';
import { DirectSignResponse } from '@cosmjs/proto-signing';
import { SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { SimplifiedChainInfo } from '@/types';
import { WalletClient, createWalletClient, http } from 'viem';
import { HDNodeWallet } from 'ethers';
import { mainnet, polygon, arbitrum, optimism, base, sepolia } from 'viem/chains';
import { mnemonicToSeedSync } from 'bip39';
import { privateKeyToAccount } from 'viem/accounts';

// For Cosmos chains using mnemonic
export const getCosmosDirectSigner = async (
  mnemonic: string,
  prefix: string,
): Promise<DirectSecp256k1HdWallet> => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
  console.log(`Offline signer created with prefix "${prefix}"`);
  return wallet;
};

export const getCosmosAminoSigner = async (
  mnemonic: string,
  prefix: string,
): Promise<Secp256k1HdWallet> => {
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
  console.log(`Amino signer created with prefix "${prefix}"`);
  return wallet;
};

export const getCombinedCosmosSigner = async (
  mnemonic: string,
  prefix: string,
): Promise<OfflineAminoSigner & OfflineDirectSigner> => {
  const directWallet = await getCosmosDirectSigner(mnemonic, prefix);
  const aminoWallet = await getCosmosAminoSigner(mnemonic, prefix);

  // Get accounts from both wallets to ensure consistency
  const [directAccounts, aminoAccounts] = await Promise.all([
    directWallet.getAccounts(),
    aminoWallet.getAccounts(),
  ]);

  if (directAccounts.length === 0 || aminoAccounts.length === 0) {
    throw new Error('No accounts found in wallet');
  }

  // Create a proper combined signer
  const combinedSigner: OfflineAminoSigner & OfflineDirectSigner = {
    // OfflineDirectSigner methods
    getAccounts: async (): Promise<readonly AccountData[]> => {
      return directWallet.getAccounts();
    },

    signDirect: async (signerAddress: string, signDoc: SignDoc): Promise<DirectSignResponse> => {
      return directWallet.signDirect(signerAddress, signDoc);
    },

    // OfflineAminoSigner methods
    signAmino: async (signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> => {
      return aminoWallet.signAmino(signerAddress, signDoc);
    },
  };

  console.log(`Combined signer created with prefix "${prefix}"`);
  return combinedSigner;
};

export const getEvmStandardSigner = async (
  mnemonic: string,
  chain: SimplifiedChainInfo,
): Promise<WalletClient> => {
  try {
    const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0");

    // Convert to viem WalletClient
    const account = privateKeyToAccount(wallet.privateKey as `0x${string}`);

    const chainMap: Record<string, any> = {
      '1': mainnet,
      '137': polygon,
      '42161': arbitrum,
      '10': optimism,
      '8453': base,
      '11155111': sepolia,
    };

    const selectedChain = chainMap[chain.chain_id] || mainnet;

    const walletClient = createWalletClient({
      account,
      chain: selectedChain,
      transport: http(),
    });

    console.log(`EVM signer created for chain ${chain.chain_id} with address: ${account.address}`);
    return walletClient;
  } catch (error) {
    console.error('Error creating EVM signer:', error);
    throw new Error(`Failed to create EVM signer for chain ${chain.chain_id}`);
  }
};

// Minimal implementation that only provides what Skip actually uses
export const getSvmStandardSigner = async (
  mnemonic: string,
): Promise<{
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
  signAllTransactions: <T extends Transaction | VersionedTransaction>(
    transactions: T[],
  ) => Promise<T[]>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}> => {
  const seed = mnemonicToSeedSync(mnemonic);
  const keypair = Keypair.fromSeed(new Uint8Array(seed).slice(0, 32));

  return {
    signTransaction: async transaction => {
      if (transaction instanceof Transaction) {
        transaction.sign(keypair);
      }
      return transaction;
    },
    signAllTransactions: async transactions => {
      return transactions.map(transaction => {
        if (transaction instanceof Transaction) {
          transaction.sign(keypair);
        }
        return transaction;
      });
    },
    signMessage: async message => {
      console.log(message);
      return new Uint8Array(64); // Mock signature
    },
  };
};
