// tests/smoke/format-md — Phase 9-A Markdown formatter tests

import { describe, it, expect } from 'vitest';
import { formatMarkdown } from '../../scripts/smoke/format-md';
import type { AggregateReport } from '../../scripts/smoke/aggregate';

function sampleReport(): AggregateReport {
  return {
    schemaVersion: 1,
    runId: 'smoke-2026-05-17-103045',
    engineSha: 'abc1234',
    totalGames: 1000,
    matrix: [
      { deckA: 'CT-D08', deckB: 'CT-D08', games: 333 },
      { deckA: 'CT-D08', deckB: 'CT-D11', games: 334 },
      { deckA: 'CT-D11', deckB: 'CT-D11', games: 333 },
    ],
    summary: {
      totalGames: 1000,
      winsA: 502,
      winsB: 488,
      timeouts: 10,
      exceptions: 0,
      avgTurns: 32.4,
      p50Turns: 30,
      p95Turns: 68,
      maxTurns: 187,
      totalDurationMs: 145320,
    },
    perPairing: [
      { deckA: 'CT-D08', deckB: 'CT-D08', games: 333, winsA: 168, winsB: 165, timeouts: 0, exceptions: 0, avgTurns: 30.1 },
      { deckA: 'CT-D08', deckB: 'CT-D11', games: 334, winsA: 165, winsB: 165, timeouts: 4, exceptions: 0, avgTurns: 33.0 },
      { deckA: 'CT-D11', deckB: 'CT-D11', games: 333, winsA: 169, winsB: 158, timeouts: 6, exceptions: 0, avgTurns: 34.2 },
    ],
    anomalies: [
      { seed: 'smoke-42', pairing: { deckA: 'CT-D08', deckB: 'CT-D11' }, reason: 'timeout', turn: 200 },
    ],
  };
}

describe('formatMarkdown', () => {
  it('includes title and metadata', () => {
    const md = formatMarkdown(sampleReport());
    expect(md).toContain('# Smoke 1000戦レポート');
    expect(md).toContain('smoke-2026-05-17-103045');
    expect(md).toContain('engine: `abc1234`');
    expect(md).toContain('145.3 s');
  });

  it('summary table contains percentages', () => {
    const md = formatMarkdown(sampleReport());
    expect(md).toContain('502 / 1000 (50.2%)');
    expect(md).toContain('488 / 1000 (48.8%)');
    expect(md).toContain('10 (1.0%)');
  });

  it('per-pairing rows present', () => {
    const md = formatMarkdown(sampleReport());
    expect(md).toContain('CT-D08 vs CT-D08');
    expect(md).toContain('CT-D08 vs CT-D11');
    expect(md).toContain('CT-D11 vs CT-D11');
  });

  it('anomaly seed listed with reproduction command', () => {
    const md = formatMarkdown(sampleReport());
    expect(md).toContain('`smoke-42` — timeout @ turn 200');
    expect(md).toContain('tsx scripts/smoke/run-1000.ts --seed=');
  });

  it('shows "_異常なし_" when no anomalies', () => {
    const r = sampleReport();
    r.anomalies = [];
    const md = formatMarkdown(r);
    expect(md).toContain('_異常なし_');
    expect(md).not.toContain('再現コマンド');
  });

  it('caps anomaly list at 20 entries with overflow notice', () => {
    const r = sampleReport();
    r.anomalies = Array.from({ length: 100 }, (_, i) => ({
      seed: `smoke-${i}`,
      pairing: { deckA: 'CT-D08' as const, deckB: 'CT-D08' as const },
      reason: 'timeout' as const,
      turn: 201,
    }));
    const md = formatMarkdown(r);
    expect(md).toContain('`smoke-0` — timeout');
    expect(md).toContain('`smoke-19` — timeout');
    expect(md).not.toContain('`smoke-20` — timeout');
    expect(md).toContain('+80 more anomalies');
  });

  it('truncates very long error stacks', () => {
    const r = sampleReport();
    r.anomalies = [
      {
        seed: 'smoke-99',
        pairing: { deckA: 'CT-D08', deckB: 'CT-D08' },
        reason: 'exception',
        turn: 15,
        error: 'x'.repeat(500),
      },
    ];
    const md = formatMarkdown(r);
    expect(md).toContain('`smoke-99` — exception');
    expect(md).toContain('...');
    const errLine = md.split('\n').find(l => l.includes('smoke-99'));
    expect(errLine).toBeDefined();
    expect((errLine ?? '').length).toBeLessThan(300);
  });
});
