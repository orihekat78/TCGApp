// tests/smoke/aggregate — Phase 9-A pure aggregation tests

import { describe, it, expect } from 'vitest';
import { aggregate, type GameRecord } from '../../scripts/smoke/aggregate';

function makeRecord(over: Partial<GameRecord> = {}): GameRecord {
  return {
    index: 0,
    seed: 'smoke-0',
    pairing: { deckA: 'CT-D08', deckB: 'CT-D08' },
    firstPlayer: 'A',
    winner: 'A',
    reason: 'evidence',
    turns: 30,
    durationMs: 100,
    ...over,
  };
}

describe('aggregate', () => {
  it('empty records → zero summary', () => {
    const r = aggregate([], 'run-1', 'sha-1');
    expect(r.totalGames).toBe(0);
    expect(r.summary.winsA).toBe(0);
    expect(r.summary.winsB).toBe(0);
    expect(r.summary.timeouts).toBe(0);
    expect(r.summary.exceptions).toBe(0);
    expect(r.summary.avgTurns).toBe(0);
    expect(r.anomalies).toEqual([]);
    expect(r.perPairing).toEqual([]);
    expect(r.matrix).toEqual([]);
  });

  it('single A win', () => {
    const r = aggregate([makeRecord()], 'run-1', 'sha-1');
    expect(r.summary.winsA).toBe(1);
    expect(r.summary.winsB).toBe(0);
    expect(r.totalGames).toBe(1);
  });

  it('winsA + winsB + timeouts + exceptions === totalGames', () => {
    const recs = [
      makeRecord({ index: 0, winner: 'A', reason: 'evidence', turns: 30 }),
      makeRecord({ index: 1, winner: 'A', reason: 'evidence', turns: 40 }),
      makeRecord({ index: 2, winner: 'B', reason: 'deck-out', turns: 50 }),
      makeRecord({ index: 3, winner: 'draw', reason: 'turn-cap', turns: 200 }),
      makeRecord({ index: 4, winner: 'invariant-fail', reason: 'invariant', turns: 15, error: 'boom' }),
    ];
    const r = aggregate(recs, 'run-1', 'sha-1');
    expect(r.summary.winsA + r.summary.winsB + r.summary.timeouts + r.summary.exceptions).toBe(
      r.totalGames,
    );
  });

  it('avgTurns / p50 / p95 / maxTurns', () => {
    const recs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((t, i) =>
      makeRecord({ index: i, turns: t, seed: `s-${i}` }),
    );
    const r = aggregate(recs, 'run-1', 'sha-1');
    expect(r.summary.avgTurns).toBeCloseTo(55, 5);
    expect(r.summary.p50Turns).toBeCloseTo(55, 1);
    expect(r.summary.p95Turns).toBeCloseTo(95.5, 1);
    expect(r.summary.maxTurns).toBe(100);
  });

  it('anomalies — timeout and exception are listed', () => {
    const recs = [
      makeRecord({ index: 0, winner: 'A', reason: 'evidence' }),
      makeRecord({ index: 1, winner: 'draw', reason: 'turn-cap', turns: 200, seed: 'smoke-1' }),
      makeRecord({
        index: 2,
        winner: 'invariant-fail',
        reason: 'invariant',
        turns: 15,
        error: 'boom',
        seed: 'smoke-2',
      }),
    ];
    const r = aggregate(recs, 'run-1', 'sha-1');
    expect(r.anomalies).toHaveLength(2);
    const timeout = r.anomalies.find(a => a.reason === 'timeout');
    const exception = r.anomalies.find(a => a.reason === 'exception');
    expect(timeout?.seed).toBe('smoke-1');
    expect(timeout?.turn).toBe(200);
    expect(exception?.seed).toBe('smoke-2');
    expect(exception?.error).toBe('boom');
  });

  it('perPairing groups by deckA/deckB', () => {
    const recs: GameRecord[] = [
      makeRecord({ index: 0, pairing: { deckA: 'CT-D08', deckB: 'CT-D08' }, winner: 'A', turns: 30 }),
      makeRecord({ index: 1, pairing: { deckA: 'CT-D08', deckB: 'CT-D08' }, winner: 'B', turns: 40 }),
      makeRecord({ index: 2, pairing: { deckA: 'CT-D08', deckB: 'CT-D11' }, winner: 'A', turns: 50 }),
      makeRecord({
        index: 3,
        pairing: { deckA: 'CT-D11', deckB: 'CT-D11' },
        winner: 'draw',
        reason: 'turn-cap',
        turns: 200,
      }),
    ];
    const r = aggregate(recs, 'run-1', 'sha-1');
    expect(r.perPairing).toHaveLength(3);
    const d08v08 = r.perPairing.find(p => p.deckA === 'CT-D08' && p.deckB === 'CT-D08');
    expect(d08v08?.games).toBe(2);
    expect(d08v08?.winsA).toBe(1);
    expect(d08v08?.winsB).toBe(1);
    const d11v11 = r.perPairing.find(p => p.deckA === 'CT-D11' && p.deckB === 'CT-D11');
    expect(d11v11?.timeouts).toBe(1);
  });

  it('matrix entries match perPairing groups', () => {
    const recs = [
      makeRecord({ pairing: { deckA: 'CT-D08', deckB: 'CT-D08' } }),
      makeRecord({ pairing: { deckA: 'CT-D08', deckB: 'CT-D08' }, index: 1 }),
      makeRecord({ pairing: { deckA: 'CT-D08', deckB: 'CT-D11' }, index: 2 }),
    ];
    const r = aggregate(recs, 'run-1', 'sha-1');
    expect(r.matrix).toHaveLength(2);
    const m1 = r.matrix.find(m => m.deckA === 'CT-D08' && m.deckB === 'CT-D08');
    expect(m1?.games).toBe(2);
  });

  it('totalDurationMs sums correctly', () => {
    const recs = [
      makeRecord({ durationMs: 100 }),
      makeRecord({ durationMs: 250, index: 1 }),
      makeRecord({ durationMs: 50, index: 2 }),
    ];
    const r = aggregate(recs, 'run-1', 'sha-1');
    expect(r.summary.totalDurationMs).toBe(400);
  });

  it('runId / engineSha / schemaVersion pass-through', () => {
    const r = aggregate([], 'my-run', 'abc1234');
    expect(r.runId).toBe('my-run');
    expect(r.engineSha).toBe('abc1234');
    expect(r.schemaVersion).toBe(1);
  });

  // Phase 9-H: per-turn ms percentile (profile=true 時のみ計算)
  describe('Phase 9-H: turnDurationsMs percentiles', () => {
    it('no profile data → avgTurnMs / p50TurnMs etc are undefined', () => {
      const recs = [makeRecord(), makeRecord({ index: 1 })];
      const r = aggregate(recs, 'r', 's');
      expect(r.summary.avgTurnMs).toBeUndefined();
      expect(r.summary.p50TurnMs).toBeUndefined();
      expect(r.summary.p95TurnMs).toBeUndefined();
      expect(r.summary.p99TurnMs).toBeUndefined();
      expect(r.summary.maxTurnMs).toBeUndefined();
    });

    it('flattens turnDurationsMs across records and computes percentiles', () => {
      const recs = [
        makeRecord({ index: 0, turns: 3, turnDurationsMs: [1, 2, 3] }),
        makeRecord({ index: 1, turns: 3, turnDurationsMs: [4, 5, 6] }),
        makeRecord({ index: 2, turns: 4, turnDurationsMs: [7, 8, 9, 10] }),
      ];
      const r = aggregate(recs, 'r', 's');
      // flatten = [1..10], 10 samples
      expect(r.summary.avgTurnMs).toBeCloseTo(5.5);
      expect(r.summary.maxTurnMs).toBe(10);
      // percentile (rank-interpolated): p50 of 10 samples = rank 4.5 → 5.5
      expect(r.summary.p50TurnMs).toBeCloseTo(5.5);
      expect(r.summary.p95TurnMs).toBeCloseTo(9.55, 1);
      expect(r.summary.p99TurnMs).toBeCloseTo(9.91, 1);
    });

    it('empty turnDurationsMs arrays are skipped (no errors)', () => {
      const recs = [
        makeRecord({ index: 0, turnDurationsMs: [] }),
        makeRecord({ index: 1, turnDurationsMs: undefined }),
      ];
      const r = aggregate(recs, 'r', 's');
      expect(r.summary.avgTurnMs).toBeUndefined();
    });

    it('mixed: some records with profile, others without', () => {
      const recs = [
        makeRecord({ index: 0, turnDurationsMs: [2, 4] }),
        makeRecord({ index: 1 }), // no profile
        makeRecord({ index: 2, turnDurationsMs: [6] }),
      ];
      const r = aggregate(recs, 'r', 's');
      expect(r.summary.avgTurnMs).toBeCloseTo(4);
      expect(r.summary.maxTurnMs).toBe(6);
    });
  });
});
