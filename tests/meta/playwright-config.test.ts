import { describe, expect, it } from 'vitest';

import {
  createMetaPlaywrightConfig,
  resolveMetaE2EPort,
} from '../../meta-app/playwright.config';

describe('meta-app Playwright server isolation', () => {
  it('uses a fresh loopback server on the default isolated port', () => {
    const config = createMetaPlaywrightConfig();

    expect(config.use).toMatchObject({
      baseURL: 'http://127.0.0.1:5194',
    });
    expect(config.webServer).toMatchObject({
      command: 'npm run dev:meta -- --host 127.0.0.1 --port 5194 --strictPort',
      url: 'http://127.0.0.1:5194',
      reuseExistingServer: false,
    });
  });

  it.each(['', '0', '65536', '12.5', 'abc'])('rejects invalid port %j', (value) => {
    expect(() => resolveMetaE2EPort(value)).toThrow(
      'PLAYWRIGHT_META_PORT must be a decimal integer from 1 to 65535',
    );
  });
});
