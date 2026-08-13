import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveMetaE2EPort } from './playwright.config';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const port = resolveMetaE2EPort();
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: resolve(currentDirectory, 'tests/e2e'),
  testMatch: 'cloud-sync-webkit.spec.ts',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    viewport: { width: 851, height: 393 },
    actionTimeout: 5_000,
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'webkit',
    use: { ...devices['iPhone SE (3rd gen) landscape'] },
  }],
  webServer: {
    command: `npm run dev:meta -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    cwd: resolve(currentDirectory, '..'),
    env: { VITE_CLOUD_DATA_SYNC_ENABLED: 'true' },
  },
});
