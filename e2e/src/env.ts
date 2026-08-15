import { loadE2EEnv } from "./load-env";

loadE2EEnv();

export type TestEnv = {
  baseURL: string;
  serverURL: string;
  identifier: string;
  password: string;
  adminIdentifier: string;
  adminPassword: string;
  institutionId: string;
  institutionUsername: string;
  institutionPassword: string;
};

function getRequiredEnv(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required E2E environment variable: ${names.join(" or ")}`);
}

export function validateTestEnv(): TestEnv {
  const rawBaseURL = process.env.BASE_URL?.trim() || "http://localhost:5173";

  let baseURL: string;
  try {
    const parsed = new URL(rawBaseURL);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`BASE_URL must use http:// or https:// protocol, got "${rawBaseURL}"`);
    }
    baseURL = rawBaseURL.replace(/\/+$/, "");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid BASE_URL: "${rawBaseURL}". (${msg})`);
  }

  const rawServerURL =
    process.env.SERVER_URL?.trim() ||
    process.env.VITE_SERVER_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:3000";

  let serverURL: string;
  try {
    const parsed = new URL(rawServerURL);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`SERVER_URL must use http:// or https:// protocol, got "${rawServerURL}"`);
    }
    serverURL = rawServerURL.replace(/\/+$/, "");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid SERVER_URL: "${rawServerURL}". (${msg})`);
  }

  const adminIdentifier = getRequiredEnv(["ADMIN_IDENTIFIER", "TEST_IDENTIFIER"]);
  const adminPassword = getRequiredEnv(["ADMIN_PASSWORD", "TEST_PASSWORD"]);
  const institutionId = getRequiredEnv(["E2E_INSTITUTION_ID"]);
  const institutionUsername = getRequiredEnv(["E2E_INSTITUTION_USERNAME"]);
  const institutionPassword = getRequiredEnv(["E2E_INSTITUTION_PASSWORD"]);

  return {
    baseURL,
    serverURL,
    identifier: adminIdentifier,
    password: adminPassword,
    adminIdentifier,
    adminPassword,
    institutionId,
    institutionUsername,
    institutionPassword,
  };
}

export function readTestEnv(): TestEnv {
  return validateTestEnv();
}
