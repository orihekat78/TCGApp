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
import { runMatch } from '@/ai/match';
import {
  captureNondeterminism,
  recordMatch,
  replayLog,
  replayNondeterminism,
  ScriptedPolicy,
} from '@/ai/replay';
import type { ReplayLogV1 } from '@/ai/replay';
import type { Move } from '@/ai/move-enumerator';
import { enumerateMoves } from '@/ai/move-enumerator';
import { applyMove, type AIPolicy } from '@/ai/policy';
import { computeStateAt } from '@/ui/hooks/useReplayDriver';
import {
  _peekPendingEffectOptionalSide,
  pushPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import {
  resetPendingRuntimeState,
  restorePendingRuntimeState,
  snapshotPendingRuntimeState,
} from '@/engine/effect/runtime-state';

const D08_IDS = [
  'D08003', 'D08005', 'D08007', 'D08009', 'D08011', 'D08013',
  'D08015', 'D08017', 'D08019', 'D08021', 'D08022', 'D08023',
  'D08024', 'D08025',
];
const D11_IDS = [
  'D11003', 'D11005', 'D11007', 'D11009', 'D11011', 'D11012',
  'D11013', 'D11014', 'D11015', 'D11016', 'D11017', 'D11018',
  'D11019', 'D11020',
];

function expectOfficialIdLimit(deck: readonly string[]): void {
  const counts = new Map<string, number>();
  for (const id of deck) {
    const card = engine.read.def.card(id);
    const slash = card?.no.indexOf('/') ?? -1;
    const officialId = card && slash > 0 ? card.no.slice(0, slash) : id;
    counts.set(officialId, (counts.get(officialId) ?? 0) + 1);
  }
  expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
}

function buildDeck40(ids: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; out.length < 40; i++) out.push(ids[i % ids.length]);
  const result = out.slice(0, 40);
  expectOfficialIdLimit(result);
  return result;
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
  it('adapts a legacy B04048 move without a name to a legal nonmatching declaration', () => {
    resetForRun();
    const state = produce(createEmptyGameState(), draft => {
      draft.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      engine.mutate.scene.enter(draft, 'self', 'B04048', { active: true });
      draft.players.self.deck = ['D11003', 'D11005', 'D11007'];
      draft.players.opp.deck = ['D08003', 'D08005'];
    });
    const current = enumerateMoves(state, 'self').find((move): move is Extract<Move, { kind: 'declaredAbility' }> => (
      move.kind === 'declaredAbility' && move.abilityId === 'a2'
    ));
    expect(current?.declaredName).toBeTruthy();
    const { declaredName: _legacyMissing, ...recorded } = current!;
    const chosen = new ScriptedPolicy('legacy-B04048', [recorded]).choose(state, [current!], 'self');
    expect(chosen).toMatchObject({ kind: 'declaredAbility', uid: current!.uid, abilityId: 'a2' });
    expect(chosen?.kind === 'declaredAbility' ? chosen.declaredName : undefined).toBeUndefined();
  });

  it.each([
    {
      label: 'granted occurrence',
      sourceCardId: 'B04048',
      candidate: {
        kind: 'declaredAbility', uid: 'legacy-host', abilityId: 'a2',
        abilityOrigin: 'granted', abilityIndex: 0, declaredName: '毛利小五郎',
      } as Move,
    },
    {
      label: 'set-card occurrence',
      sourceCardId: 'B04048',
      candidate: {
        kind: 'declaredAbility', uid: 'legacy-host', abilityId: 'a2',
        setCardId: 'B07014', setCardInstanceId: 'set:legacy', declaredName: '毛利小五郎',
      } as Move,
    },
    {
      label: 'different host card',
      sourceCardId: 'D11003',
      candidate: {
        kind: 'declaredAbility', uid: 'legacy-host', abilityId: 'a2',
        abilityOrigin: 'printed', abilityIndex: 1, declaredName: '毛利小五郎',
      } as Move,
    },
  ])('does not adapt a name-missing legacy move to $label', ({ sourceCardId, candidate }) => {
    resetForRun();
    const state = produce(createEmptyGameState(), draft => {
      draft.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      const source = engine.mutate.scene.enter(draft, 'self', sourceCardId, { active: true });
      source.uid = 'legacy-host';
      draft.players.self.deck = ['D11003', 'D11005'];
    });
    const recorded: Move = { kind: 'declaredAbility', uid: 'legacy-host', abilityId: 'a2' };

    expect(() => new ScriptedPolicy('legacy-reject', [recorded]).choose(state, [candidate], 'self'))
      .toThrow('recorded replay move is not legal');
  });

  it('returns moves from queue in order', () => {
    const queue: Move[] = [{ kind: 'endTurn' }, { kind: 'endTurn' }];
    const p = new ScriptedPolicy('test', queue);
    expect(p.remaining()).toBe(2);
    const m1 = p.choose({} as GameState, [{ kind: 'endTurn' }], 'self');
    expect(m1?.kind).toBe('endTurn');
    expect(p.remaining()).toBe(1);
  });

  it('rejects replay when the recorded queue is exhausted', () => {
    const p = new ScriptedPolicy('test', []);
    expect(() => p.choose({} as GameState, [{ kind: 'endTurn' }], 'self'))
      .toThrow('replay move queue exhausted');
  });

  it('rejects a recorded move that is not currently legal', () => {
    const p = new ScriptedPolicy('test', [{ kind: 'endTurn' }]);
    const legal: Move = { kind: 'partnerAbility', abilityId: 'a1' } as Move;
    expect(() => p.choose({} as GameState, [legal], 'self'))
      .toThrow('recorded replay move is not legal');
  });

  it('maps a witness-free legacy declared move to the earliest exact host occurrence', () => {
    const recorded = {
      kind: 'declaredAbility', uid: 'host', abilityId: 'a1',
    } as const;
    const candidates: Move[] = [
      {
        ...recorded,
        abilityOrigin: 'printed',
        abilityIndex: 0,
      },
      {
        ...recorded,
        abilityOrigin: 'granted',
        abilityIndex: 0,
      },
    ];
    const p = new ScriptedPolicy('legacy-declared-host', [recorded]);

    expect(p.choose({} as GameState, candidates, 'self')).toEqual(candidates[0]);
  });

  it('maps a witness-free legacy move to a granted host occurrence but never a set-card rider', () => {
    const recorded = {
      kind: 'declaredAbility', uid: 'host', abilityId: 'a1',
    } as const;
    const granted: Move = {
      ...recorded,
      abilityOrigin: 'granted',
      abilityIndex: 2,
    };
    const rider: Move = {
      ...recorded,
      setCardId: 'SET-CARD',
      setCardInstanceId: 'set:legacy:1',
    };

    expect(new ScriptedPolicy('legacy-declared-granted', [recorded])
      .choose({} as GameState, [granted], 'self')).toEqual(granted);
    expect(() => new ScriptedPolicy('legacy-declared-rider', [recorded])
      .choose({} as GameState, [rider], 'self'))
      .toThrow('recorded replay move is not legal');
  });
});

