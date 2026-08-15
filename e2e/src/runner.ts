#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

// Load environment files if present
const rootDir = resolve(process.cwd());
const envPaths = [
  resolve(rootDir, ".env"),
  resolve(rootDir, "apps/server/.env"),
  resolve(rootDir, "e2e/.env"),
];

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: false });
  }
}

type FeatureName = "institution" | "employee-setup" | "employee" | "payroll" | "reports";
type DepthName = "smoke" | "regression";

const VALID_FEATURES: FeatureName[] = [
  "institution",
  "employee-setup",
  "employee",
  "payroll",
  "reports",
];

const VALID_DEPTHS: DepthName[] = ["smoke", "regression"];

function printHelp() {
  console.log(`
Usage: bun e2e/src/runner.ts [options]

Options:
  -f, --feature <name>     Select feature suite: institution, employee-setup, employee, payroll, reports (default: all)
  -d, --depth <name>       Select suite depth: smoke, regression (default: smoke)
  -w, --workers <count>    Set worker count for execution
  -r, --retries <count>    Set retry count (default: 0)
  -p, --project <name>     Select Playwright project: desktop, mobile (default: all projects)
      --base-url <url>     Override BASE_URL environment variable
      --admin-identifier <id>  Override admin identifier
      --admin-password <pwd> Override admin password
      --headed             Run tests in headed browser mode
      --ui                 Open Playwright UI mode
  -h, --help               Show this help message
`);
}

function parseCliArgs(args: string[]) {
  let feature: FeatureName | undefined;
  let depth: DepthName = "smoke";
  let workers: number | undefined;
  let retries = 0;
  let project: string | undefined;
  let headed = false;
  let ui = false;
  const passThrough: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const currentArg = args[i];
    if (!currentArg) continue;

    if (currentArg === "-h" || currentArg === "--help") {
      printHelp();
      process.exit(0);
    } else if (currentArg === "-f" || currentArg === "--feature") {
      const nextVal = args[++i];
      const val = (nextVal?.toLowerCase() ?? "") as FeatureName;
      if (!VALID_FEATURES.includes(val)) {
        console.error(
          `Error: Invalid feature "${nextVal}". Supported features: ${VALID_FEATURES.join(", ")}`,
        );
        process.exit(1);
      }
      feature = val;
    } else if (currentArg.startsWith("--feature=")) {
      const val = (currentArg.split("=")[1]?.toLowerCase() ?? "") as FeatureName;
      if (!VALID_FEATURES.includes(val)) {
        console.error(
          `Error: Invalid feature "${val}". Supported features: ${VALID_FEATURES.join(", ")}`,
        );
        process.exit(1);
      }
      feature = val;
    } else if (currentArg === "-d" || currentArg === "--depth") {
      const nextVal = args[++i];
      const val = (nextVal?.toLowerCase() ?? "") as DepthName;
      if (!VALID_DEPTHS.includes(val)) {
        console.error(
          `Error: Invalid depth "${nextVal}". Supported depths: ${VALID_DEPTHS.join(", ")}`,
        );
        process.exit(1);
      }
      depth = val;
    } else if (currentArg.startsWith("--depth=")) {
      const val = (currentArg.split("=")[1]?.toLowerCase() ?? "") as DepthName;
      if (!VALID_DEPTHS.includes(val)) {
        console.error(
          `Error: Invalid depth "${val}". Supported depths: ${VALID_DEPTHS.join(", ")}`,
        );
        process.exit(1);
      }
      depth = val;
    } else if (currentArg === "-w" || currentArg === "--workers") {
      const nextVal = args[++i];
      if (nextVal) workers = parseInt(nextVal, 10);
    } else if (currentArg.startsWith("--workers=")) {
      const val = currentArg.split("=")[1];
      if (val) workers = parseInt(val, 10);
    } else if (currentArg === "-r" || currentArg === "--retries") {
      const nextVal = args[++i];
      if (nextVal) retries = parseInt(nextVal, 10);
    } else if (currentArg.startsWith("--retries=")) {
      const val = currentArg.split("=")[1];
      if (val) retries = parseInt(val, 10);
    } else if (currentArg === "-p" || currentArg === "--project") {
      const nextVal = args[++i];
      if (nextVal) project = nextVal;
    } else if (currentArg.startsWith("--project=")) {
      const val = currentArg.split("=")[1];
      if (val) project = val;
    } else if (currentArg === "--base-url") {
      const nextVal = args[++i];
      if (nextVal) process.env.BASE_URL = nextVal;
    } else if (currentArg.startsWith("--base-url=")) {
      const val = currentArg.split("=")[1];
      if (val) process.env.BASE_URL = val;
    } else if (currentArg === "--admin-identifier") {
      const nextVal = args[++i];
      if (nextVal) process.env.ADMIN_IDENTIFIER = nextVal;
    } else if (currentArg.startsWith("--admin-identifier=")) {
      const val = currentArg.split("=")[1];
      if (val) process.env.ADMIN_IDENTIFIER = val;
    } else if (currentArg === "--admin-password") {
      const nextVal = args[++i];
      if (nextVal) process.env.ADMIN_PASSWORD = nextVal;
    } else if (currentArg.startsWith("--admin-password=")) {
      const val = currentArg.split("=")[1];
      if (val) process.env.ADMIN_PASSWORD = val;
    } else if (currentArg === "--headed") {
      headed = true;
    } else if (currentArg === "--ui") {
      ui = true;
    } else {
      passThrough.push(currentArg);
    }
  }

  return { feature, depth, workers, retries, project, headed, ui, passThrough };
}

