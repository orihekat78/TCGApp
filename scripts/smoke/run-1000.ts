// scripts/smoke/run-1000 — Phase 9-A 1000-game AI vs AI smoke runner
// rules: 04-game-setup.md, 05-turn-phases.md (engine 側で適用)
//
// 使い方:
//   tsx scripts/smoke/run-1000.ts                  ── 1000戦実行・レポート生成
//   tsx scripts/smoke/run-1000.ts --seed=smoke-42  ── 単一 seed 再現実行
//
// 設計:
//   - heuristic × heuristic 固定
//   - 3 deck pairing × 333〜334戦 (CT-D08 vs CT-D08 / CT-D08 vs CT-D11 / CT-D11 vs CT-D11)
//   - 各戦で Math.random を seed=`smoke-${i}` から派生する createRng で上書きし、
//     engine 内部のシャッフル (mutate.deck.shuffle / decideFirstPlayer) も再現可能化
//   - 1ゲーム上限 200 ターン (200 を超えたら runMatch が 'turn-cap' で draw を返す)
//   - runMatch 内部で try/catch 済 → invariant-fail は MatchResult.error に格納される

import { engine } from '../../src/engine/index.js';
import { registerAll } from '../../src/cards/index.js';
import { event } from '../../src/engine/event/index.js';
import { _resetActionContexts } from '../../src/engine/flow/action/state-machine.js';
import { _resetUidCounter } from '../../src/engine/mutate/scene.js';
import { _resetTargetExpanders } from '../../src/engine/flow/action/target-expander.js';
import { createEmptyGameState } from '../../src/engine/state-factory.js';
import { produce } from '../../src/engine/produce.js';
import { createRng } from '../../src/engine/rng.js';
import { HeuristicPolicy } from '../../src/ai/policies/heuristic.js';
import { runMatch } from '../../src/ai/match.js';
import type { GameState } from '../../src/engine/types/index.js';
import type { DeckPair } from '../../src/engine/flow/setup.js';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  aggregate,
  type GameRecord,
  type DeckId,
  type Pairing,
} from './aggregate.js';
import { formatMarkdown } from './format-md.js';

const D08_MAIN_IDS = [
  'D08003', 'D08005', 'D08007', 'D08009', 'D08011', 'D08013', 'D08015',
  'D08017', 'D08018', 'D08019', 'D08020', 'D08021', 'D08022', 'D08023',
];
const D11_MAIN_IDS = [
  'D11003', 'D11004', 'D11005', 'D11006', 'D11007', 'D11009', 'D11010',
  'D11011', 'D11013', 'D11014', 'D11015', 'D11016', 'D11017', 'D11018',
];

const PAIRINGS: Array<{ deckA: DeckId; deckB: DeckId; games: number }> = [
  { deckA: 'CT-D08', deckB: 'CT-D08', games: 333 },
  { deckA: 'CT-D08', deckB: 'CT-D11', games: 334 },
  { deckA: 'CT-D11', deckB: 'CT-D11', games: 333 },
];

const MAX_TURNS = 200;
const TOTAL_GAMES = PAIRINGS.reduce((s, p) => s + p.games, 0);

function buildDeck40(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) out.push(id, id, id);
  return out.slice(0, 40);
}

function buildDeckPair(deckA: DeckId, deckB: DeckId): DeckPair {
  const slot = (d: DeckId) =>
    d === 'CT-D08'
      ? { partnerId: 'D08001', caseId: 'D08026', mainCards: buildDeck40(D08_MAIN_IDS) }
      : { partnerId: 'D11001', caseId: 'D11021', mainCards: buildDeck40(D11_MAIN_IDS) };
  return { self: slot(deckA), opp: slot(deckB) };
}

function resetForRun(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
}

function resetBetweenGames(): void {
  _resetActionContexts();
  _resetTargetExpanders();
}

