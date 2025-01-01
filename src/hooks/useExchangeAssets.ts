import { useState, useEffect } from 'react';
import { Asset } from '@/types';
import {
  LOCAL_ASSET_REGISTRY,
  DEFAULT_ASSET,
  CHAIN_ENDPOINTS,
  GREATER_EXPONENT_DEFAULT,
} from '@/constants';
import { queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import { sendStateAtom, walletAssetsAtom } from '@/atoms';
import BigNumber from 'bignumber.js';

interface ExchangeRequirementResponse {
  exchange_requirements: {
    base_currency: {
      denom: string;
      amount: string;
    };
    exchange_rate: string;
  }[];
  total: {
    denom: string;
    amount: string;
  };
}

export const useExchangeAssets = () => {
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const sendState = useAtomValue(sendStateAtom);
  const walletAssets = useAtomValue(walletAssetsAtom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExchangeAssets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const defaultAsset = DEFAULT_ASSET;
      const sendAsset = sendState.asset;

      const response = (await queryRestNode({
        endpoint: `${CHAIN_ENDPOINTS.exchangeRequirements}`,
        queryType: 'GET',
      })) as unknown as ExchangeRequirementResponse;

      if (!response.exchange_requirements) {
        throw new Error('Invalid response format');
      }

      const mergedExchangeRequirements = [...response.exchange_requirements];
      if (
        !response.exchange_requirements.some(req => req.base_currency.denom === defaultAsset.denom)
      ) {
        mergedExchangeRequirements.push({
          base_currency: {
            denom: defaultAsset.denom,
            amount: '0',
          },
          exchange_rate: defaultAsset.amount, // Default exchange rate for the default asset
        });
      }

      let adjustmentRate = 1;
      // If sendAsset is different from DEFAULT_ASSET, get the exchange rate from sendAsset to DEFAULT_ASSET
      if (sendAsset.denom !== defaultAsset.denom) {
        const exchangeRateResponse = await queryRestNode({
          endpoint: `${CHAIN_ENDPOINTS.swap}offerCoin=1000000${sendAsset.denom}&askDenom=${defaultAsset.denom}`,
          queryType: 'GET',
        });

        adjustmentRate = parseFloat(exchangeRateResponse.return_coin.amount) / 1000000;
      }

      const exchangeAssets = mergedExchangeRequirements.map(requirement => {
        const { denom, amount } = requirement.base_currency;

        // Check if the asset exists in the local registry
        const registryAsset = LOCAL_ASSET_REGISTRY[denom];

        const symbol =
          registryAsset && registryAsset.symbol
            ? registryAsset.symbol
            : `H${denom.startsWith('u') ? denom.slice(1) : denom}`.toUpperCase();

        const logo = registryAsset ? registryAsset.logo : defaultAsset.logo;
        const exponent = registryAsset ? registryAsset.exponent! : GREATER_EXPONENT_DEFAULT;
        const isIbc = registryAsset ? registryAsset.isIbc : false;
        const baseExchangeRate = parseFloat(requirement.exchange_rate || '1');

        let exchangeRate;
        if (denom === sendAsset.denom) {
          exchangeRate = '1';
        } else if (isIbc) {
          exchangeRate = '-';
        } else {
          exchangeRate = new BigNumber(baseExchangeRate)
            .dividedBy(adjustmentRate)
            .toFixed(exponent);
        }

        return {
          symbol,
          denom,
          amount,
          logo: logo ?? '',
          exponent,
          isIbc,
          exchangeRate,
        } as Asset;
      });

      console.log('exchange assets', exchangeAssets);

      const additionalAssets = walletAssets.filter(
        walletAsset => !exchangeAssets.some(processed => processed.denom === walletAsset.denom),
      );
      console.log('additional assets', additionalAssets);

      const mergedAssets = [
        ...exchangeAssets,
        ...additionalAssets.map(walletAsset => ({
          ...walletAsset,
          exchangeRate: walletAsset.denom === sendAsset.denom ? '1' : '-',
        })),
      ];

      console.log('merged assets', mergedAssets);
      setAvailableAssets(mergedAssets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange assets');
      console.error('Error fetching exchange assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeAssets();
  }, []);

  return {
    availableAssets,
    isLoading,
    error,
    refetch: fetchExchangeAssets,
  };
};
