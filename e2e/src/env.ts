export type TestEnv = {
  baseURL: string;
  identifier: string;
  password: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required E2E environment variable: ${name}`);
  }

  return value;
}

export function readTestEnv(): TestEnv {
  return {
    baseURL: getRequiredEnv("BASE_URL"),
    identifier: getRequiredEnv("TEST_IDENTIFIER"),
    password: getRequiredEnv("TEST_PASSWORD"),
  };
}