function setupGame(pair: DeckPair, firstSlot: 'self' | 'opp'): GameState {
  let state = createEmptyGameState();
  state = produce(state, draft => {
    engine.flow.setup.init(draft, pair);
    engine.flow.setup.decideFirstPlayer(draft, 'manual', firstSlot);
    engine.flow.setup.dealOpeningHand(draft, 'self');
    engine.flow.setup.dealOpeningHand(draft, 'opp');
    engine.flow.setup.reveal(draft);
    engine.flow.setup.startGame(draft);
    engine.flow.runAutoPhase(draft, firstSlot);
    engine.resolve.runAllUntilEmpty(draft);
  });
  return state;
}

function pickPairingForIndex(index: number): Pairing {
  let acc = 0;
  for (const p of PAIRINGS) {
    if (index < acc + p.games) return { deckA: p.deckA, deckB: p.deckB };
    acc += p.games;
  }
  return { deckA: PAIRINGS[0].deckA, deckB: PAIRINGS[0].deckB };
}

function playOneGame(
  index: number,
  seed: string,
  pairing: Pairing,
  verbose = false,
  profile = false, // Phase 9-H: true で per-turn 経過 ms を記録
): GameRecord {
  const rng = createRng(seed);
  Math.random = () => rng.next();
  resetBetweenGames();

  const firstSlot: 'self' | 'opp' = rng.next() < 0.5 ? 'self' : 'opp';
  const firstPlayer: 'A' | 'B' = firstSlot === 'self' ? 'A' : 'B';
  const pair = buildDeckPair(pairing.deckA, pairing.deckB);
  const state = setupGame(pair, firstSlot);

  const t0 = Date.now();
  const result = runMatch({
    selfPolicy: new HeuristicPolicy({ seed: `H-A-${seed}` }),
    oppPolicy: new HeuristicPolicy({ seed: `H-B-${seed}` }),
    initialState: state,
    maxTurns: MAX_TURNS,
    profile, // Phase 9-H: --profile 指定時のみ per-turn 計測
    onTurn: verbose
      ? (turnNo, byPlayer, moves) => {
          const kinds = moves.map(m => m.kind).join(', ');
          console.error(`  T${turnNo} ${byPlayer}: [${kinds}]`);
        }
      : undefined,
  });
  const durationMs = Date.now() - t0;

  const winner: GameRecord['winner'] =
    result.winner === 'self' ? 'A'
      : result.winner === 'opp' ? 'B'
        : result.winner === 'invariant-fail' ? 'invariant-fail'
          : 'draw';

  return {
    index,
    seed,
    pairing,
    firstPlayer,
    winner,
    reason: result.reason,
    turns: result.turns,
    durationMs,
    error: result.error,
    turnDurationsMs: result.turnDurationsMs, // Phase 9-H: profile=false なら undefined
  };
}

function parseArgs(): { singleSeed: string | null; verbose: boolean; profile: boolean } {
  let singleSeed: string | null = null;
  let verbose = false;
  let profile = false;
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--seed=')) singleSeed = a.slice('--seed='.length);
    else if (a === '--verbose') verbose = true;
    else if (a === '--profile') profile = true; // Phase 9-H: per-turn timing 有効化
  }
  return { singleSeed, verbose, profile };
}

function getEngineSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function findFreeReportPaths(baseName: string): { jsonPath: string; mdPath: string } {
  const reportsDir = resolve(process.cwd(), '.claude', 'reports');
  mkdirSync(reportsDir, { recursive: true });
  let suffix = 0;
  while (true) {
    const tag = suffix === 0 ? baseName : `${baseName}-${suffix + 1}`;
    const j = resolve(reportsDir, `${tag}.json`);
    const m = resolve(reportsDir, `${tag}.md`);
    if (!existsSync(j) && !existsSync(m)) return { jsonPath: j, mdPath: m };
    suffix++;
  }
}

