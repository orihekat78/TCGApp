// tests/integration/ai-vs-ai-smoke — Phase 6 Group C Task 6.6
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md
// rules: 04-game-setup.md, 05-turn-phases.md, 01-victory-conditions.md
//
// 目的:
//   - registerAll + AI vs AI を 100 戦回し、エンジン / カード / Hook wiring に起因する
//     例外 / invariant 違反が 0 件であることを保証する (smoke test)
//   - Random vs Heuristic の比較も付随的に実行 (smoke; 強い検定なし)

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards/index';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { RandomPolicy } from '@/ai/policies/random';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { runMatch, type MatchResult } from '@/ai/match';
import type { GameState } from '@/engine/types';

/** Build a 40-card deck from given char IDs */
function buildDeck(ids: string[]): string[] {
  const deck: string[] = [];
  for (const id of ids) {
    deck.push(id, id, id);
  }
  return deck.slice(0, 40);
}

const SELF_DECK_IDS = [
  'D08003', 'D08005', 'D08007', 'D08009', 'D08011', 'D08013',
  'D08015', 'D08017', 'D08018', 'D08019', 'D08020', 'D08021',
  'D08022', 'D08023',
];
const OPP_DECK_IDS = [
  'D11003', 'D11004', 'D11005', 'D11006', 'D11007', 'D11009',
  'D11010', 'D11011', 'D11013', 'D11014', 'D11015', 'D11016',
  'D11017', 'D11018',
];

function setupFreshGame(): GameState {
  const selfDeck = buildDeck(SELF_DECK_IDS);
  const oppDeck = buildDeck(OPP_DECK_IDS);

  let state = createEmptyGameState();
  state = produce(state, draft => {
    engine.flow.setup.init(draft, {
      self: { partnerId: 'D08001', caseId: 'D08026', mainCards: selfDeck },
      opp: { partnerId: 'D11001', caseId: 'D11021', mainCards: oppDeck },
    });
    engine.flow.setup.decideFirstPlayer(draft, 'manual', 'self');
    engine.flow.setup.dealOpeningHand(draft, 'self');
    engine.flow.setup.dealOpeningHand(draft, 'opp');
    engine.flow.setup.reveal(draft);
    engine.flow.setup.startGame(draft);
    engine.flow.runAutoPhase(draft, 'self');
    engine.resolve.runAllUntilEmpty(draft);
  });
  return state;
}

describe('AI vs AI 100戦 smoke', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetActionContexts();
    _resetTargetExpanders();
    _resetUidCounter();
    registerAll();
  });

  it('100 matches Random vs Random — no exceptions, no invariant fails', () => {
    const results: MatchResult[] = [];
    const errors: Array<{ idx: number; turns: number; error: string }> = [];

    for (let i = 0; i < 100; i++) {
      const state = setupFreshGame();
      const result = runMatch({
        selfPolicy: new RandomPolicy({ seed: `A-${i}` }),
        oppPolicy: new RandomPolicy({ seed: `B-${i}` }),
        initialState: state,
        maxTurns: 50,
      });
      results.push(result);
      if (result.winner === 'invariant-fail') {
        errors.push({ idx: i, turns: result.turns, error: result.error ?? '<no msg>' });
      }
      // Reset module-level state to avoid leakage across matches
      _resetActionContexts();
      _resetTargetExpanders();
    }

    // Aggregate
    const winnersSelf = results.filter(r => r.winner === 'self').length;
    const winnersOpp = results.filter(r => r.winner === 'opp').length;
    const draws = results.filter(r => r.winner === 'draw').length;
    const failures = results.filter(r => r.winner === 'invariant-fail').length;
    const avgTurns = results.reduce((s, r) => s + r.turns, 0) / results.length;
    const deckOuts = results.filter(r => r.reason === 'deck-out').length;
    const turnCaps = results.filter(r => r.reason === 'turn-cap').length;
    const wins = results.filter(r => r.reason === 'evidence').length;


    console.log(`\n=== 100戦 smoke 結果 ===`);

    console.log(`Winners: self=${winnersSelf}, opp=${winnersOpp}, draws=${draws}, failures=${failures}`);

    console.log(`Avg turns: ${avgTurns.toFixed(1)}`);

    console.log(`Reason: evidence=${wins}, deck-out=${deckOuts}, turn-cap=${turnCaps}`);
    if (errors.length > 0) {

      console.log(`Failures (${errors.length}):`);
      for (const e of errors.slice(0, 5)) {

        console.log(`  match #${e.idx} turn=${e.turns}: ${e.error}`);
      }
    }

    expect(failures).toBe(0);
    expect(results.length).toBe(100);
    expect(avgTurns).toBeGreaterThan(0);
    expect(avgTurns).toBeLessThan(50);
  }, 120000);

  it('Random vs Heuristic — both run without exceptions (20 matches)', () => {
    let heuristicWins = 0;
    let randomWins = 0;
    let draws = 0;
    let failures = 0;
    const errors: Array<{ idx: number; error: string }> = [];

    for (let i = 0; i < 20; i++) {
      const state = setupFreshGame();
      const result = runMatch({
        selfPolicy: new HeuristicPolicy({ seed: `H-${i}` }),
        oppPolicy: new RandomPolicy({ seed: `R-${i}` }),
        initialState: state,
        maxTurns: 50,
      });

      if (result.winner === 'self') heuristicWins++;
      else if (result.winner === 'opp') randomWins++;
      else if (result.winner === 'draw') draws++;
      else if (result.winner === 'invariant-fail') {
        failures++;
        errors.push({ idx: i, error: result.error ?? '<no msg>' });
      }

      _resetActionContexts();
      _resetTargetExpanders();
    }


    console.log(`\n=== Random vs Heuristic (20戦) ===`);

    console.log(`Heuristic wins: ${heuristicWins} / Random wins: ${randomWins} / draws: ${draws} / failures: ${failures}`);
    if (errors.length > 0) {
      for (const e of errors.slice(0, 5)) {

        console.log(`  match #${e.idx}: ${e.error}`);
      }
    }

    expect(failures).toBe(0);
    expect(heuristicWins + randomWins + draws).toBe(20);
  }, 60000);
});
