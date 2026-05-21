// ai.replay — Phase 9-G.1 unit tests (recorder + player)
// spec: .claude/specs/phase-9-g-replay.md

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { createRng } from '@/engine/rng';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { GameState } from '@/engine/types';
import type { DeckPair } from '@/engine/flow/setup';
import { recordMatch, replayLog, ScriptedPolicy } from '@/ai/replay';
import type { Move } from '@/ai/move-enumerator';

const D08_IDS = [
  'D08002', 'D08003', 'D08004', 'D08005', 'D08006', 'D08007',
  'D08008', 'D08009', 'D08010', 'D08011', 'D08012', 'D08013',
  'D08014', 'D08015',
];
const D11_IDS = [
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
    self: { partnerId: 'D11001', caseId: 'D11021', mainCards: buildDeck40(D11_IDS) },
    opp: { partnerId: 'D08001', caseId: 'D08026', mainCards: buildDeck40(D08_IDS) },
  };
}

function setupGame(seed: string): GameState {
  const rng = createRng(seed);
  Math.random = () => rng.next();
  const firstSlot: 'self' | 'opp' = rng.next() < 0.5 ? 'self' : 'opp';
  const pair = buildDeckPair();
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

function resetForRun(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
}

describe('ScriptedPolicy', () => {
  it('returns moves from queue in order', () => {
    const queue: Move[] = [{ kind: 'endTurn' }, { kind: 'endTurn' }];
    const p = new ScriptedPolicy('test', queue);
    expect(p.remaining()).toBe(2);
    const m1 = p.choose({} as GameState, [{ kind: 'endTurn' }], 'self');
    expect(m1?.kind).toBe('endTurn');
    expect(p.remaining()).toBe(1);
  });

  it('returns endTurn when queue exhausted', () => {
    const p = new ScriptedPolicy('test', []);
    const m = p.choose({} as GameState, [{ kind: 'endTurn' }], 'self');
    expect(m?.kind).toBe('endTurn');
  });

  it('returns first candidate fallback when queue empty and no endTurn', () => {
    const p = new ScriptedPolicy('test', []);
    const fallback: Move = { kind: 'partnerAbility', abilityId: 'a1' } as Move;
    const m = p.choose({} as GameState, [fallback], 'self');
    expect(m).toBe(fallback);
  });
});

describe('recordMatch + replayLog', () => {
  let originalRandom: typeof Math.random;

  beforeEach(() => {
    originalRandom = Math.random;
    resetForRun();
  });

  it('record produces a non-empty ReplayLog', () => {
    const seed = 'replay-test-1';
    const initial = setupGame(seed);
    const { result, log } = recordMatch({
      selfPolicy: new HeuristicPolicy({ seed: `A-${seed}` }),
      oppPolicy: new HeuristicPolicy({ seed: `B-${seed}` }),
      initialState: initial,
      maxTurns: 50,
    });
    expect(log.schemaVersion).toBe(1);
    expect(log.moves.length).toBeGreaterThan(0);
    expect(log.result.winner).toBe(result.winner);
    expect(log.result.reason).toBe(result.reason);
    expect(log.result.turns).toBe(result.turns);
    Math.random = originalRandom;
  });

  it('replay reproduces same result (winner / reason / turns)', () => {
    const seed = 'replay-test-2';
    // 1st run: record
    resetForRun();
    const initial = setupGame(seed);
    const { result, log } = recordMatch({
      selfPolicy: new HeuristicPolicy({ seed: `A-${seed}` }),
      oppPolicy: new HeuristicPolicy({ seed: `B-${seed}` }),
      initialState: initial,
      maxTurns: 50,
    });
    // 2nd run: replay (same seed for Math.random)
    resetForRun();
    Math.random = () => createRng(seed).next();
    const replayResult = replayLog(log);
    expect(replayResult.winner).toBe(result.winner);
    expect(replayResult.reason).toBe(result.reason);
    expect(replayResult.turns).toBe(result.turns);
    Math.random = originalRandom;
  });

  it('records moves grouped by turn and player', () => {
    const seed = 'replay-test-3';
    const initial = setupGame(seed);
    const { log } = recordMatch({
      selfPolicy: new HeuristicPolicy({ seed: `A-${seed}` }),
      oppPolicy: new HeuristicPolicy({ seed: `B-${seed}` }),
      initialState: initial,
      maxTurns: 20,
    });
    Math.random = originalRandom;
    // 各 move には turn / player が紐づき、turn 番号は単調増加
    let prevTurn = 0;
    for (const m of log.moves) {
      expect(m.turn).toBeGreaterThanOrEqual(prevTurn);
      prevTurn = m.turn;
      expect(['self', 'opp']).toContain(m.player);
    }
  });
});
