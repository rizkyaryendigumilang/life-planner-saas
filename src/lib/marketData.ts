import type { Investment, MarketQuote } from "../types";
import { API_BASE } from "./hosts";
import { pb } from "./pocketbase";

export type MarketAssetType = "Stock" | "Crypto" | "Gold" | "Currency";

/**
 * This implementation intentionally never invents prices. It asks the backend
 * for quotes if an endpoint is configured; otherwise it returns unavailable
 * quote objects so the UI can explain that market data has not been connected.
 */
export function isMarketDataConfigured() {
  return Boolean(import.meta.env.VITE_MARKET_DATA_ENABLED === "true");
}

export async function getMarketQuotes(items: Investment[]): Promise<Map<string, MarketQuote>> {
  const result = new Map<string, MarketQuote>();
  if (!items.length) return result;
  const unique = [...new Set(items.map((item) => item.symbol.trim().toUpperCase()).filter(Boolean))];
  if (isMarketDataConfigured()) {
    try {
      const response = await fetch(`${API_BASE}/api/market-quotes?symbols=${encodeURIComponent(unique.join(","))}`, {
        headers: pb.authStore.token ? { Authorization: `Bearer ${pb.authStore.token}` } : {},
      });
      if (response.ok) {
        const body = await response.json() as { quotes?: MarketQuote[] };
        for (const quote of body.quotes || []) result.set(quote.symbol.toUpperCase(), quote);
      }
    } catch {
      // fall through to explicit unavailable states
    }
  }
  for (const symbol of unique) {
    if (!result.has(symbol)) result.set(symbol, {
      symbol, price: null, change: null, percentChange: null, currency: "—",
      marketStatus: "unavailable", source: "Not connected", updatedAt: null,
      message: "Connect a market-data provider to display verified quotes.",
    });
  }
  return result;
}

