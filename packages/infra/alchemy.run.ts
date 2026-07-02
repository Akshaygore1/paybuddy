import alchemy from "alchemy";
import { ReactRouter } from "alchemy/cloudflare";
import { Worker } from "alchemy/cloudflare";
import { D1Database } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });

const envMode = process.env.PAYBUDDY_ENV ?? "local";

if (envMode === "local") {
  config({ path: "../../apps/web/.env", override: true });
  config({ path: "../../apps/server/.env", override: true });
} else if (envMode === "production") {
  config({ path: "./.env.production.local", override: true });
} else {
  throw new Error(
    `Unsupported PAYBUDDY_ENV "${envMode}". Expected "local" or "production".`,
  );
}

const app = await alchemy("paybuddy");

const db = await D1Database("database", {
  migrationsDir: "../../packages/db/src/migrations",
});

export const server = await Worker("server", {
  cwd: "../../apps/server",
  entrypoint: "src/index.ts",
  compatibility: "node",
  url: true,
  bindings: {
    DB: db,
    CORS_ORIGIN: alchemy.env.CORS_ORIGIN!,
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: alchemy.env.BETTER_AUTH_URL!,
    BOOTSTRAP_API_SECRET: alchemy.secret.env.BOOTSTRAP_API_SECRET!,
  },
  dev: {
    port: 3000,
  },
});

export const web = await ReactRouter("web", {
  cwd: "../../apps/web",
  bindings: {
    VITE_SERVER_URL: server.url!,
  },
});

console.log(`Web    -> ${web.url}`);
console.log(`Server -> ${server.url}`);

await app.finalize();
