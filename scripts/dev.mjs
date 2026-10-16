#!/usr/bin/env node
// Run the whole local stack with one command: `npm run dev:all`
//
//   pb   PocketBase        http://127.0.0.1:8090
//   api  Express API       http://0.0.0.0:3001
//   web  Vite dev server   http://localhost:5173
//
// Ctrl+C stops all three (on Windows the whole process tree is killed).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

const PB_HTTP = process.env.PB_HTTP_ADDR || "127.0.0.1:8090";
const API_PORT = process.env.API_PORT || "3001";
const WEB_PORT = process.env.WEB_PORT || "5173";

const C = { pb: "\x1b[38;5;75m", api: "\x1b[38;5;114m", web: "\x1b[38;5;215m", reset: "\x1b[0m", dim: "\x1b[2m" };

const pbBin = join(root, "pocketbase", isWin ? "pocketbase.exe" : "pocketbase");
if (!existsSync(pbBin)) {
  console.error(`\n  PocketBase binary not found at ${pbBin}\n`);
  process.exit(1);
}

const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
if (!existsSync(viteBin)) {
  console.error(`\n  Dependencies are missing. Run "npm install" first.\n`);
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function run(label, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const tag = `${C[label]}${label.padEnd(3)}${C.reset} ${C.dim}│${C.reset} `;
  const forward = (stream) =>
    stream.on("data", (buffer) => {
      String(buffer)
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .forEach((line) => process.stdout.write(tag + line + "\n"));
    });
  forward(child.stdout);
  forward(child.stderr);

  child.on("error", (error) => {
    process.stdout.write(`${tag}failed to start: ${error.message}\n`);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (shuttingDown) return;
    process.stdout.write(`${tag}exited with code ${code}\n`);
    shutdown(code ?? 0);
  });

  children.push(child);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (isWin) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(code), 900);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`\n  Starting life-planner stack…`);
console.log(`  ${C.pb}pb ${C.reset} PocketBase  →  http://${PB_HTTP}`);
console.log(`  ${C.api}api${C.reset} API server  →  http://localhost:${API_PORT}`);
console.log(`  ${C.web}web${C.reset} Vite        →  http://localhost:${WEB_PORT}`);
console.log(`  Press Ctrl+C to stop everything.\n`);

run("pb", pbBin, ["serve", `--http=${PB_HTTP}`], join(root, "pocketbase"));
run("api", process.execPath, [join(root, "server", "index.mjs")], root);
run("web", process.execPath, [viteBin, "--host", "0.0.0.0", "--port", WEB_PORT], root);
