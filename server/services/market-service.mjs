const marketQuoteCache = new Map();
const MARKET_QUOTE_TTL_MS = 60 * 1000;
export const MAX_MARKET_SYMBOLS = 15;

export function unavailableQuote(symbol, message = "Market data is not configured or temporarily unavailable.") {
  return {
    symbol,
    price: null,
    change: null,
    percentChange: null,
    currency: "—",
    marketStatus: "unavailable",
    source: "Twelve Data",
    updatedAt: null,
    message,
  };
}

export async function fetchTwelveDataQuote(symbol, apiKey = process.env.MARKET_DATA_API_KEY || "") {
  const cached = marketQuoteCache.get(symbol);
  if (cached && Date.now() - cached.cachedAt < MARKET_QUOTE_TTL_MS) return cached.quote;
  if (!apiKey) return unavailableQuote(symbol, "Market-data provider is not configured on the server.");

  try {
    const url = new URL("https://api.twelvedata.com/quote");
    url.searchParams.set("symbol", symbol);
    const response = await fetch(url, {
      headers: { Authorization: `apikey ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return unavailableQuote(symbol);
    const raw = await response.json();
    if (!raw || raw.status === "error" || raw.code || raw.close == null) return unavailableQuote(symbol);

    const price = Number(raw.close);
    if (!Number.isFinite(price)) return unavailableQuote(symbol);
    const parsedChange = raw.change == null ? null : Number(raw.change);
    const parsedPercent = raw.percent_change == null ? null : Number(raw.percent_change);
    const quote = {
      symbol: String(raw.symbol || symbol).toUpperCase(),
      price,
      change: Number.isFinite(parsedChange) ? parsedChange : null,
      percentChange: Number.isFinite(parsedPercent) ? parsedPercent : null,
      currency: String(raw.currency || "—").slice(0, 12),
      marketStatus: raw.is_market_open === true || raw.is_market_open === "true" ? "live" : "eod",
      source: "Twelve Data",
      updatedAt: typeof raw.datetime === "string" ? raw.datetime : null,
    };
    marketQuoteCache.set(symbol, { cachedAt: Date.now(), quote });
    return quote;
  } catch {
    return unavailableQuote(symbol);
  }
}
