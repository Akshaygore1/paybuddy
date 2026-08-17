import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const environmentFiles = [
  resolve(repositoryRoot, "e2e/.env.test"),
  resolve(repositoryRoot, ".env"),
  resolve(repositoryRoot, "apps/server/.env"),
  resolve(repositoryRoot, "e2e/.env"),
];

export function loadE2EEnv(): void {
  for (const environmentFile of environmentFiles) {
    if (existsSync(environmentFile)) {
      loadDotenv({ path: environmentFile, override: false, quiet: true });
    }
  }
}
