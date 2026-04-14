#!/usr/bin/env node
// Cross-platform Go API dev runner — replaces dev-api.sh.
// Loads env vars from server/.env.dev and root .env, then runs `go run ./cmd/api`.

import { execSync, spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENV = resolve(ROOT, "server/.env.dev");
const ROOT_ENV = resolve(ROOT, ".env");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const vars = {};
  for (const line of readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    vars[key] = val;
  }
  return vars;
}

// Load root .env first, then overlay server/.env.dev (if it exists)
const rootEnv = parseEnvFile(ROOT_ENV);
const devEnv = parseEnvFile(SERVER_ENV);

// Merge: root .env as base, server/.env.dev overrides
const env = { ...rootEnv, ...devEnv };

// Build DATABASE_URL from individual components if not explicitly set.
// Always use localhost: DATABASE_HOST in root .env is 'postgres' (Docker
// internal hostname) which doesn't resolve on the host machine.
if (!env.DATABASE_URL) {
  const dbPort = env.DATABASE_PORT || "5432";
  const dbUser = env.DATABASE_USER || "zynqcloud";
  const dbPass = env.DATABASE_PASSWORD || "supersecret_db_pass";
  const dbName = env.DATABASE_NAME || "zynqcloud";
  env.DATABASE_URL = `postgresql://${dbUser}:${dbPass}@localhost:${dbPort}/${dbName}`;
}

// ── Find Go binary ──────────────────────────────────────────────────
let goBin = "go";
try {
  execSync(`${goBin} version`, { stdio: "pipe" });
} catch {
  // Try common install locations
  const tryPaths = ["/usr/local/go/bin/go", "/opt/homebrew/bin/go"];
  for (const p of tryPaths) {
    try {
      execSync(`${p} version`, { stdio: "pipe" });
      goBin = p;
      break;
    } catch {}
  }
}

// ── Build & Run Go API ───────────────────────────────────────────────
// Build to a project-local path instead of using `go run` (which compiles
// to a temp dir that Windows Application Control may block).
const serverDir = resolve(ROOT, "server");
const binDir = resolve(serverDir, "bin");
const isWindows = process.platform === "win32";
const binName = isWindows ? "api.exe" : "api";
const binPath = resolve(binDir, binName);

import { mkdirSync } from "fs";
mkdirSync(binDir, { recursive: true });

console.log("Compiling Go API...");
try {
  execSync(`${goBin} build -o ${JSON.stringify(binPath)} ./cmd/api`, {
    cwd: serverDir,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
} catch {
  console.error("Go build failed");
  process.exit(1);
}

const goApi = spawn(binPath, [], {
  cwd: serverDir,
  stdio: "inherit",
  env: { ...process.env, ...env },
  shell: false,
});

goApi.on("exit", (code) => process.exit(code ?? 1));
process.on("SIGINT", () => goApi.kill());
process.on("SIGTERM", () => goApi.kill());
