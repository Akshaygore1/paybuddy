#!/usr/bin/env bun

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

const BASE_URL = "http://localhost:3000";
const ADMIN_EMAIL = "admin@mail.com";
const ADMIN_PASSWORD = "Hardpassword@123";
const ADMIN_NAME = "Local Admin";
const ENV_PATH = resolve(process.cwd(), "apps/server/.env");

loadEnv({ path: ENV_PATH, quiet: true });

const bootstrapSecret = process.env.BOOTSTRAP_API_SECRET;

if (!bootstrapSecret) {
  console.error(`Missing BOOTSTRAP_API_SECRET in ${ENV_PATH}.`);
  process.exit(1);
}

async function request(path: string, init: RequestInit) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-bootstrap-secret": bootstrapSecret,
      ...init.headers,
    },
  });

  const text = await response.text();
  const json = text ? tryParseJson(text) : null;

  return {
    response,
    body: json,
    text,
  };
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function ensureServerReachable() {
  try {
    const response = await fetch(`${BASE_URL}/`, {
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      throw new Error(`Local server responded with ${response.status}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      `Local server is unreachable at ${BASE_URL}. Start the local stack with \`bun run dev\` or run the worker from \`packages/infra\`. (${message})`,
    );
    process.exit(1);
  }
}

async function deleteExistingAdmin() {
  const { response, body, text } = await request("/api/bootstrap/users", {
    method: "DELETE",
    body: JSON.stringify({
      email: ADMIN_EMAIL,
    }),
  });

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to delete existing admin: ${response.status} ${formatErrorMessage(body, text)}`,
    );
  }
}

async function createAdmin() {
  const { response, body, text } = await request("/api/bootstrap/users", {
    method: "POST",
    body: JSON.stringify({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: "admin",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create admin: ${response.status} ${formatErrorMessage(body, text)}`);
  }
}

function formatErrorMessage(body: Record<string, unknown> | null, text: string) {
  if (body && typeof body.message === "string") {
    return body.message;
  }

  return text || "Unknown error";
}

await ensureServerReachable();

try {
  await deleteExistingAdmin();
  await createAdmin();

  console.log(`Admin seeded: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
