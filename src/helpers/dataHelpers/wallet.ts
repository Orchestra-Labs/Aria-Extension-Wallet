import { Secp256k1HdWallet } from '@cosmjs/amino';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

import { WALLET_PREFIX } from '@/constants';
import { WalletRecord } from '@/types';

import { generateUUID } from '../uuid';
import { encryptMnemonic } from './crypto';

export const createWallet = async (
  mnemonic: string,
  password: string,
  walletName: string,
): Promise<{ wallet: Secp256k1HdWallet; walletRecord: WalletRecord }> => {
  try {
    console.log('Creating wallet with mnemonic:', mnemonic);
    const walletID = generateUUID();

    const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: WALLET_PREFIX,
    });
    console.log(
      'Wallet created successfully with address:',
      (await wallet.getAccounts())[0].address,
    );

    const encryptedMnemonic = encryptMnemonic(mnemonic, password);
    console.log('Mnemonic encrypted successfully');

    const walletRecord: WalletRecord = {
      id: walletID,
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
  console.log('Retrieving wallet with mnemonic:', mnemonic);
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix: WALLET_PREFIX });
  console.log('Wallet retrieved successfully:', wallet);
  return wallet;
};

export async function createOfflineSignerFromMnemonic(
  mnemonic: string,
): Promise<DirectSecp256k1HdWallet> {
  console.log('Creating offline signer with mnemonic:', mnemonic);
  const hdWallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: WALLET_PREFIX,
  });
  console.log('Offline signer created successfully');
  return hdWallet;
}

export async function createAminoSignerFromMnemonic(mnemonic: string) {
  const hdWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: WALLET_PREFIX,
  });
  console.log('Amino signer created successfully');
  return hdWallet;
}

export const getAddress = async (mnemonic: string): Promise<string> => {
  console.log('Getting address from mnemonic:', mnemonic);
  const wallet = await getWallet(mnemonic);
  const [account] = await wallet.getAccounts();
  console.log('Address retrieved:', account.address);
  return account.address;
};
