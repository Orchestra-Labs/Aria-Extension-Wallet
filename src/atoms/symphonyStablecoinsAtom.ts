import { atom } from 'jotai';
import { Asset } from '@/types';
import { GREATER_EXPONENT_DEFAULT, SYMPHONY_ENDPOINTS, QueryType } from '@/constants';
import { getSymphonyChainId, getSymphonyDefaultAsset, queryRestNode } from '@/helpers';
import {
  allWalletAssetsAtom,
  sendStateAtom,
  networkLevelAtom,
  chainInfoAtom,
  receiveStateAtom,
  fullRegistryChainInfoAtom,
} from '@/atoms';
import BigNumber from 'bignumber.js';

interface SymphonyStablecoinsResponse {
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

export const symphonyStablecoinsAtom = atom<Asset[]>([]);
export const symphonyStablecoinsLoadingAtom = atom<boolean>(false);
export const symphonyStablecoinsErrorAtom = atom<string | null>(null);

// TODO: remove all the extras, this should return just the list of stablecoins.
// TODO: add real-world names to stablecoin assets here
export const loadSymphonyStablecoinsAtom = atom(null, async (get, set) => {
  const sendState = get(sendStateAtom);
  const walletAssets = get(allWalletAssetsAtom);
  const networkLevel = get(networkLevelAtom);
  const getChainInfo = get(chainInfoAtom);

  set(symphonyStablecoinsLoadingAtom, true);
  set(symphonyStablecoinsErrorAtom, null);

  try {
    const symphonyId = getSymphonyChainId(networkLevel);
    const chain = getChainInfo(symphonyId);

    if (!chain) {
      throw new Error(`No chain info found for ${symphonyId}`);
    }

    const prefix = chain.bech32_prefix;
    const restUris = chain.rest_uris;

    const assets = chain?.assets || {};
    const defaultAsset = getSymphonyDefaultAsset(networkLevel);
    const defaultAssetDenom = defaultAsset.originDenom || defaultAsset.denom;
    const sendAsset = sendState?.asset || defaultAsset;
    const sendAssetDenom = sendAsset.originDenom || sendAsset.denom;

    console.log('[loadSymphonyStablecoinsAtom] querying for exchange rates for:', symphonyId);
    console.log('[loadSymphonyStablecoinsAtom] using rest uris:', restUris);

    const response = (await queryRestNode({
      endpoint: `${SYMPHONY_ENDPOINTS.exchangeRequirements}`,
      queryType: QueryType.GET,
      prefix,
      restUris,
      chainId: symphonyId,
    })) as unknown as SymphonyStablecoinsResponse;

    console.log('[loadSymphonyStablecoinsAtom] noted response:', response);

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

    const symphonyStablecoins = mergedExchangeRequirements.map(requirement => {
      const { denom, amount } = requirement.base_currency;

      const registryAsset =
        assets[denom] ||
        Object.values(chain?.assets || {}).find(
          (a: Asset) => (a.originDenom || a.denom) === denom || a.symbol === denom,
        );

      const symbol =
        registryAsset?.symbol || `H${denom.startsWith('u') ? denom.slice(1) : denom}`.toUpperCase();

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
        exchangeRate = new BigNumber(baseExchangeRate).dividedBy(adjustmentRate).toFixed(exponent);
      }

      return {
        symbol,
        denom,
        amount,
        logo,
        exponent,
        isIbc,
        exchangeRate,
        originDenom: registryAsset?.originDenom || denom,
        originChainId: registryAsset?.originChainId || symphonyId,
        chainId: symphonyId,
      } as Asset;
    });

    console.log('[loadSymphonyStablecoinsAtom] exchange assets', symphonyStablecoins);

    const additionalAssets = walletAssets.filter(
      (walletAsset: Asset) =>
        !symphonyStablecoins.some(
          processed =>
            (processed.originDenom || processed.denom) ===
            (walletAsset.originDenom || walletAsset.denom),
        ),
    );

    console.log('[loadSymphonyStablecoinsAtom] additional assets', additionalAssets);

    const mergedAssets = [
      ...symphonyStablecoins,
      ...additionalAssets.map((walletAsset: Asset) => {
        const walletAssetDenom = walletAsset.originDenom || walletAsset.denom;
        const exchangeData = symphonyStablecoins.find(
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

    console.log('[loadSymphonyStablecoinsAtom] merged assets', mergedAssets);
    set(symphonyStablecoinsAtom, mergedAssets);
  } catch (err) {
    set(
      symphonyStablecoinsErrorAtom,
      err instanceof Error ? err.message : 'Failed to fetch exchange assets',
    );
    console.error('[loadSymphonyStablecoinsAtom] Error fetching exchange assets:', err);
  } finally {
    set(symphonyStablecoinsLoadingAtom, false);
  }
});

export const isValidStablecoinSwapAtom = atom(get => {
  const sendState = get(sendStateAtom);
  const receiveState = get(receiveStateAtom);
  const symphonyStablecoins = get(symphonyStablecoinsAtom);
  const networkLevel = get(networkLevelAtom);
  const symphonyChainId = getSymphonyChainId(networkLevel);
  const getChainInfo = get(fullRegistryChainInfoAtom);

  if (!sendState.asset || !receiveState.asset) {
    return false;
  }

  // Create a set of all stablecoin denoms (from symphony + both chain registries)
  const stablecoinDenoms = new Set<string>();

  // Add symphony stablecoins
  symphonyStablecoins.forEach(asset => {
    stablecoinDenoms.add(asset.originDenom || asset.denom);
  });

  const symphonyChain = getChainInfo(symphonyChainId);
  const symphonyChainAssets = Object.keys(symphonyChain?.assets || {});

  const sendIsInRegistry = symphonyChainAssets.includes(sendState.asset.originDenom);
  const receiveIsInRegistry = symphonyChainAssets.includes(receiveState.asset.originDenom);

  // Check if both assets are in the stablecoin set
  const sendIsStablecoin = stablecoinDenoms.has(
    sendState.asset.originDenom || sendState.asset.denom,
  );
  const receiveIsStablecoin = stablecoinDenoms.has(
    receiveState.asset.originDenom || receiveState.asset.denom,
  );

  const sendIsSwappable = sendIsInRegistry || sendIsStablecoin;
  const receiveIsSwappable = receiveIsInRegistry || receiveIsStablecoin;

  return sendIsSwappable && receiveIsSwappable;
});
