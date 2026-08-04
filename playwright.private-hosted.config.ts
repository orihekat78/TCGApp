import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";
import { resolvePrivateHostedEnvironment } from "./scripts/private-hosted/run-local-qualification.js";

const paths = resolvePrivateHostedEnvironment(process.env);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "private-hosted-static.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: resolve(paths.runDir, "playwright-results"),
  use: {
    baseURL: "http://127.0.0.1:5196",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-1280x720",
      grep: /@(desktop|all)/,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1280, height: 720 },
        screen: { width: 1280, height: 720 },
      },
    },
    {
      name: "iphone-13-landscape-844x390",
      grep: /@all/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 844, height: 390 },
        screen: { width: 844, height: 390 },
      },
    },
    {
      name: "pixel-5-landscape-851x393",
      grep: /@all/,
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: { width: 851, height: 393 },
        screen: { width: 851, height: 393 },
      },
    },
  ],
});
