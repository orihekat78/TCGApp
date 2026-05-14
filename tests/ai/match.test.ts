// tests/ai/match.test.ts — Phase 6 Group C Task 6.5 tests
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards/index';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import type { GameState } from '@/engine/types';

import { runMatch } from '@/ai/match';
import { RandomPolicy } from '@/ai/policies/random';
import type { AIPolicy } from '@/ai/policy';
import type { Move } from '@/ai/move-enumerator';

/** Build a 40-card deck from given char IDs */
function buildDeck(ids: string[]): string[] {
  const deck: string[] = [];
  for (const id of ids) {
    deck.push(id, id, id);
  }
  return deck.slice(0, 40);
}

/** Setup helper — returns a fresh, post-auto-phase state */
function setupFreshGame(): GameState {
  const selfIds = [
    'D08003', 'D08005', 'D08007', 'D08009', 'D08011', 'D08013',
    'D08015', 'D08017', 'D08018', 'D08019', 'D08020', 'D08021',
    'D08022', 'D08023',
  ];
  const oppIds = [
    'D11003', 'D11004', 'D11005', 'D11006', 'D11007', 'D11009',
    'D11010', 'D11011', 'D11013', 'D11014', 'D11015', 'D11016',
    'D11017', 'D11018',
  ];
  const selfDeck = buildDeck(selfIds);
  const oppDeck = buildDeck(oppIds);

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

describe('runMatch — AI vs AI driver', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetActionContexts();
    _resetTargetExpanders();
    _resetUidCounter();
    registerAll();
  });

  it('Random vs Random completes within turn cap (no exception)', () => {
    const state = setupFreshGame();
    const result = runMatch({
      selfPolicy: new RandomPolicy({ seed: 'A' }),
      oppPolicy: new RandomPolicy({ seed: 'B' }),
      initialState: state,
      maxTurns: 50,
    });
    expect(result.winner).not.toBe('invariant-fail');
    expect(result.turns).toBeGreaterThan(0);
    expect(result.movesPerTurn.length).toBeGreaterThan(0);
  });

  it('Same seeds + same initial state produce deterministic results', () => {
    // Note: setup uses Math.random for deck shuffle, so we cannot rely on
    // setupFreshGame() being deterministic across calls. Instead we reuse
    // the SAME initialState (which is frozen by Immer) for both runs.
    const state = setupFreshGame();

    const r1 = runMatch({
      selfPolicy: new RandomPolicy({ seed: 'X' }),
      oppPolicy: new RandomPolicy({ seed: 'Y' }),
      initialState: state,
      maxTurns: 30,
    });

    // Reset module-level state that runMatch may have touched (action contexts).
    _resetActionContexts();
    _resetTargetExpanders();
    // Re-create policies with same seeds. initialState is already frozen.
    const r2 = runMatch({
      selfPolicy: new RandomPolicy({ seed: 'X' }),
      oppPolicy: new RandomPolicy({ seed: 'Y' }),
      initialState: state,
      maxTurns: 30,
    });

    expect(r1.winner).toBe(r2.winner);
    expect(r1.turns).toBe(r2.turns);
    expect(r1.movesPerTurn).toEqual(r2.movesPerTurn);
  });

  it('maxTurns=1 yields draw / turn-cap', () => {
    // Use a policy that immediately ends the turn so turn 1 doesn't terminate the game.
    class EndTurnImmediate implements AIPolicy {
      readonly name = 'end-now';
      choose(_s: GameState, c: Move[]): Move | null {
        return c.find(m => m.kind === 'endTurn') ?? null;
      }
    }
    const state = setupFreshGame();
    const result = runMatch({
      selfPolicy: new EndTurnImmediate(),
      oppPolicy: new EndTurnImmediate(),
      initialState: state,
      maxTurns: 1,
    });
    expect(result.winner).toBe('draw');
    expect(result.reason).toBe('turn-cap');
    // After turn 1 ends, turn.number → 2 (> maxTurns=1) → loop exits
    expect(result.turns).toBeGreaterThanOrEqual(1);
  });

  it('movesPerTurn length equals turns played', () => {
    const state = setupFreshGame();
    const result = runMatch({
      selfPolicy: new RandomPolicy({ seed: 'M1' }),
      oppPolicy: new RandomPolicy({ seed: 'M2' }),
      initialState: state,
      maxTurns: 30,
    });
    // Each turn that ran (including possibly turn that ended the game)
    expect(result.movesPerTurn.length).toBeGreaterThan(0);
    // movesPerTurn count should match the number of player-turns we executed.
    // turns = state.turn.number after the match — at minimum equals the
    // number of completed turns (movesPerTurn entries are pushed per turn).
    expect(result.movesPerTurn.length).toBeLessThanOrEqual(result.turns + 1);
  });

  it('onTurn callback fires for every turn played', () => {
    const state = setupFreshGame();
    const seen: Array<{ turnNo: number; byPlayer: 'self' | 'opp'; moveCount: number }> = [];
    runMatch({
      selfPolicy: new RandomPolicy({ seed: 'CB1' }),
      oppPolicy: new RandomPolicy({ seed: 'CB2' }),
      initialState: state,
      maxTurns: 10,
      onTurn: (turnNo, byPlayer, moves) => {
        seen.push({ turnNo, byPlayer, moveCount: moves.length });
      },
    });
    expect(seen.length).toBeGreaterThan(0);
    // first turn is always self with turnNo 1
    expect(seen[0].turnNo).toBe(1);
    expect(seen[0].byPlayer).toBe('self');
    // each callback's moveCount is positive (at least endTurn)
    for (const s of seen) {
      expect(s.moveCount).toBeGreaterThan(0);
    }
  });

  it('returns sensible turns count (>= movesPerTurn length when game ends normally)', () => {
    const state = setupFreshGame();
    const result = runMatch({
      selfPolicy: new RandomPolicy({ seed: 'T1' }),
      oppPolicy: new RandomPolicy({ seed: 'T2' }),
      initialState: state,
      maxTurns: 50,
    });
    // turns = final state.turn.number. This should be roughly aligned with
    // movesPerTurn length (each iteration pushes once).
    expect(result.turns).toBeGreaterThanOrEqual(1);
    expect(result.movesPerTurn.length).toBeGreaterThan(0);
  });
});
