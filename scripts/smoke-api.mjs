// Boots the Express API with dummy credentials and waits for /api/health.
//
// `node --check` only validates syntax, so it cannot catch an undefined
// variable or an Express 5 route pattern that throws at startup — both of
// which have taken production down before. This script actually starts the
// server, so any boot-time regression fails CI.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const stubCreated = !fs.existsSync(distDir);

// The SPA fallback route is only registered when a build exists.
if (stubCreated) {
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, "index.html"), '<!doctype html><div id="root"></div>');
}

const port = 3400 + Math.floor(Math.random() * 200);
const child = spawn(process.execPath, [path.join(root, "server", "index.mjs")], {
  env: {
    ...process.env,
    API_HOST: "127.0.0.1",
    API_PORT: String(port),
    PB_URL: "http://127.0.0.1:8090",
    PB_SUPERUSER_EMAIL: "smoke@example.com",
    PB_SUPERUSER_PASSWORD: "smoke-test-password",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});

async function finish(code, message) {
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.kill("SIGKILL");
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", resolve);
    setTimeout(resolve, 2000);
  });
  if (stubCreated) fs.rmSync(distDir, { recursive: true, force: true });
  if (message) console.error(message);
  process.exitCode = code;
}

if (child.exitCode !== null) {
  await finish(1, `API exited during startup.\n${output}`);
}

const deadline = Date.now() + 15000;
let healthy = false;

while (Date.now() < deadline) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    const body = await response.json();
    if (response.ok && body.status === "ok") {
      healthy = true;
      break;
    }
  } catch {
    // Not listening yet.
  }
  if (child.exitCode !== null) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
}

if (!healthy) {
  await finish(1, `API smoke test failed: /api/health did not become ready.\n${output}`);
}

console.log("API smoke test passed: /api/health responded ok.");
await finish(0);
