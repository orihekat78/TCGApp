import { describe, expect, it } from 'vitest';

import { renderCodexContext, sortBugFilenames } from '../../scripts/gen-codex-context.mjs';

describe('renderCodexContext', () => {
  it('renders bounded deterministic startup context', () => {
    const output = renderCodexContext({
      generatedAt: '2026-07-13T12:00:00+09:00',
      branch: 'main',
      latestCommit: 'abc1234 feat: sample',
      worktree: ['M AGENTS.md', '?? src/ui/AGENTS.md'],
      activeBugs: ['BUG-188: open - hand cut-in'],
      memorySummary: ['Codex migration Phase 2 in progress'],
      nextPrompt: 'Continue Phase 2 verification',
    });

    expect(output).toContain('# Current Codex Context');
    expect(output).toContain('latest commit time: 2026-07-13T12:00:00+09:00');
    expect(output).toContain('branch: `main`');
    expect(output).toContain('BUG-188: open - hand cut-in');
    expect(output).toContain('Continue Phase 2 verification');
    expect(output).not.toContain('undefined');
    expect(output).not.toContain('generated:');
    expect(output.trimEnd().split('\n').length).toBeLessThanOrEqual(80);
  });
});

describe('sortBugFilenames', () => {
  it('sorts by numeric bug id, newest first', () => {
    expect(sortBugFilenames(['BUG-99.md', 'BUG-188.md', 'BUG-7.md'])).toEqual([
      'BUG-188.md',
      'BUG-99.md',
      'BUG-7.md',
    ]);
  });
});
