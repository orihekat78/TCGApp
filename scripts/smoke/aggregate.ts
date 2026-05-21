// scripts/smoke/aggregate — Phase 9-A smoke aggregation (pure)
// spec: .claude/plans/.../Phase 9-A
// pure functions; engine 非依存。runMatch の MatchResult を平坦化した
// GameRecord 配列を受け取り、AggregateReport を返す。

export type DeckId = 'CT-D08' | 'CT-D11';

export type Pairing = {
  deckA: DeckId;
  deckB: DeckId;
};

export type GameRecord = {
  index: number;
  seed: string;
  pairing: Pairing;
  /** Who went first ('A' = deckA player, 'B' = deckB player). */
  firstPlayer: 'A' | 'B';
  /** Winner mapped from runMatch's 'self' | 'opp' onto A/B. */
  winner: 'A' | 'B' | 'draw' | 'invariant-fail';
  reason: 'evidence' | 'deck-out' | 'turn-cap' | 'invariant';
  turns: number;
  durationMs: number;
  error?: string;
  /** Phase 9-H: profile=true で smoke 実行時の per-turn 経過 ms (playTurn のみ) */
  turnDurationsMs?: number[];
};

export type Summary = {
  totalGames: number;
  winsA: number;
  winsB: number;
  /** winner==='draw' && reason==='turn-cap' */
  timeouts: number;
  /** winner==='invariant-fail' */
  exceptions: number;
  avgTurns: number;
  p50Turns: number;
  p95Turns: number;
  maxTurns: number;
  totalDurationMs: number;
  /**
   * Phase 9-H: per-turn 経過 ms percentile (全 records の turnDurationsMs を flat 集約)。
   * profile データが 1 件も無い場合は undefined (display 側で section ごと省略)。
   */
  avgTurnMs?: number;
  p50TurnMs?: number;
  p95TurnMs?: number;
  p99TurnMs?: number;
  maxTurnMs?: number;
};

export type PerPairing = {
  deckA: DeckId;
  deckB: DeckId;
  games: number;
  winsA: number;
  winsB: number;
  timeouts: number;
  exceptions: number;
  avgTurns: number;
};

export type Anomaly = {
  seed: string;
  pairing: Pairing;
  reason: 'timeout' | 'exception';
  turn: number;
  error?: string;
};

export type AggregateReport = {
  schemaVersion: 1;
  runId: string;
  engineSha: string;
  totalGames: number;
  matrix: Array<{ deckA: DeckId; deckB: DeckId; games: number }>;
  summary: Summary;
  perPairing: PerPairing[];
  anomalies: Anomaly[];
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

function pairingKey(p: Pairing): string {
  return `${p.deckA}__${p.deckB}`;
}

export function aggregate(
  records: GameRecord[],
  runId: string,
  engineSha: string,
): AggregateReport {
  const sortedTurns = records.map(r => r.turns).sort((a, b) => a - b);
  const totalGames = records.length;

  const summary: Summary = {
    totalGames,
    winsA: records.filter(r => r.winner === 'A').length,
    winsB: records.filter(r => r.winner === 'B').length,
    timeouts: records.filter(r => r.winner === 'draw' && r.reason === 'turn-cap').length,
    exceptions: records.filter(r => r.winner === 'invariant-fail').length,
    avgTurns: totalGames === 0 ? 0 : records.reduce((s, r) => s + r.turns, 0) / totalGames,
    p50Turns: percentile(sortedTurns, 50),
    p95Turns: percentile(sortedTurns, 95),
    maxTurns: sortedTurns.length === 0 ? 0 : sortedTurns[sortedTurns.length - 1],
    totalDurationMs: records.reduce((s, r) => s + r.durationMs, 0),
  };

  // Phase 9-H: per-turn 経過 ms の percentile (profile データがあるときのみ)
  const allTurnMs: number[] = [];
  for (const r of records) {
    if (r.turnDurationsMs && r.turnDurationsMs.length > 0) {
      for (const ms of r.turnDurationsMs) allTurnMs.push(ms);
    }
  }
  if (allTurnMs.length > 0) {
    const sortedTurnMs = allTurnMs.slice().sort((a, b) => a - b);
    summary.avgTurnMs = allTurnMs.reduce((s, x) => s + x, 0) / allTurnMs.length;
    summary.p50TurnMs = percentile(sortedTurnMs, 50);
    summary.p95TurnMs = percentile(sortedTurnMs, 95);
    summary.p99TurnMs = percentile(sortedTurnMs, 99);
    summary.maxTurnMs = sortedTurnMs[sortedTurnMs.length - 1];
  }

  const groups = new Map<string, GameRecord[]>();
  for (const r of records) {
    const key = pairingKey(r.pairing);
    const arr = groups.get(key);
    if (arr) arr.push(r);
    else groups.set(key, [r]);
  }

  const perPairing: PerPairing[] = [];
  const matrix: Array<{ deckA: DeckId; deckB: DeckId; games: number }> = [];
  for (const [, group] of groups) {
    const first = group[0];
    const winsA = group.filter(r => r.winner === 'A').length;
    const winsB = group.filter(r => r.winner === 'B').length;
    const timeouts = group.filter(r => r.winner === 'draw' && r.reason === 'turn-cap').length;
    const exceptions = group.filter(r => r.winner === 'invariant-fail').length;
    const avgTurns = group.reduce((s, r) => s + r.turns, 0) / group.length;
    perPairing.push({
      deckA: first.pairing.deckA,
      deckB: first.pairing.deckB,
      games: group.length,
      winsA,
      winsB,
      timeouts,
      exceptions,
      avgTurns,
    });
    matrix.push({ deckA: first.pairing.deckA, deckB: first.pairing.deckB, games: group.length });
  }

  const anomalies: Anomaly[] = [];
  for (const r of records) {
    if (r.winner === 'draw' && r.reason === 'turn-cap') {
      anomalies.push({ seed: r.seed, pairing: r.pairing, reason: 'timeout', turn: r.turns });
    } else if (r.winner === 'invariant-fail') {
      anomalies.push({
        seed: r.seed,
        pairing: r.pairing,
        reason: 'exception',
        turn: r.turns,
        error: r.error,
      });
    }
  }

  return {
    schemaVersion: 1,
    runId,
    engineSha,
    totalGames,
    matrix,
    summary,
    perPairing,
    anomalies,
  };
}
