import { test as base } from "@playwright/test";

import { readTestEnv, type TestEnv } from "./env";
import { createRunContext, type RunContext } from "./run-context";

type WorkerFixtures = {
  env: TestEnv;
  run: RunContext;
};

export const test = base.extend<{}, WorkerFixtures>({
  env: [
    async ({}, use) => {
      await use(readTestEnv());
    },
    { scope: "worker" },
  ],
  run: [
    async ({}, use) => {
      await use(createRunContext());
    },
    { scope: "worker" },
  ],
});

export { expect } from "@playwright/test";
