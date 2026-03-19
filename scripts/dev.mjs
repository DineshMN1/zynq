#!/usr/bin/env node
// Cross-platform dev script — works on Windows, macOS, and Linux.
// Usage: node scripts/dev.mjs

import { execSync, spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE_FILE = resolve(ROOT, "docker-compose.dev.yml");

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, stdio: "inherit", ...opts });
}

function runQuiet(cmd) {
  return execSync(cmd, { cwd: ROOT, stdio: "pipe" }).toString().trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(label, checkFn, intervalMs = 1000, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (checkFn()) return;
    } catch {}
    await sleep(intervalMs);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

// ── 1. Start Postgres ───────────────────────────────────────────────
console.log("Starting Postgres...");
run(`docker compose -f "${COMPOSE_FILE}" up -d`);

console.log("Waiting for Postgres...");
await waitFor("Postgres", () => {
  runQuiet(
    "docker exec zynqcloud-postgres-dev pg_isready -U zynqcloud -d zynqcloud"
  );
  return true;
});
console.log("Postgres ready.");

// ── 2. Start Go API (background) ────────────────────────────────────
console.log("Starting Go API (compiling...)...");
const api = spawn("node", [resolve(ROOT, "scripts/dev-api.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});

// Kill API when this script exits
function cleanup() {
  console.log("\nStopping...");
  api.kill();
  process.exit();
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", () => api.kill());

console.log("Waiting for Go API...");
await waitFor("Go API", () => {
  // Use a quick HTTP check — works cross-platform via Node
  execSync("node -e \"const h=require('http');const r=h.get('http://localhost:4000/api/v1/health',res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1))\"", {
    stdio: "pipe",
  });
  return true;
});
console.log("Go API ready.");

// ── 3. Start Vite (foreground) ──────────────────────────────────────
console.log("Starting Vite...");
const vite = spawn("pnpm", ["--filter", "@zynqcloud/web", "dev"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, VITE_API_URL: "/api/v1" },
  shell: true,
});

vite.on("exit", (code) => {
  cleanup();
  process.exit(code ?? 0);
});
