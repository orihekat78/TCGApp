// spec: .claude/specs/meta-ui/09-phasing-and-verification.md
// meta-app 専用 Playwright 設定 (既存 playwright.config.ts と分離)

import { defineConfig, devices } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function resolveMetaE2EPort(value = process.env.PLAYWRIGHT_META_PORT): number {
  if (value === undefined) return 5194;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error('PLAYWRIGHT_META_PORT must be a decimal integer from 1 to 65535');
  }

  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error('PLAYWRIGHT_META_PORT must be a decimal integer from 1 to 65535');
  }
  return port;
}

export function createMetaPlaywrightConfig(e2ePort = resolveMetaE2EPort()) {
  const baseURL = `http://127.0.0.1:${e2ePort}`;

  return defineConfig({
    testDir: resolve(__dirname, 'tests/e2e'),
    timeout: 30_000,
    retries: 0,
    fullyParallel: false,
    reporter: [['list']],
    use: {
      baseURL,
      headless: true,
      viewport: { width: 1280, height: 800 },
      actionTimeout: 5_000,
      trace: 'retain-on-failure',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: `npm run dev:meta -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 30_000,
      cwd: resolve(__dirname, '..'),
    },
  });
}

export default createMetaPlaywrightConfig();
