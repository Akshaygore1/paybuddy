import { loadE2EEnv } from "./src/load-env";
import { defineConfig, devices } from "@playwright/test";

loadE2EEnv();

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  // Every feature mutates the same dedicated tenant. Keep all projects and files serial.
  fullyParallel: false,
  workers: 1,
  retries: process.env.E2E_RETRIES !== undefined ? Number(process.env.E2E_RETRIES) : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
