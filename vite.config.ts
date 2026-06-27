import { defineConfig } from "vite-plus";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    alias: {
      "cloudflare:workers": fileURLToPath(new URL("./test/shims/cloudflare-workers.ts", import.meta.url)),
    },
  },
  lint: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/build/**",
      "apps/web/.react-router/**",
      "apps/server/dist/**",
      "packages/db/dist/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
    ],
    options: {
      typeAware: false,
      typeCheck: false,
    },
  },
  fmt: {
    ignorePatterns: [
      "node_modules/**",
      "**/node_modules/**",
      "apps/web/build/**",
      "apps/web/.react-router/**",
      "apps/server/dist/**",
      "packages/db/dist/**",
      ".alchemy/**",
      ".wrangler/**",
      "**/.wrangler/**",
    ],
    singleQuote: false,
    semi: true,
    sortPackageJson: true,
  },
  staged: {
    "*.{js,ts,jsx,tsx,vue,svelte,json,jsonc,css,md}": "vp check --fix",
  },
});
