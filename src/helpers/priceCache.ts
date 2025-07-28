const PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

type PriceCache = {
  [coinGeckoId: string]: {
    price: number;
    timestamp: number;
  };
};

let priceCache: PriceCache = {};

export const getCachedPrices = (coinGeckoIds: string[]): Record<string, number> => {
  const now = Date.now();
  const result: Record<string, number> = {};

  coinGeckoIds.forEach(id => {
    if (priceCache[id] && now - priceCache[id].timestamp < PRICE_CACHE_TTL) {
      result[id] = priceCache[id].price;
    }
  });

  return result;
};

export const updateCache = (newPrices: Record<string, number>) => {
  const now = Date.now();
  Object.entries(newPrices).forEach(([id, price]) => {
    priceCache[id] = {
      price,
      timestamp: now,
    };
  });
};

export const clearCache = () => {
  priceCache = {};
};
