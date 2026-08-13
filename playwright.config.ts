import { defineConfig, devices } from '@playwright/test';

export function resolveE2EPort(value = process.env.PLAYWRIGHT_PORT): number {
  if (value === undefined) return 5173;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('PLAYWRIGHT_PORT must be a decimal integer from 1 to 65535');
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error('PLAYWRIGHT_PORT must be a decimal integer from 1 to 65535');
  }

  return port;
}

export function createPlaywrightConfig(e2ePort = resolveE2EPort()) {
  const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

  return defineConfig({
  testDir: './tests/e2e',
  testIgnore: 'private-hosted-static.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: e2eBaseUrl,
    headless: !!process.env.CI,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npx vite build --config vite.config.e2e.ts && npx vite preview --config vite.config.e2e.ts --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    env: {
      PLAYWRIGHT_PORT: String(e2ePort),
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 851, height: 393 },
        screen: { width: 851, height: 393 },
      },
    },
  ],
  });
}

export default createPlaywrightConfig();
