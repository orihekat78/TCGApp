import { describe, expect, it } from 'vitest';

import {
  createResultTemplate,
  scoreResults,
} from '../../scripts/codex-quality-core.mjs';

const tasks = [
  { id: 'critical', critical: true },
  { id: 'normal', critical: false },
];
const thresholds = {
  minimumRepetitions: 3,
  criticalPassRate: 1,
  overallPassRate: 0.95,
  maximumUnsupportedClaims: 0,
  maximumScopeViolations: 0,
};

describe('createResultTemplate', () => {
  it('creates the required repetitions for every task', () => {
    const template = createResultTemplate(tasks, thresholds.minimumRepetitions);
    expect(template).toHaveLength(2);
    expect(template[0].runs).toHaveLength(3);
  });
});

describe('scoreResults', () => {
  it('passes complete evidence-backed results', () => {
    const results = createResultTemplate(tasks, thresholds.minimumRepetitions)
      .map((result) => ({
        ...result,
        runs: result.runs.map((run) => ({
          ...run,
          passed: true,
          evidence: ['reviewed artifact'],
          inputTokens: 100,
          outputTokens: 20,
          latencyMs: 500,
        })),
      }));

    expect(scoreResults(tasks, thresholds, results)).toMatchObject({
      failures: [],
      summary: {
        overallRate: 1,
        criticalRate: 1,
        runPassRate: 1,
      },
    });
  });

  it('rejects one failed critical run', () => {
    const results = createResultTemplate(tasks, thresholds.minimumRepetitions)
      .map((result) => ({
        ...result,
        runs: result.runs.map((run) => ({
          ...run,
          passed: true,
          evidence: ['reviewed artifact'],
          inputTokens: 100,
          outputTokens: 20,
          latencyMs: 500,
        })),
      }));
    results[0].runs[1].passed = false;

    const scored = scoreResults(tasks, thresholds, results);
    expect(scored.summary.criticalRate).toBe(0);
    expect(scored.failures).toContain('critical pass rate 0');
  });

  it('rejects missing usage measurements', () => {
    const results = createResultTemplate(tasks, thresholds.minimumRepetitions)
      .map((result) => ({
        ...result,
        runs: result.runs.map((run) => ({
          ...run,
          passed: true,
          evidence: ['reviewed artifact'],
        })),
      }));

    expect(scoreResults(tasks, thresholds, results).failures).toContain(
      'critical run 1: invalid inputTokens',
    );
  });
});