describe('replay nondeterminism boundary', () => {
  it('restores ambient functions when capture throws', () => {
    const originalRandom = Math.random;
    const originalNow = Date.now;
    expect(() => captureNondeterminism(() => {
      Math.random();
      Date.now();
      throw new Error('capture failure');
    })).toThrow('capture failure');
    expect(Math.random).toBe(originalRandom);
    expect(Date.now).toBe(originalNow);
  });

  it('fails closed on truncated or unused traces and restores globals', () => {
    const originalRandom = Math.random;
    const originalNow = Date.now;
    expect(() => replayNondeterminism(
      { random: [], now: [] },
      () => Math.random(),
    )).toThrow('replay random trace exhausted at read 1');
    expect(() => replayNondeterminism(
      { random: [0.25], now: [] },
      () => undefined,
    )).toThrow('replay random trace has 1 unused values');
    expect(Math.random).toBe(originalRandom);
    expect(Date.now).toBe(originalNow);
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
    expect(log.schemaVersion).toBe(2);
    expect(Array.isArray(log.nondeterminism.random)).toBe(true);
    expect(log.nondeterminism.now.length).toBeGreaterThan(0);
    expect(log.moves.length).toBeGreaterThan(0);
    expect(log.result.winner).toBe(result.winner);
    expect(log.result.reason).toBe(result.reason);
    expect(log.result.turns).toBe(result.turns);
    Math.random = originalRandom;
  });

  it.each([1, 2] as const)('replays a V%s B04048 move recorded before declaredName entered Move', schemaVersion => {
    const seed = `legacy-B04048-v${schemaVersion}`;
    const initial = produce(setupGame(seed), draft => {
      const owner = draft.turn.player;
      draft.turn.phase = 'main';
      draft.turn.isFirstPlayerFirstTurn = false;
      engine.mutate.scene.enter(draft, owner, 'B04048', { active: true });
    });
    expect(enumerateMoves(initial, initial.turn.player).some(move => (
      move.kind === 'declaredAbility' && move.abilityId === 'a2'
    ))).toBe(true);
    const prioritizingPolicy = (): AIPolicy => {
      let declared = false;
      return {
        choose: (_state, candidates) => {
          if (!declared) {
            const move = candidates.find(candidate => (
              candidate.kind === 'declaredAbility' && candidate.abilityId === 'a2'
            ));
            if (move) {
              declared = true;
              return move;
            }
          }
          return candidates.find(candidate => candidate.kind === 'endTurn') ?? candidates[0] ?? null;
        },
      };
    };
    const { result, log } = recordMatch({
      selfPolicy: prioritizingPolicy(),
      oppPolicy: prioritizingPolicy(),
      initialState: initial,
      maxTurns: 1,
    });
    const legacyV2 = structuredClone(log);
    const recorded = legacyV2.moves.find(entry => entry.move.kind === 'declaredAbility');
    expect(recorded?.move).toMatchObject({ kind: 'declaredAbility', declaredName: expect.any(String) });
    if (recorded?.move.kind !== 'declaredAbility') throw new Error('missing recorded B04048 declaration');
    delete recorded.move.declaredName;
    const legacyV1 = {
      schemaVersion: 1 as const,
      initialState: legacyV2.initialState,
      moves: legacyV2.moves,
      result: legacyV2.result,
    } satisfies ReplayLogV1;
    const legacy = schemaVersion === 1
      ? legacyV1
      : (() => {
          resetForRun();
          const captured = captureNondeterminism(() => replayLog(legacyV1));
          return { ...legacyV1, schemaVersion: 2 as const, nondeterminism: captured.trace };
        })();

    resetForRun();
    const oldDefinition = structuredClone(engine.read.def.card('B04048')!);
    const oldAbility = oldDefinition.abilities.find(ability => ability.id === 'a2');
    const oldDeclare = oldAbility?.effect?.kind === 'sequence' ? oldAbility.effect.steps[0] : undefined;
    if (oldDeclare?.kind !== 'atom' || oldDeclare.verb !== 'declareName') {
      throw new Error('missing legacy B04048 declaration descriptor');
    }
    delete (oldDeclare.args as { domain?: string }).domain;
    engine.cards.register(oldDefinition);
    const baseline = produce(legacyV1.initialState, draft => {
      applyMove(draft, recorded.move, recorded.player);
      engine.resolve.runAllUntilEmpty(draft);
    });

    resetForRun();
    const replayed = replayLog(legacy);
    expect(replayed).toMatchObject({
      winner: result.winner,
      reason: result.reason,
      turns: result.turns,
    });
    resetForRun();
    const declaredPrefix = legacy.moves.findIndex(entry => entry.move.kind === 'declaredAbility') + 1;
    const replayState = computeStateAt(legacy, declaredPrefix);
    const replayActions = replayState.log.map(entry => entry.action);
    const declaredEntry = replayState.pendingEffects.find(entry => (
      (entry.source.cardId === 'B04048' || entry.source.cardId === 'B04048P')
      && entry.source.abilityId === 'a2'
    ));
    expect(declaredEntry?.state).toBe('resolved');
    expect(replayState.players[recorded.player].hand).toEqual(baseline.players[recorded.player].hand);
    expect(replayState.players[recorded.player].deck).toEqual(baseline.players[recorded.player].deck);
    expect(replayActions).not.toContain('causal.declare');
    expect(replayActions).not.toContain('effect:declareName');
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
    // 2nd run: replay must consume its own captured random/clock trace.
    resetForRun();
    Math.random = () => {
      throw new Error('ambient Math.random must not be used during replay');
    };
    const replayResult = replayLog(log);
    expect(replayResult.winner).toBe(result.winner);
    expect(replayResult.reason).toBe(result.reason);
    expect(replayResult.turns).toBe(result.turns);
    Math.random = originalRandom;
  });

  it('replay and prefix playback ignore ambient human-player identity', () => {
    const root = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
    const hadHumanSide = Object.prototype.hasOwnProperty.call(root, '__humanPlayerSide');
    const previousHumanSide = root.__humanPlayerSide;
    try {
      const seed = 'ambient-human-0';
      root.__humanPlayerSide = null;
      const { result, log } = recordMatch({
        selfPolicy: new HeuristicPolicy({ seed: `A-${seed}` }),
        oppPolicy: new HeuristicPolicy({ seed: `B-${seed}` }),
        initialState: setupGame(seed),
        maxTurns: 50,
      });
      const prefix = Math.max(0, log.moves.length - 1);

      resetForRun();
      root.__humanPlayerSide = null;
      const expectedPrefix = computeStateAt(log, prefix);

      resetForRun();
      root.__humanPlayerSide = 'self';
      expect(replayLog(log)).toMatchObject({
        winner: result.winner,
        reason: result.reason,
        turns: result.turns,
      });
      expect(computeStateAt(log, prefix)).toEqual(expectedPrefix);
      expect(root.__humanPlayerSide).toBe('self');
    } finally {
      Math.random = originalRandom;
      if (hadHumanSide) root.__humanPlayerSide = previousHumanSide;
      else delete root.__humanPlayerSide;
    }
  });

  it('prefix playback ignores and restores ambient pending resolver runtime', () => {
    const policy: AIPolicy = {
      choose(_state, candidates) {
        return candidates.find((move) => move.kind === 'endTurn') ?? null;
      },
    };
    const { log } = recordMatch({
      selfPolicy: policy,
      oppPolicy: policy,
      initialState: setupGame('replay-prefix-runtime-isolation'),
      maxTurns: 2,
    });
    expect(log.moves[0]?.move.kind).toBe('endTurn');

    const callerRuntime = snapshotPendingRuntimeState();
    try {
      resetPendingRuntimeState();
      const expected = computeStateAt(log, 1);
      pushPendingEffectOptionalSide({
        player: 'self',
        source: { cardId: 'AMBIENT', abilityId: 'ambient', uid: 'AMBIENT#1' },
      });

      expect(computeStateAt(log, 1)).toEqual(expected);
      expect(_peekPendingEffectOptionalSide()?.source.abilityId).toBe('ambient');
    } finally {
      restorePendingRuntimeState(callerRuntime);
      Math.random = originalRandom;
    }
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

  it('does not mix observer callback randomness into the engine replay trace', () => {
    const seed = 'replay-test-observer';
    const initial = setupGame(seed);
    let observerCalls = 0;
    const { result, log } = recordMatch({
      selfPolicy: new HeuristicPolicy({ seed: `A-${seed}` }),
      oppPolicy: new HeuristicPolicy({ seed: `B-${seed}` }),
      initialState: initial,
      maxTurns: 20,
      onTurn: () => {
        observerCalls += 1;
        Math.random();
        Date.now();
      },
    });
    expect(observerCalls).toBeGreaterThan(0);

    resetForRun();
    Math.random = () => {
      throw new Error('ambient Math.random must not be used during replay');
    };
    expect(replayLog(log)).toMatchObject({
      winner: result.winner,
      reason: result.reason,
      turns: result.turns,
    });
    Math.random = originalRandom;
  });

  it('does not record policy-internal ambient RNG or clock reads', () => {
    const seed = 'replay-test-policy-ambient';
    const policy = (name: string): AIPolicy => ({
      name,
      choose(_state, candidates) {
        Math.random();
        Date.now();
        return candidates.find((move) => move.kind === 'endTurn') ?? null;
      },
    });
    const { result, log } = recordMatch({
      selfPolicy: policy('ambient-self'),
      oppPolicy: policy('ambient-opp'),
      initialState: setupGame(seed),
      maxTurns: 3,
    });

    resetForRun();
    expect(replayLog(log)).toMatchObject({
      winner: result.winner,
      reason: result.reason,
      turns: result.turns,
    });
    Math.random = originalRandom;
  });

  it('rejects tampered move turn metadata in canonical and prefix replay', () => {
    const policy: AIPolicy = {
      choose(_state, candidates) {
        return candidates.find((move) => move.kind === 'endTurn') ?? null;
      },
    };
    const { log } = recordMatch({
      selfPolicy: policy,
      oppPolicy: policy,
      initialState: setupGame('replay-turn-metadata'),
      maxTurns: 3,
    });
    const tampered = structuredClone(log);
    tampered.moves[0]!.turn += 1;

    resetForRun();
    expect(() => replayLog(tampered)).toThrow('replay turn mismatch');
    resetForRun();
    expect(() => computeStateAt(tampered, 1)).toThrow('replay turn mismatch');
    Math.random = originalRandom;
  });

  it('snapshots initial state and moves before caller or observer mutation', () => {
    const initial = setupGame('replay-snapshot-boundary');
    const initialTurn = initial.turn.number;
    const policy: AIPolicy = {
      choose(_state, candidates) {
        return candidates.find((move) => move.kind === 'endTurn') ?? null;
      },
    };
    const { log } = recordMatch({
      selfPolicy: policy,
      oppPolicy: policy,
      initialState: initial,
      maxTurns: 1,
      onTurn: (_turn, _player, moves) => {
        if (moves[0]) (moves[0] as { kind: string }).kind = 'reasoning';
      },
    });
    expect(log.initialState).not.toBe(initial);
    expect(log.initialState.turn.number).toBe(initialTurn);
    expect(log.moves[0]?.move.kind).toBe('endTurn');
  });

  it('UI full-state replay rejects a tampered result contract', () => {
    const seed = 'replay-test-ui-result';
    const { log } = recordMatch({
      selfPolicy: new HeuristicPolicy({ seed: `A-${seed}` }),
      oppPolicy: new HeuristicPolicy({ seed: `B-${seed}` }),
      initialState: setupGame(seed),
      maxTurns: 20,
    });
    const tampered = structuredClone(log);
    tampered.result.winner = log.result.winner === 'self' ? 'opp' : 'self';

    resetForRun();
    expect(() => computeStateAt(tampered, tampered.moves.length))
      .toThrow('replay result mismatch');
    Math.random = originalRandom;
  });

  it('preserves the streaming onTurn callback contract while capturing', () => {
    const seed = 'replay-test-streaming-observer';
    const initial = setupGame(seed);
    const result = recordMatch({
      selfPolicy: new HeuristicPolicy({ seed: `A-${seed}` }),
      oppPolicy: new HeuristicPolicy({ seed: `B-${seed}` }),
      initialState: initial,
      maxTurns: 20,
      onTurn: () => {
        throw new Error('streaming observer stop');
      },
    }).result;

    expect(result).toMatchObject({
      winner: 'invariant-fail',
      reason: 'invariant',
      error: 'streaming observer stop',
    });
    Math.random = originalRandom;
  });

  it('compares the exact invariant failure location', () => {
    const invalid = createEmptyGameState();
    const invalidPlayers = invalid.players as Partial<GameState['players']>;
    delete invalidPlayers.self;
    const fallbackPolicy = {
      choose: () => ({ kind: 'endTurn' } as Move),
    };
    const probe = runMatch({
      selfPolicy: fallbackPolicy,
      oppPolicy: fallbackPolicy,
      initialState: invalid,
      maxTurns: 1,
    });
    expect(probe.winner).toBe('invariant-fail');
    expect(probe.error).toBeTruthy();

    const log: ReplayLogV1 = {
      schemaVersion: 1,
      initialState: invalid,
      moves: [],
      result: {
        winner: probe.winner,
        reason: probe.reason,
        turns: probe.turns,
      },
    };
    Object.assign(log.result, { error: `${probe.error}:different-location` });

    expect(() => replayLog(log)).toThrow('replay result mismatch');
  });
});
