#!/usr/bin/env node
// Publish the local API on the internet with a Cloudflare quick tunnel:
//
//   npm run tunnel
//
// The phone only needs to reach the API once per calendar refresh, so a quick
// tunnel (no Cloudflare account, random *.trycloudflare.com hostname) is
// enough. The hostname is written to .runtime/public-base.json, which the API
// reads on every request, so /api/network-info and the Calendar page start
// handing out the public URL straight away. Ctrl+C removes it again.
//
// The tunnel exposes the whole API, not just the calendar feed. Every endpoint
// still requires a session token or a device token, so keep the URL private.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const API_PORT = process.env.API_PORT || "3001";
const TARGET = process.env.TUNNEL_TARGET || `http://127.0.0.1:${API_PORT}`;
const PUBLIC_BASE_FILE = join(root, ".runtime", "public-base.json");

const C = { dim: "\x1b[2m", bold: "\x1b[1m", ok: "\x1b[38;5;114m", warn: "\x1b[38;5;215m", reset: "\x1b[0m" };

function findCloudflared() {
  const probe = spawnSync(isWin ? "where" : "which", ["cloudflared"], { encoding: "utf8" });
  if (probe.status === 0) {
    const first = String(probe.stdout).split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    if (first) return first;
  }

  const candidates = isWin
    ? [
        join(process.env["ProgramFiles"] || "C:\\Program Files", "cloudflared", "cloudflared.exe"),
        join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "cloudflared", "cloudflared.exe"),
        join(process.env.LOCALAPPDATA || "", "Microsoft", "WinGet", "Links", "cloudflared.exe"),
      ]
    : ["/usr/local/bin/cloudflared", "/opt/homebrew/bin/cloudflared", "/usr/bin/cloudflared"];

  return candidates.find((candidate) => candidate && existsSync(candidate)) || "";
}

const binary = findCloudflared();
if (!binary) {
  console.error(`\n  ${C.warn}cloudflared is not installed.${C.reset}\n`);
  console.error("  Install it once, then run this command again:\n");
  if (isWin) {
    console.error(`    ${C.bold}winget install --id Cloudflare.cloudflared${C.reset}\n`);
    console.error("  (or download it from https://github.com/cloudflare/cloudflared/releases)\n");
  } else {
    console.error(`    ${C.bold}brew install cloudflared${C.reset}\n`);
  }
  process.exit(1);
}

function publish(url) {
  mkdirSync(dirname(PUBLIC_BASE_FILE), { recursive: true });
  writeFileSync(PUBLIC_BASE_FILE, `${JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

function unpublish() {
  rmSync(PUBLIC_BASE_FILE, { force: true });
}

console.log(`\n  ${C.bold}Cloudflare tunnel${C.reset} ${C.dim}→ ${TARGET}${C.reset}`);
console.log(`  ${C.dim}Starting… (the public URL appears below in a few seconds)${C.reset}\n`);

const child = spawn(binary, ["tunnel", "--url", TARGET, "--no-autoupdate"], {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let publicUrl = "";
let done = false;

function scan(chunk) {
  const text = String(chunk);
  if (!done) {
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) {
      done = true;
      publicUrl = match[0];
      publish(publicUrl);

      console.log(`  ${C.ok}Public URL:${C.reset} ${C.bold}${publicUrl}${C.reset}\n`);
      console.log(`  ${C.dim}Saved to .runtime/public-base.json — the Calendar page now hands out:${C.reset}`);
      console.log(`  ${C.dim}${publicUrl}/api/calendar.ics?token=…${C.reset}\n`);
      console.log(`  ${C.dim}Open the Calendar page and copy the subscribe URL from there.${C.reset}`);
      console.log(`  ${C.dim}Press Ctrl+C to close the tunnel.${C.reset}\n`);
    }
  }

  // Keep showing cloudflared's own diagnostics, minus the noise.
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^(INF|WRN|ERR)/.test(line) && !/trycloudflare|error|failed/i.test(line)) continue;
    if (/trycloudflare|error|failed|denied/i.test(line)) console.log(`  ${C.dim}${line}${C.reset}`);
  }
}

child.stdout.on("data", scan);
child.stderr.on("data", scan);

function shutdown(code = 0) {
  unpublish();
  if (!child.killed) {
    if (isWin) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  console.log(`\n  ${C.dim}Tunnel closed; the public URL has been removed.${C.reset}\n`);
  setTimeout(() => process.exit(code), 700);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

child.on("error", (error) => {
  unpublish();
  console.error(`\n  ${C.warn}Could not start cloudflared: ${error.message}${C.reset}\n`);
  process.exit(1);
});

child.on("exit", (code) => {
  if (code === 0) return;
  console.error(`\n  ${C.warn}cloudflared exited with code ${code}.${C.reset}\n`);
  shutdown(code ?? 1);
});
