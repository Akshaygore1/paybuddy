import { createDb } from "@paybuddy/db";
import * as schema from "@paybuddy/db/schema/auth";
import { env } from "@paybuddy/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { username } from "better-auth/plugins/username";
import { z } from "zod";
export { authAdditionalUserFields, type UserRole, userRoles } from "./shared";
import { authAdditionalUserFields } from "./shared";

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",

      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: authAdditionalUserFields,
    },
    plugins: [
      username({
        maxUsernameLength: 254,
        usernameValidator: (value) =>
          z.email().safeParse(value).success || /^[a-zA-Z0-9_.]+$/.test(value),
      }),
      admin({
        adminRoles: ["admin"],
        defaultRole: "user",
      }),
    ],
    // uncomment cookieCache setting when ready to deploy to Cloudflare using *.workers.dev domains
    // session: {
    //   cookieCache: {
    //     enabled: true,
    //     maxAge: 60,
    //   },
    // },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        httpOnly: true,
      },
      // uncomment crossSubDomainCookies setting when ready to deploy and replace <your-workers-subdomain> with your actual workers subdomain
      // https://developers.cloudflare.com/workers/wrangler/configuration/#workersdev
      // crossSubDomainCookies: {
      //   enabled: true,
      //   domain: "<your-workers-subdomain>",
      // },
    },
  });
}
