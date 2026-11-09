export const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://43.156.236.102",
];

export function getCorsOptions(customOrigins = []) {
  const allowed = new Set([...defaultAllowedOrigins, ...customOrigins]);

  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, shortcuts)
      if (!origin) return callback(null, true);
      if (allowed.has(origin) || origin.endsWith(".vercel.app") || origin.startsWith("http://localhost:")) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/self-hosted
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Device-Token"],
  };
}
