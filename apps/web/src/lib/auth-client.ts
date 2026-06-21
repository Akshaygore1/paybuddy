import { env } from "@paybuddy/env/web";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { authAdditionalUserFields } from "./auth-schema";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  plugins: [
    inferAdditionalFields({
      user: authAdditionalUserFields,
    }),
  ],
});
