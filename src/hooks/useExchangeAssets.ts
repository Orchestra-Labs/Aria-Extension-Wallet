import { useState, useEffect } from 'react';
import { Asset } from '@/types';
import {
  GREATER_EXPONENT_DEFAULT,
  SYMPHONY_ENDPOINTS,
  QueryType,
  DEFAULT_MAINNET_ASSET,
  SYMPHONY_MAINNET_ASSET_REGISTRY,
} from '@/constants';
import { getSymphonyChainId, queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import {
  allWalletAssetsAtom,
  subscribedChainRegistryAtom,
  sendStateAtom,
  networkLevelAtom,
} from '@/atoms';
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
  const walletAssets = useAtomValue(allWalletAssetsAtom);
  const chainRegistry = useAtomValue(subscribedChainRegistryAtom);
  const networkLevel = useAtomValue(networkLevelAtom);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symphonyId = getSymphonyChainId(networkLevel);
  const chainInfo = chainRegistry[networkLevel][symphonyId];
  console.log(`[useExchangeAssets] chainInfo for ${symphonyId}:`, chainInfo);

  if (!chainInfo) {
    console.error(`[useExchangeAssets] No chain info found for ${symphonyId}`);
  }

  const prefix = chainInfo?.bech32_prefix || '';
  const restUris = chainInfo?.rest_uris || [];

  if (!restUris.length) {
    console.error('[useExchangeAssets] Missing rest URIs for', symphonyId);
  }

  const fetchExchangeAssets = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const defaultAsset = DEFAULT_MAINNET_ASSET;
      const sendAsset = sendState.asset;

      console.log('[useExchangeAssets] querying for exchange rates for:', symphonyId);
      console.log('[useExchangeAssets] using rest uris:', restUris);
      const response = (await queryRestNode({
        endpoint: `${SYMPHONY_ENDPOINTS.exchangeRequirements}`,
        queryType: QueryType.GET,
        prefix,
        restUris,
      })) as unknown as ExchangeRequirementResponse;
      console.log('[useExchangeAssets] noted response:', response);

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
          exchange_rate: defaultAsset?.exchangeRate || '0',
        });
      }

      let adjustmentRate = 1;
      // If sendAsset is different from DEFAULT_ASSET, get the exchange rate from sendAsset to DEFAULT_ASSET
      if (sendAsset.denom !== defaultAsset.denom) {
        const exchangeRateResponse = await queryRestNode({
          endpoint: `${SYMPHONY_ENDPOINTS.swap}offerCoin=1000000${sendAsset.denom}&askDenom=${defaultAsset.denom}`,
          queryType: QueryType.GET,
          prefix,
          restUris,
        });

        adjustmentRate = parseFloat(exchangeRateResponse.return_coin.amount) / 1000000;
      }

      const exchangeAssets = mergedExchangeRequirements.map(requirement => {
        const { denom, amount } = requirement.base_currency;

        const registryAsset =
          SYMPHONY_MAINNET_ASSET_REGISTRY[denom] ||
          Object.values(chainInfo?.assets || {}).find(
            (a: Asset) => a.denom === denom || a.symbol === denom,
          );

        const symbol =
          registryAsset?.symbol ||
          `H${denom.startsWith('u') ? denom.slice(1) : denom}`.toUpperCase();

        const logo = registryAsset?.logo || defaultAsset.logo;
        const exponent = registryAsset?.exponent ?? GREATER_EXPONENT_DEFAULT;
        const isIbc = registryAsset?.isIbc ?? false;

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
          logo,
          exponent,
          isIbc,
          exchangeRate,
        } as Asset;
      });

      console.log('[useExchangeAssets] exchange assets', exchangeAssets);

      const additionalAssets = walletAssets.filter(
        (walletAsset: Asset) =>
          !exchangeAssets.some(processed => processed.denom === walletAsset.denom),
      );

      console.log('[useExchangeAssets] additional assets', additionalAssets);

      const mergedAssets = [
        ...exchangeAssets,
        ...additionalAssets.map((walletAsset: Asset) => {
          const exchangeData = exchangeAssets.find(e => e.denom === walletAsset.denom);
          return {
            ...walletAsset,
            exchangeRate: walletAsset.denom === sendAsset.denom ? '1' : '-',
            symbol: exchangeData?.symbol ?? walletAsset.symbol,
            logo: exchangeData?.logo ?? walletAsset.logo,
            exponent: exchangeData?.exponent ?? walletAsset.exponent,
            isIbc: exchangeData?.isIbc ?? walletAsset.isIbc,
          };
        }),
      ];

      console.log('[useExchangeAssets] merged assets', mergedAssets);
      setAvailableAssets(mergedAssets);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '[useExchangeAssets] Failed to fetch exchange assets',
      );
      console.error('[useExchangeAssets] Error fetching exchange assets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeAssets();
  }, [sendState]);

  return {
    availableAssets,
    isLoading,
    error,
    triggerExchangeAssetRefresh: fetchExchangeAssets,
  };
};
