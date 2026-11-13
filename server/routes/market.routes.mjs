import { Router } from "express";
import { fetchTwelveDataQuote, MAX_MARKET_SYMBOLS } from "../services/market-service.mjs";
import { authenticateRequest } from "../middleware/auth.mjs";
import { rateLimit } from "../middleware/rate-limit.mjs";

export function createMarketRouter() {
  const router = Router();

  router.get("/api/market-quotes", rateLimit({ windowMs: 60 * 1000, max: 30 }), async (req, res) => {
    if (!(await authenticateRequest(req))) {
      return res.status(401).json({ success: false, message: "Please sign in to view market quotes." });
    }

    const rawSymbols = typeof req.query.symbols === "string" ? req.query.symbols : "";
    const symbols = [...new Set(rawSymbols.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))];
    if (!symbols.length) return res.json({ quotes: [] });
    if (symbols.length > MAX_MARKET_SYMBOLS || symbols.some((symbol) => !/^[A-Z0-9._:/-]{1,32}$/.test(symbol))) {
      return res.status(400).json({ success: false, message: `Request up to ${MAX_MARKET_SYMBOLS} valid symbols at a time.` });
    }

    const quotes = [];
    for (let index = 0; index < symbols.length; index += 3) {
      const batch = await Promise.all(symbols.slice(index, index + 3).map((s) => fetchTwelveDataQuote(s)));
      quotes.push(...batch);
    }
    return res.json({ quotes });
  });

  return router;
}
