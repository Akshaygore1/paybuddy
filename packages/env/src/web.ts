import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const runtimeEnv = (import.meta as ImportMeta & {
  env: Record<string, string | undefined>;
}).env;

const skipValidation =
  typeof process !== "undefined" && !!process.env.SKIP_ENV_VALIDATION;

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.url(),
  },
  runtimeEnv,
  skipValidation,
  emptyStringAsUndefined: true,
});
