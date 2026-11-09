import dotenv from "dotenv";

dotenv.config();

export const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
export const PB_URL = process.env.PB_URL || process.env.VITE_POCKETBASE_URL || "http://127.0.0.1:8090";
export const PB_SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL || process.env.PB_ADMIN_EMAIL || "";
export const PB_SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD || process.env.PB_ADMIN_PASSWORD || "";
export const MARKET_DATA_API_KEY = process.env.MARKET_DATA_API_KEY || "";
export const SHORTCUT_API_KEY = process.env.SHORTCUT_API_KEY || "";
export const IS_PRODUCTION = process.env.NODE_ENV === "production";