function runSingle(singleSeed: string, verbose: boolean, profile = false): void {
  const m = singleSeed.match(/^smoke-(\d+)$/);
  if (!m) {
    console.error(`invalid --seed format: ${singleSeed} (expected smoke-N)`);
    process.exit(1);
  }
  const index = parseInt(m[1], 10);
  if (index < 0 || index >= TOTAL_GAMES) {
    console.error(`seed index out of range: ${index} (must be 0..${TOTAL_GAMES - 1})`);
    process.exit(1);
  }
  const pairing = pickPairingForIndex(index);
  const origRandom = Math.random;
  try {
    resetForRun();
    console.log(
      `Running single game: seed=${singleSeed}, index=${index}, pairing=${pairing.deckA} vs ${pairing.deckB}${verbose ? ' (verbose)' : ''}`,
    );
    const record = playOneGame(index, singleSeed, pairing, verbose, profile);
    console.log(JSON.stringify(record, null, 2));
  } finally {
    Math.random = origRandom;
  }
}

function runFull(profile = false): void {
  const engineSha = getEngineSha();
  console.log(`Running ${TOTAL_GAMES} games (heuristic × heuristic) ...`);
  console.log(`engine=${engineSha}, maxTurns=${MAX_TURNS}`);

  const origRandom = Math.random;
  const records: GameRecord[] = [];
  const overallStart = Date.now();

  try {
    resetForRun();
    for (let i = 0; i < TOTAL_GAMES; i++) {
      const seed = `smoke-${i}`;
      const pairing = pickPairingForIndex(i);
      const rec = playOneGame(i, seed, pairing, false, profile);
      records.push(rec);

      if ((i + 1) % 100 === 0) {
        const elapsed = (Date.now() - overallStart) / 1000;
        const rate = (i + 1) / elapsed;
        const eta = rate > 0 ? ((TOTAL_GAMES - i - 1) / rate).toFixed(0) : '?';
        console.log(`  ${i + 1} / ${TOTAL_GAMES} done (${elapsed.toFixed(1)}s elapsed, ETA ${eta}s)`);
      }
    }
  } finally {
    Math.random = origRandom;
  }

  const totalElapsedMs = Date.now() - overallStart;
  console.log(`\nAll games complete in ${(totalElapsedMs / 1000).toFixed(1)}s`);

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeTag = now.toISOString().slice(11, 19).replace(/:/g, '');
  const runId = `smoke-${dateStr}-${timeTag}`;
  const report = aggregate(records, runId, engineSha);
  report.summary.totalDurationMs = totalElapsedMs;

  const { jsonPath, mdPath } = findFreeReportPaths(`smoke-${dateStr}`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(mdPath, formatMarkdown(report), 'utf8');

  console.log('\nReport written:');
  console.log(`  ${jsonPath}`);
  console.log(`  ${mdPath}`);

  const s = report.summary;
  console.log(
    `\nSummary: winsA=${s.winsA}, winsB=${s.winsB}, timeouts=${s.timeouts}, exceptions=${s.exceptions}`,
  );
  console.log(`Avg turns=${s.avgTurns.toFixed(2)}, p50=${s.p50Turns.toFixed(1)}, p95=${s.p95Turns.toFixed(1)}, max=${s.maxTurns}`);
  // Phase 9-H: profile データがあれば per-turn 経過 ms を console 出力
  if (s.p50TurnMs !== undefined) {
    console.log(
      `Per-turn ms: avg=${s.avgTurnMs!.toFixed(2)}, p50=${s.p50TurnMs.toFixed(2)}, p95=${s.p95TurnMs!.toFixed(2)}, p99=${s.p99TurnMs!.toFixed(2)}, max=${s.maxTurnMs!.toFixed(2)}`,
    );
  }
  if (report.anomalies.length > 0) {
    console.log(`Anomalies: ${report.anomalies.length} — see report for details`);
  }
}

function main(): void {
  const { singleSeed, verbose, profile } = parseArgs();
  if (singleSeed !== null) {
    runSingle(singleSeed, verbose, profile);
  } else {
    runFull(profile);
  }
}

main();
