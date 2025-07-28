import { useAtomValue, useSetAtom } from 'jotai';
import {
  subscribedChainRegistryAtom,
  userAccountAtom,
  updateChainWalletAtom,
  isGeneratingAddressesAtom,
} from '@/atoms';
import { getAddressesByChainPrefix, getSessionToken } from '@/helpers';
import { NetworkLevel } from '@/constants';

export function useAddressGeneration() {
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const userAccount = useAtomValue(userAccountAtom);
  const setIsGenerating = useSetAtom(isGeneratingAddressesAtom);
  const updateChainWallet = useSetAtom(updateChainWalletAtom);

  const generateAddresses = async (): Promise<Record<string, string>> => {
    setIsGenerating(true);
    console.group('[AddressGeneration] Starting wallet address refresh');

    const sessionToken = getSessionToken();
    console.log('Session token available:', !!sessionToken);
    console.log('Mnemonic available:', !!sessionToken?.mnemonic);
    console.log('User account available:', !!userAccount);

    if (!sessionToken?.mnemonic || !userAccount) {
      console.log('Aborting address refresh - missing mnemonic or user account');
      console.groupEnd();
      return {};
    }

    const mnemonic = sessionToken.mnemonic;
    const chainPrefixes: Record<string, string> = {};

    console.log('Building chain prefixes from subscriptions...');
    for (const networkLevel of [NetworkLevel.MAINNET, NetworkLevel.TESTNET]) {
      const subscriptions = userAccount.settings.chainSubscriptions[networkLevel];
      console.log(`${networkLevel} subscriptions:`, Object.keys(subscriptions));

      for (const chainId of Object.keys(subscriptions)) {
        const chainInfo = chainRegistry[networkLevel][chainId];

        console.log(`Chain info for ${chainId}:`, chainInfo);

        if (chainInfo?.bech32_prefix) {
          chainPrefixes[chainId] = chainInfo.bech32_prefix;
        } else {
          console.warn(`No bech32_prefix found for ${chainId}`);
        }
      }
    }

    console.log('Final chain prefixes:', chainPrefixes);

    console.log('Generating address promises...');
    const addressPromises = [NetworkLevel.MAINNET, NetworkLevel.TESTNET].map(async networkLevel => {
      const subscriptions = userAccount.settings.chainSubscriptions[networkLevel];
      if (Object.keys(subscriptions).length === 0) {
        console.log(`No ${networkLevel} subscriptions, skipping`);
        return {};
      }

      console.log(`Generating addresses for ${networkLevel}...`);
      return await getAddressesByChainPrefix(mnemonic, subscriptions, chainPrefixes);
    });

    console.log('Awaiting address generation...');
    const addressResults = await Promise.all(addressPromises);
    const addressMap = addressResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});

    console.log('Final address map:', addressMap);

    console.log('Updating chain wallets...');
    await Promise.all(
      Object.entries(addressMap).map(([chainId, address]) => {
        console.log(`Updating chain ${chainId} with address ${address}`);
        return updateChainWallet({ chainId, address });
      }),
    );

    console.groupEnd();
    setIsGenerating(false);
    return addressMap;
  };

  return {
    generateAddresses,
  };
}
