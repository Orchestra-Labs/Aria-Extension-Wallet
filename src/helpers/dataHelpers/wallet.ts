import { Secp256k1HdWallet } from '@cosmjs/amino';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { SYMPHONY_PREFIX } from '@/constants';
import { NetworkSubscriptionRecord, WalletRecord } from '@/types';

import { generateUUID } from '../uuid';
import { encryptMnemonic } from './crypto';

export const createWallet = async (
  mnemonic: string,
  password: string,
  walletName: string,
): Promise<{ wallet: Secp256k1HdWallet; walletRecord: WalletRecord }> => {
  try {
    const walletId = generateUUID();

    const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: SYMPHONY_PREFIX,
    });
    console.log(
      'Wallet created successfully with address:',
      (await wallet.getAccounts())[0].address,
    );

    const encryptedMnemonic = encryptMnemonic(mnemonic, password);
    console.log('Mnemonic encrypted successfully');

    const walletRecord: WalletRecord = {
      id: walletId,
      name: walletName,
      encryptedMnemonic,
      settings: {},
    };

    console.log('Wallet record created:', walletRecord);

    return { wallet, walletRecord };
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw error;
  }
};

export const getWallet = async (mnemonic: string): Promise<Secp256k1HdWallet> => {
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix: SYMPHONY_PREFIX });
  console.log('Wallet retrieved successfully:', wallet);
  return wallet;
};

export const getWalletByPrefix = async (
  mnemonic: string,
  prefix: string,
): Promise<Secp256k1HdWallet> => {
  return await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
};

export async function createOfflineSignerByPrefix(
  mnemonic: string,
  prefix: string,
): Promise<DirectSecp256k1HdWallet> {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
  console.log(`Offline signer created with prefix "${prefix}"`);
  return wallet;
}

export async function createAminoSignerByPrefix(
  mnemonic: string,
  prefix: string,
): Promise<Secp256k1HdWallet> {
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
  console.log(`Amino signer created with prefix "${prefix}"`);
  return wallet;
}

export async function getAddressesByChainPrefix(
  mnemonic: string,
  subscriptions: NetworkSubscriptionRecord,
  chainPrefixes: Record<string, string>,
): Promise<Record<string, string>> {
  const addressMap: Record<string, string> = {};

  for (const chainId of Object.keys(subscriptions)) {
    const prefix = chainPrefixes[chainId];
    if (!prefix) continue;

    const address = await getAddressByChainPrefix(mnemonic, prefix);
    addressMap[chainId] = address;
  }

  return addressMap;
}

export async function getAddressByChainPrefix(mnemonic: string, prefix: string): Promise<string> {
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix });
  const [account] = await wallet.getAccounts();
  return account.address;
}
