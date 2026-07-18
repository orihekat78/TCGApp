import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve('.');

describe('Q&A CI workflow contracts', () => {
  it('keeps PR Q&A lint offline against tracked artifacts', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toMatch(/^\s*pull_request:/m);
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents:\s+read\s*$/m);
    expect(workflow).toContain('npm run lint:qa');
    expect(workflow).not.toMatch(/cards:check(?:\s|$)/);
    expect(workflow).not.toMatch(/cards:fetch|cards:sync|pull_request_target|secrets\./);
  });

  it('limits the live official status job to scheduled or manual read-only checks', () => {
    const workflow = readFileSync(resolve(root, '.github/workflows/cards-sync.yml'), 'utf8');
    expect(workflow).toMatch(/^\s*schedule:/m);
    expect(workflow).toMatch(/^\s*workflow_dispatch:/m);
    expect(workflow).toMatch(/^permissions:\s*\n\s+contents:\s+read\s*$/m);
    expect(workflow).toContain('npm run cards:check:live-status');
    expect(workflow).not.toMatch(/pull_request|pull_request_target|secrets\.|gh\s+pr|git\s+(?:commit|push)|cards:(?:fetch|sync)/);
  });
});