function resolveTestTarget(feature: FeatureName | undefined, depth: DepthName): string {
  if (feature) {
    return `tests/${feature}.${depth}.spec.ts`;
  }
  return `tests/*.${depth}.spec.ts`;
}

function validateEnvironment() {
  const baseURL = process.env.BASE_URL?.trim() || "http://localhost:5173";
  try {
    const parsed = new URL(baseURL);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Protocol must be http: or https:");
    }
    process.env.BASE_URL = baseURL.replace(/\/+$/, "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ E2E Configuration Error: Invalid BASE_URL "${baseURL}". (${msg})\n`);
    process.exit(1);
  }

  const adminId = process.env.ADMIN_IDENTIFIER?.trim() || process.env.TEST_IDENTIFIER?.trim();
  const adminPwd = process.env.ADMIN_PASSWORD?.trim() || process.env.TEST_PASSWORD?.trim();

  if (!adminId || !adminPwd) {
    console.error(`
❌ E2E Configuration Error: Missing required administrator credentials.
Please set the following environment variables:
  - ADMIN_IDENTIFIER (or TEST_IDENTIFIER)
  - ADMIN_PASSWORD (or TEST_PASSWORD)
  - BASE_URL (currently: ${baseURL})
`);
    process.exit(1);
  }

  process.env.ADMIN_IDENTIFIER = adminId;
  process.env.TEST_IDENTIFIER = adminId;
  process.env.ADMIN_PASSWORD = adminPwd;
  process.env.TEST_PASSWORD = adminPwd;
}

export function runE2E() {
  const cliArgs = process.argv.slice(2);
  const options = parseCliArgs(cliArgs);

  validateEnvironment();

  const testTarget = resolveTestTarget(options.feature, options.depth);

  const playwrightArgs: string[] = ["playwright", "test", testTarget];

  if (options.retries !== undefined) {
    playwrightArgs.push(`--retries=${options.retries}`);
    process.env.E2E_RETRIES = String(options.retries);
  }

  if (options.workers !== undefined) {
    playwrightArgs.push(`--workers=${options.workers}`);
    process.env.E2E_WORKERS = String(options.workers);
  }

  if (options.project) {
    playwrightArgs.push(`--project=${options.project}`);
  }

  if (options.headed) {
    playwrightArgs.push("--headed");
  }

  if (options.ui) {
    playwrightArgs.push("--ui");
  }

  if (options.passThrough.length > 0) {
    playwrightArgs.push(...options.passThrough);
  }

  const e2eDir = resolve(rootDir, "e2e");

  console.log(`\n🚀 Starting E2E Runner`);
  console.log(`   Feature: ${options.feature || "all"}`);
  console.log(`   Depth:   ${options.depth}`);
  console.log(`   Target:  ${testTarget}`);
  console.log(`   BaseURL: ${process.env.BASE_URL}\n`);

  const result = spawnSync("bunx", playwrightArgs, {
    cwd: e2eDir,
    stdio: "inherit",
    env: {
      ...process.env,
      BASE_URL: process.env.BASE_URL,
      TEST_IDENTIFIER: process.env.ADMIN_IDENTIFIER,
      TEST_PASSWORD: process.env.ADMIN_PASSWORD,
      ADMIN_IDENTIFIER: process.env.ADMIN_IDENTIFIER,
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
      E2E_FEATURE: options.feature || "all",
      E2E_DEPTH: options.depth,
      E2E_RETRIES: String(options.retries),
    },
  });

  process.exit(result.status ?? 0);
}

// Run directly when executed
if (import.meta.main) {
  runE2E();
}
