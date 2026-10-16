#!/usr/bin/env node
// Configure the social sign-in buttons that PocketBase supports natively
// (Google and GitHub). Run it after filling in .env:
//
//   npm run setup:oauth
//
// Telegram is NOT a PocketBase OAuth2 provider, so it is not configured here —
// it uses the bot handshake implemented in server/index.mjs and only needs
// TELEGRAM_BOT_TOKEN.
import PocketBase from "pocketbase";
import "dotenv/config";

const PB_URL = process.env.PB_URL || "http://127.0.0.1:8090";
const SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL;
const SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD;

if (!SUPERUSER_EMAIL || !SUPERUSER_PASSWORD) {
  console.error("Set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD in .env first.");
  process.exit(1);
}

// Only these two are PocketBase OAuth2 providers; anything else has to be a
// custom flow (see TELEGRAM_BOT_TOKEN).
const CONFIGURED = [
  { name: "google", idKey: "GOOGLE_CLIENT_ID", secretKey: "GOOGLE_CLIENT_SECRET" },
  { name: "github", idKey: "GITHUB_CLIENT_ID", secretKey: "GITHUB_CLIENT_SECRET" },
];

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

await pb.collection("_superusers").authWithPassword(SUPERUSER_EMAIL, SUPERUSER_PASSWORD);

const collection = await pb.collections.getOne("users");
const current = collection.oauth2?.providers || [];

const wanted = [];
const missing = [];

for (const provider of CONFIGURED) {
  const clientId = (process.env[provider.idKey] || "").trim();
  const clientSecret = (process.env[provider.secretKey] || "").trim();

  if (!clientId || !clientSecret) {
    missing.push(`${provider.name} (${provider.idKey} / ${provider.secretKey})`);
    // Keep an already-configured provider even when .env has been cleared.
    const existing = current.find((entry) => entry.name === provider.name);
    if (existing) wanted.push(existing);
    continue;
  }

  wanted.push({
    name: provider.name,
    clientId,
    clientSecret,
    authURL: "",
    tokenURL: "",
    userInfoURL: "",
    displayName: "",
    pkce: null,
  });
}

if (wanted.length === 0) {
  console.error("\nNo OAuth client IDs found. Add these to .env, then run again:\n");
  for (const item of missing) console.error(`  - ${item}`);
  console.error("\nTelegram needs only TELEGRAM_BOT_TOKEN (it uses a bot handshake).\n");
  process.exit(1);
}

await pb.collections.update(collection.id, {
  oauth2: {
    ...(collection.oauth2 || {}),
    enabled: true,
    providers: wanted,
  },
});

const redirect = `${PB_URL.replace(/\/+$/, "")}/api/oauth2-redirect`;

console.log("\nSocial sign-in configured:");
for (const provider of wanted) console.log(`  - ${provider.name}`);
if (missing.length) {
  console.log("\nStill missing (buttons stay disabled until these are set):");
  for (const item of missing) console.log(`  - ${item}`);
}

console.log("\nRegister this redirect URI with each provider:");
console.log(`  ${redirect}`);
console.log("\nFor Google: Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application.");
console.log("For GitHub: GitHub → Settings → Developer settings → OAuth Apps → Authorization callback URL.\n");
