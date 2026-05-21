// scripts/benchmark/mcts-vs-heuristic — Phase 9-F: MCTS vs Heuristic 100 戦比較
// spec: .claude/specs/phase-9-f-mcts.md §検証
//
// 目的: MCTS rollout-based policy が HeuristicPolicy に有意に勝つかを 100 戦 sample で測定
// setup ロジックは scripts/smoke/run-1000.ts と同一 (CT-D08 vs CT-D11 deck pair)

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
import { MCTSPolicy } from '../../src/ai/policies/mcts.js';
import { runMatch } from '../../src/ai/match.js';
import type { GameState } from '../../src/engine/types/index.js';
import type { DeckPair } from '../../src/engine/flow/setup.js';

const D08_MAIN_IDS = [
  'D08002', 'D08003', 'D08004', 'D08005', 'D08006', 'D08007',
  'D08008', 'D08009', 'D08010', 'D08011', 'D08012', 'D08013',
  'D08014', 'D08015',
];
const D11_MAIN_IDS = [
  'D11002', 'D11003', 'D11004', 'D11005', 'D11006', 'D11007',
  'D11008', 'D11009', 'D11010', 'D11011', 'D11012', 'D11013',
  'D11014', 'D11015',
];

function buildDeck40(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < 40; i++) out.push(ids[i % ids.length]);
  return out.slice(0, 40);
}

function buildDeckPair(): DeckPair {
  return {
    self: { partnerId: 'D11001', caseId: 'D11021', mainCards: buildDeck40(D11_MAIN_IDS) },
    opp: { partnerId: 'D08001', caseId: 'D08026', mainCards: buildDeck40(D08_MAIN_IDS) },
  };
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
  state = produce(state, (draft) => {
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

const TOTAL = 100;
const MAX_TURNS = 200;

console.log(`MCTS vs Heuristic — ${TOTAL} games (MCTS=self, Heuristic=opp)`);
const origRandom = Math.random;
let mctsWins = 0;
let heuristicWins = 0;
let draws = 0;
let exceptions = 0;
const t0 = Date.now();

try {
  resetForRun();
  for (let i = 0; i < TOTAL; i++) {
    const seed = `mcts-vs-heur-${i}`;
    const rng = createRng(seed);
    Math.random = () => rng.next();
    resetBetweenGames();

    const firstSlot: 'self' | 'opp' = rng.next() < 0.5 ? 'self' : 'opp';
    const pair = buildDeckPair();
    const initial = setupGame(pair, firstSlot);

    const result = runMatch({
      selfPolicy: new MCTSPolicy({ seed: `M-${seed}`, rollouts: 5, rolloutMaxTurns: 30 }),
      oppPolicy: new HeuristicPolicy({ seed: `H-${seed}` }),
      initialState: initial,
      maxTurns: MAX_TURNS,
    });
    if (result.winner === 'self') mctsWins++;
    else if (result.winner === 'opp') heuristicWins++;
    else if (result.winner === 'invariant-fail') exceptions++;
    else draws++;

    if ((i + 1) % 10 === 0) {
      const elapsed = (Date.now() - t0) / 1000;
      console.log(`  ${i + 1}/${TOTAL} done (${elapsed.toFixed(1)}s elapsed)`);
    }
  }
} finally {
  Math.random = origRandom;
}

const totalSec = (Date.now() - t0) / 1000;
console.log(`\nResult after ${totalSec.toFixed(1)}s:`);
console.log(`  MCTS (self) wins:      ${mctsWins} (${(mctsWins / TOTAL * 100).toFixed(1)}%)`);
console.log(`  Heuristic (opp) wins:  ${heuristicWins} (${(heuristicWins / TOTAL * 100).toFixed(1)}%)`);
console.log(`  Draws / timeouts:      ${draws}`);
console.log(`  Exceptions:            ${exceptions}`);
