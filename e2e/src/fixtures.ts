import { test as base } from "@playwright/test";

import { generateIndianInstitution, type IndianInstitutionSeed } from "./data/indian-institutions";
import { readTestEnv, type TestEnv } from "./env";
import { updateRunManifest, writeRunManifest, type RunManifest } from "./manifest";
import { createRunContext, type RunContext } from "./run-context";

type TestFixtures = {
  runId: string;
  institution: IndianInstitutionSeed;
  manifest: RunManifest;
};

type WorkerFixtures = {
  env: TestEnv;
  run: RunContext;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
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
  runId: async ({}, use) => {
    const id = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await use(id);
  },
  institution: async ({ runId }, use) => {
    const institution = generateIndianInstitution(runId);
    await use(institution);
  },
  manifest: [
    async ({ env, runId, institution, page }, use, testInfo) => {
      const startedAt = new Date().toISOString();
      const startTime = Date.now();
      const viewport = page.viewportSize() ?? undefined;
      const isMobile = testInfo.project.use.isMobile ?? false;

      const manifestData: RunManifest = {
        runId,
        targetUrl: env.baseURL,
        feature: testInfo.titlePath[1] || "institution",
        depth: testInfo.titlePath[0]?.toLowerCase().includes("smoke") ? "smoke" : "smoke",
        startedAt,
        status: "running",
        generatedCredentials: {
          adminIdentifier: env.adminIdentifier,
          institutionUsername: institution.username,
          institutionPassword: institution.password,
        },
        createdInstitution: {
          name: institution.name,
          tanNumber: institution.tanNumber,
          institutionHead: institution.institutionHead,
          address: institution.address,
          username: institution.username,
        },
        viewport: {
          name: testInfo.project.name,
          width: viewport?.width,
          height: viewport?.height,
          isMobile,
        },
      };

      await writeRunManifest(manifestData);

      try {
        await use(manifestData);
        const durationMs = Date.now() - startTime;
        const status =
          testInfo.status === "passed"
            ? "passed"
            : testInfo.status === "timedOut"
              ? "timedOut"
              : "failed";
        await updateRunManifest(runId, (prev) => ({
          ...prev,
          status,
          completedAt: new Date().toISOString(),
          durationMs,
          error: testInfo.error?.message,
        }));
      } catch (err) {
        const durationMs = Date.now() - startTime;
        await updateRunManifest(runId, (prev) => ({
          ...prev,
          status: "failed",
          completedAt: new Date().toISOString(),
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        }));
        throw err;
      }
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
