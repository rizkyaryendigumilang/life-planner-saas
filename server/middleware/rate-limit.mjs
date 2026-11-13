export const rateBuckets = new Map();

export const KNOWN_API_GROUPS = new Set([
  "admin",
  "auth",
  "shortcuts",
  "calendar",
  "expense-ingestions",
  "shortcut-tokens",
  "network-info",
  "public-base",
  "health",
  "market-quotes",
]);

export function getNormalizedRateLimitScope(req) {
  if (req.baseUrl) return req.baseUrl;
  const parts = (req.path || "").split("/").filter(Boolean);
  if (parts.length > 0 && parts[0] === "api") {
    const group = parts[1] || "";
    if (KNOWN_API_GROUPS.has(group)) {
      return `/api/${group}`;
    }
    return "/api/other";
  }
  return parts.length > 0 ? `/${parts[0]}` : "/";
}

export function rateLimit({ windowMs = 15 * 60 * 1000, max = 120 } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    const normalizedScope = getNormalizedRateLimitScope(req);
    const key = `${req.ip || req.socket.remoteAddress || "unknown"}:${normalizedScope}`;
    let bucket = rateBuckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateBuckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
    }
    // Avoid unbounded growth from one-off IP/path combinations.
    if (rateBuckets.size > 10000) {
      for (const [bucketKey, value] of rateBuckets) {
        if (now >= value.resetAt) rateBuckets.delete(bucketKey);
      }
    }
    next();
  };
}
