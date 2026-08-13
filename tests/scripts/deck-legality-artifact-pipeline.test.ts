import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('deck-legality artifact pipeline', () => {
  it('regenerates with card artifacts and verifies freshness in CI', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['cards:artifacts']).toBeTypeOf('string');
    expect(packageJson.scripts['cards:artifacts'] ?? '').toContain('gen:deck-legality-catalog');
    expect(packageJson.scripts['cards:sync']).toContain('npm run cards:artifacts');

    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('npm run check:deck-legality-catalog');
  });
});
