import { useState, useEffect } from 'react';
import { Asset } from '@/types';
import {
  GREATER_EXPONENT_DEFAULT,
  SYMPHONY_ENDPOINTS,
  QueryType,
  SYMPHONY_MAINNET_ASSET_REGISTRY,
} from '@/constants';
import { getSymphonyChainId, getSymphonyDefaultAsset, queryRestNode } from '@/helpers';
import { useAtomValue } from 'jotai';
import { allWalletAssetsAtom, sendStateAtom, networkLevelAtom, chainInfoAtom } from '@/atoms';
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
  const networkLevel = useAtomValue(networkLevelAtom);
  const getChainInfo = useAtomValue(chainInfoAtom);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symphonyId = getSymphonyChainId(networkLevel);
  const chainInfo = getChainInfo(symphonyId);
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
      const defaultAsset = getSymphonyDefaultAsset(networkLevel);
      const defaultAssetDenom = defaultAsset.originDenom || defaultAsset.denom;
      const sendAsset = sendState.asset;
      const sendAssetDenom = sendAsset.originDenom || sendAsset.denom;

      console.log('[useExchangeAssets] querying for exchange rates for:', symphonyId);
      console.log('[useExchangeAssets] using rest uris:', restUris);
      const response = (await queryRestNode({
        endpoint: `${SYMPHONY_ENDPOINTS.exchangeRequirements}`,
        queryType: QueryType.GET,
        prefix,
        restUris,
        chainId: symphonyId,
      })) as unknown as ExchangeRequirementResponse;
      console.log('[useExchangeAssets] noted response:', response);

      if (!response.exchange_requirements) {
        throw new Error('Invalid response format');
      }

      const mergedExchangeRequirements = [...response.exchange_requirements];
      if (
        !response.exchange_requirements.some(req => req.base_currency.denom === defaultAssetDenom)
      ) {
        mergedExchangeRequirements.push({
          base_currency: {
            denom: defaultAssetDenom,
            amount: '0',
          },
          exchange_rate: defaultAsset?.exchangeRate || '0',
        });
      }

      let adjustmentRate = 1;
      // If sendAsset is different from DEFAULT_ASSET, get the exchange rate from sendAsset to DEFAULT_ASSET
      if (sendAssetDenom !== defaultAssetDenom) {
        const exchangeRateResponse = await queryRestNode({
          endpoint: `${SYMPHONY_ENDPOINTS.swap}offerCoin=1000000${sendAssetDenom}&askDenom=${defaultAssetDenom}`,
          queryType: QueryType.GET,
          prefix,
          restUris,
          chainId: symphonyId,
        });

        adjustmentRate = parseFloat(exchangeRateResponse.return_coin.amount) / 1000000;
      }

      const exchangeAssets = mergedExchangeRequirements.map(requirement => {
        const { denom, amount } = requirement.base_currency;

        const registryAsset =
          SYMPHONY_MAINNET_ASSET_REGISTRY[denom] ||
          Object.values(chainInfo?.assets || {}).find(
            (a: Asset) => (a.originDenom || a.denom) === denom || a.symbol === denom,
          );

        const symbol =
          registryAsset?.symbol ||
          `H${denom.startsWith('u') ? denom.slice(1) : denom}`.toUpperCase();

        const logo = registryAsset?.logo || defaultAsset.logo;
        const exponent = registryAsset?.exponent ?? GREATER_EXPONENT_DEFAULT;
        const isIbc = registryAsset?.isIbc ?? false;

        const baseExchangeRate = parseFloat(requirement.exchange_rate || '1');
        let exchangeRate;

        if (denom === sendAssetDenom) {
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
          !exchangeAssets.some(
            processed =>
              (processed.originDenom || processed.denom) ===
              (walletAsset.originDenom || walletAsset.denom),
          ),
      );

      console.log('[useExchangeAssets] additional assets', additionalAssets);

      const mergedAssets = [
        ...exchangeAssets,
        ...additionalAssets.map((walletAsset: Asset) => {
          const walletAssetDenom = walletAsset.originDenom || walletAsset.denom;
          const exchangeData = exchangeAssets.find(
            e => (e.originDenom || e.denom) === walletAssetDenom,
          );

          return {
            ...walletAsset,
            exchangeRate: walletAssetDenom === sendAssetDenom ? '1' : '-',
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
