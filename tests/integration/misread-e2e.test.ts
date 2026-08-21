// tests/integration/misread-e2e.test.ts — Phase 5 advance Misread E2E 結合検証
//
// rules: 11-reasoning.md §LP≤0, 13-keywords.md §ミスリード
// spec: .claude/specs/2026-05-17-phase5-advance-guardrails.md
//
// 目的:
//   Phase 8 commit 3b で完成済の Misread infrastructure が、人間 defender 経路で
//   全経路結合動作することを実証する。AI defender 経路は既存 reasoning.misread.test.ts で確認済。
//
// 検証する経路 (Human defender):
//   doReasoning (opp が推理側)
//     → reasoning:before-add hook 発火
//     → listener (misread.ts) が self.scene の misread 持ちを抽出
//     → reasoningPlayer='opp' のため side-channel `_pendingMisreadSideChannel` set
//     → _drainPendingMisread() で回収
//     → setPendingMisread で Zustand へ
//     → dispatchEngineAction({type:'misreadResolve', picks})
//     → 各 pick について sleep + lpOverride(LP-Xtotal)

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import {
  registerMisreadListener,
  _drainPendingMisread,
  _resetPendingMisread,
  _resetMisreadRegistered,
} from '@/engine/listeners/misread';
import { misreadX } from '@/cards/_shared/misreadX';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { stepTurn, type AIPolicy } from '@/ai/policy';
import type { Move } from '@/ai/move-enumerator';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { startCausalSession } from '@/engine/log/causal';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { runAllUntilEmpty } from '@/engine/resolve';
import { produce } from '@/engine/produce';
import { _resolveDeferredMisread } from '@/engine/flow/main/reasoning';
import { gameResult } from '@/engine/mutate/gameResult';
import {
  resetPendingRuntimeStateAfterGameEnd,
  withIsolatedPendingRuntimeState,
} from '@/engine/effect/runtime-state';
import type { CardDef } from '@/engine/types/card-def';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import type { PendingMisreadAuthority } from '@/engine/types/misread';
import { makeChar as baseChar } from '../helpers/fixtures';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

const TEST_REASONER: CardDef = {
  id: 'TEST_R',
  no: 'TEST-R',
  kind: 'character',
  names: ['推理キャラ'],
  colors: ['blue'],
  level: 1,
  ap: 0,
  lp: 1000,
  traits: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

const TEST_MISREADER_2K: CardDef = {
  ...TEST_REASONER,
  id: 'TEST_M2K',
  names: ['ミスリード2000持ち'],
  abilities: [misreadX({ x: 2000, abilityId: 'a_mis' })],
};

const TEST_MISREADER_500: CardDef = {
  ...TEST_REASONER,
  id: 'TEST_M500',
  names: ['ミスリード500持ち'],
  abilities: [misreadX({ x: 500, abilityId: 'a_mis' })],
};

const TEST_CAUSAL_REASONER: CardDef = {
  ...TEST_REASONER,
  id: 'TESTR',
};

function makeChar(uid: string, cardId: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseChar({ cardId, uid, state, enterOrder: 0 });
}

function fullReset(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  _resetPendingMisread();
  _resetMisreadRegistered(); // event._resetRegistry() 後の再登録に必要
  registerAll();
  engine.cards.register(TEST_REASONER);
  engine.cards.register(TEST_CAUSAL_REASONER);
  engine.cards.register(TEST_MISREADER_2K);
  engine.cards.register(TEST_MISREADER_500);
  registerMisreadListener();
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingHirameki: null,
    pendingMisread: null,
  });
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
}

function doReasoningUntilPending(state: GameState, uid: string): void {
  engine.flow.doReasoning(state, uid);
  runAllUntilEmpty(state);
}

function persistedMisreadProjection(state: GameState): PendingMisreadAuthority {
  const entry = state.pendingRuntimeState?.snapshot.find((item) => item.key === '__pendingMisread');
  expect(entry?.present).toBe(true);
  return entry!.value as PendingMisreadAuthority;
}

function persistedReasoningContinuation(state: GameState) {
  const token = state.pendingMisreadAuthority?.continuationToken;
  const entry = state.pendingEffects.find((item) => item.reasoningContinuation?.token === token);
  expect(entry).toBeDefined();
  return entry!;
}

function makePausedMisreadState(twoCandidates = false, causalSessionId?: string): GameState {
  const state = createEmptyGameState();
  if (causalSessionId) startCausalSession(state, causalSessionId);
  state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.opp.scene = [makeChar('r1', causalSessionId ? 'TESTR' : 'TEST_R')];
  state.players.self.scene = [
    makeChar('m1', 'TEST_M2K'),
    ...(twoCandidates ? [makeChar('m2', 'TEST_M500')] : []),
  ];
  state.players.opp.deck = ['e1', 'e2', 'e3'];
  doReasoningUntilPending(state, 'r1');
  return state;
}

describe('Misread E2E 結合検証 — Human defender (Phase 5 advance)', () => {
  beforeAll(() => {
    registerAll();
  });

  beforeEach(() => {
    fullReset();
  });

  it('rejects a persisted Misread prompt without GameState-owned reasoning authority', () => {
    const forged = createEmptyGameState();
    forged.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    forged.players.opp.scene = [makeChar('r1', 'TEST_R', 'sleep')];
    forged.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    forged.reasoningContinuationSeq = 1;
    forged.pendingRuntimeSeq = 1;
    forged.pendingRuntimeState = {
      token: 1,
      snapshot: [{
        key: '__pendingMisread',
        present: true,
        value: {
          continuationToken: 1,
          player: 'self',
          reasoningUid: 'r1',
          reasoningPlayer: 'opp',
          candidates: [{ uid: 'm1', x: 2000 }],
        },
      }],
    };

    expect(() => useGameStateStore.getState().setGameState(structuredClone(forged)))
      .toThrow('Invalid pendingMisread: GameState authority required');
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toBeNull();
  });

  it('rejects GameState Misread authority without its persisted runtime projection', () => {
    const forged = structuredClone(makePausedMisreadState());
    forged.pendingRuntimeState!.snapshot = forged.pendingRuntimeState!.snapshot.filter(
      (entry) => entry.key !== '__pendingMisread',
    );
    _resetPendingMisread();

    expect(() => useGameStateStore.getState().setGameState(forged))
      .toThrow('Invalid pendingMisread: persisted runtime projection required');
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toBeNull();
  });

  it.each([
    ['continuation token', (authority: PendingMisreadAuthority) => { authority.continuationToken += 1; }],
    ['decision owner', (authority: PendingMisreadAuthority) => { authority.player = 'opp'; }],
    ['reasoning target', (authority: PendingMisreadAuthority) => { authority.reasoningUid = 'm1'; }],
    ['candidate removal', (authority: PendingMisreadAuthority) => { authority.candidates.pop(); }],
    ['candidate order', (authority: PendingMisreadAuthority) => { authority.candidates.reverse(); }],
    ['candidate X', (authority: PendingMisreadAuthority) => { authority.candidates[0]!.x += 1; }],
  ] as const)('rejects paired GameState/runtime forgery of %s', (_label, mutateAuthority) => {
    const forged = structuredClone(makePausedMisreadState(true));
    const stateAuthority = forged.pendingMisreadAuthority!;
    const runtimeProjection = persistedMisreadProjection(forged);
    mutateAuthority(stateAuthority);
    mutateAuthority(runtimeProjection);
    _resetPendingMisread();

    expect(() => useGameStateStore.getState().setGameState(forged))
      .toThrow(/Invalid pendingMisread/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toBeNull();
  });

  it('rejects paired reasoning UID forgery to a sleeping copy of the same card', () => {
    const forged = structuredClone(makePausedMisreadState(false, 'same-card-anchor'));
    forged.players.opp.scene.push(makeChar('r2', 'TESTR', 'sleep'));
    forged.pendingMisreadAuthority!.reasoningUid = 'r2';
    persistedMisreadProjection(forged).reasoningUid = 'r2';
    forged.pendingReasoningContinuation!.uid = 'r2';
    const continuation = persistedReasoningContinuation(forged);
    continuation.reasoningContinuation!.uid = 'r2';
    continuation.source.uid = 'r2';
    (continuation.triggeredBy.payload as { uid: string }).uid = 'r2';
    resetPresentationQueue('same-card-anchor');

    expect(() => useGameStateStore.getState().setGameState(forged, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toMatchObject({ reasoningUid: 'r1' });
  });

  it('rejects a shallow-cloned state that reassigns a live reasoning UID to another same-card occurrence', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'same-card-shallow-clone');
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const first = makeChar('r1', 'TESTR');
    const second = makeChar('r2', 'TESTR', 'sleep');
    first.enterOrder = 11;
    second.enterOrder = 22;
    state.players.opp.scene = [first, second];
    state.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    state.players.opp.deck = ['e1', 'e2', 'e3'];
    doReasoningUntilPending(state, 'r1');

    const forged = { ...state, players: structuredClone(state.players) };
    forged.players.opp.scene[0]!.uid = 'r2';
    forged.players.opp.scene[1]!.uid = 'r1';
    resetPresentationQueue('same-card-shallow-clone');

    expect(() => useGameStateStore.getState().setGameState(forged, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toMatchObject({ reasoningUid: 'r1' });
  });

  it('rejects a shallow-cloned state that changes reasoning output behind the live runtime owner', () => {
    const state = makePausedMisreadState(false, 'semantic-shallow-clone');
    const forged = { ...state, players: structuredClone(state.players) };
    forged.players.opp.scene[0]!.lpOverride = 9000;
    resetPresentationQueue('semantic-shallow-clone');

    expect(() => useGameStateStore.getState().setGameState(forged, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toMatchObject({ reasoningUid: 'r1' });
  });

  it('rejects a non-finite reasoning output that collides under JSON serialization', () => {
    const state = makePausedMisreadState(false, 'non-finite-semantic-clone');
    const forged = { ...state, players: structuredClone(state.players) };
    expect(forged.players.opp.scene[0]!.lpOverride).toBeNull();
    forged.players.opp.scene[0]!.lpOverride = Number.NaN;
    resetPresentationQueue('non-finite-semantic-clone');

    expect(() => useGameStateStore.getState().setGameState(forged, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toMatchObject({ reasoningUid: 'r1' });
  });

  it('rejects a non-enumerable reasoning field that Immer would omit on resume', () => {
    const state = makePausedMisreadState(false, 'descriptor-semantic-clone');
    const forged = { ...state, players: structuredClone(state.players) };
    Object.defineProperty(forged.players.opp.scene[0]!, 'lpOverride', {
      configurable: true,
      enumerable: false,
      value: null,
      writable: true,
    });
    resetPresentationQueue('descriptor-semantic-clone');

    expect(() => useGameStateStore.getState().setGameState(forged, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toMatchObject({ reasoningUid: 'r1' });
  });

  it('rejects rewiring separate equal subtrees into a shared runtime alias', () => {
    const state = makePausedMisreadState(false, 'alias-topology-clone');
    const forged = { ...state, players: structuredClone(state.players) };
    const reasoner = forged.players.opp.scene[0]!;
    const misreader = forged.players.self.scene[0]!;
    expect(reasoner.turnEffects).toEqual(misreader.turnEffects);
    expect(reasoner.turnEffects).not.toBe(misreader.turnEffects);
    misreader.turnEffects = reasoner.turnEffects;
    resetPresentationQueue('alias-topology-clone');

    expect(() => useGameStateStore.getState().setGameState(forged, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toMatchObject({ reasoningUid: 'r1' });
  });

  it.each([
    ['missing trace', (authority: PendingMisreadAuthority) => { delete authority.causalTrace; }],
    ['unknown root', (authority: PendingMisreadAuthority) => { authority.causalTrace!.rootEventId = 'forged:1'; }],
    ['wrong tail', (authority: PendingMisreadAuthority) => { authority.causalTrace!.tailEventId = authority.causalTrace!.rootEventId; }],
    ['not awaiting', (authority: PendingMisreadAuthority) => { delete authority.causalTrace!.awaitingResume; }],
    ['already completed', (authority: PendingMisreadAuthority) => { authority.causalTrace!.completed = true; }],
  ] as const)('rejects paired GameState/runtime causal forgery: %s', (_label, mutateAuthority) => {
    const forged = structuredClone(makePausedMisreadState(false, 'misread-authority'));
    resetPresentationQueue('misread-authority');
    mutateAuthority(forged.pendingMisreadAuthority!);
    mutateAuthority(persistedMisreadProjection(forged));
    _resetPendingMisread();

    expect(() => useGameStateStore.getState().setGameState(forged))
      .toThrow(/Invalid pendingMisread: causal trace/);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(globalThis.__pendingMisread).toBeNull();
  });

  it('rejects an unchanged JSON round-trip after the live lease is reset', () => {
    const restored = JSON.parse(JSON.stringify(
      makePausedMisreadState(false, 'misread-authority-legitimate'),
    )) as GameState;
    resetPresentationQueue('misread-authority-legitimate');
    _resetPendingMisread();

    expect(() => useGameStateStore.getState().setGameState(restored, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread: live resume lease/);
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('accepts the exact live authority and rejects replay of its bound public action', () => {
    const restored = makePausedMisreadState();
    expect(useGameStateStore.getState().setGameState(restored, { preserveRuntime: true })).toBe(true);
    const pending = useGameStateStore.getState().pendingMisread!;
    expect(pending.continuationToken)
      .toBe(useGameStateStore.getState().gameState?.pendingMisreadAuthority?.continuationToken);
    const action = bindPendingDecision(pending, {
      type: 'misreadResolve',
      picks: pending.candidates,
    });

    expect(dispatchEngineAction(action)).toEqual({ ok: true });
    const afterFirst = structuredClone(useGameStateStore.getState().gameState!);
    expect(dispatchEngineAction(action)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toEqual(afterFirst);
    expect(afterFirst.pendingMisreadAuthority).toBeUndefined();
    expect(afterFirst.pendingRuntimeState).toBeUndefined();
  });

  it('rejects an unchanged clone while the original live lease still exists', () => {
    const live = makePausedMisreadState(false, 'misread-authority-clone');
    const cloned = structuredClone(live);
    resetPresentationQueue('misread-authority-clone');

    expect(() => useGameStateStore.getState().setGameState(cloned, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread: live resume lease/);
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('invalidates the live lease at a match-session reset', () => {
    const paused = makePausedMisreadState(false, 'misread-authority-reset');
    resetPresentationQueue('misread-authority-reset');
    useGameStateStore.getState().resetMatchSessionState();

    expect(() => useGameStateStore.getState().setGameState(paused, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread: live resume lease/);
  });

  it('invalidates the live lease at the replay boundary', () => {
    const paused = makePausedMisreadState(false, 'misread-authority-replay');
    resetPresentationQueue('misread-authority-replay');
    useGameStateStore.getState().setReplayGameState(null);

    expect(() => useGameStateStore.getState().setGameState(paused, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread: live resume lease/);
  });

  it('invalidates the live lease after a terminal state is committed', () => {
    const paused = makePausedMisreadState();
    const terminal = structuredClone(paused);
    gameResult.set(terminal, 'self', 'evidence');
    expect(useGameStateStore.getState().commitTerminalState(terminal)).toBe(true);

    expect(() => useGameStateStore.getState().setGameState(paused, { preserveRuntime: true }))
      .toThrow(/Invalid pendingMisread: live resume lease/);
  });

  it('restores the live lease when a Misread resolution transaction throws', () => {
    const state = makePausedMisreadState();
    const pending = _drainPendingMisread()!;
    useGameStateStore.setState({ gameState: state, pendingMisread: pending });

    expect(() => useGameStateStore.getState().dispatch((current) => produce(current, (draft) => {
      _resolveDeferredMisread(draft, pending, pending.candidates);
      throw new Error('misread lease rollback probe');
    })))
      .toThrow('misread lease rollback probe');
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: pending.candidates }))
      .toEqual({ ok: true });
  });

  it('restores the caller live lease after an isolated terminal runtime clears its own channels', () => {
    const paused = makePausedMisreadState();
    withIsolatedPendingRuntimeState(createEmptyGameState(), () => {
      resetPendingRuntimeStateAfterGameEnd({ preserveCompletedPresentations: false });
    });

    expect(useGameStateStore.getState().setGameState(paused, { preserveRuntime: true })).toBe(true);
  });

  it.each([
    ['scene order', ['m1', 'm2']],
    ['reverse pick order', ['m2', 'm1']],
  ] as const)('commits every selected card and total LP before the first observer: %s', (_label, order) => {
    const state = makePausedMisreadState(true);
    const pending = _drainPendingMisread()!;
    const observations: Array<{ states: string[]; reduction: unknown; evidence: number }> = [];
    const stateChangeObservations: Array<{ states: string[]; reduction: unknown; evidence: number }> = [];
    event.on('state:change', (observed, payload) => {
      const uid = (payload as { uid?: unknown } | undefined)?.uid;
      if (uid !== 'm1' && uid !== 'm2') return;
      stateChangeObservations.push({
        states: observed.players.self.scene.map((card) => card.state),
        reduction: observed.players.opp.scene[0]?.turnEffects['lpMod_reasoning'],
        evidence: observed.players.opp.evidence.length,
      });
    });
    event.on('misread:performed', (observed) => {
      observations.push({
        states: observed.players.self.scene.map((card) => card.state),
        reduction: observed.players.opp.scene[0]?.turnEffects['lpMod_reasoning'],
        evidence: observed.players.opp.evidence.length,
      });
    });
    useGameStateStore.setState({ gameState: state, pendingMisread: pending });
    const picks = order.map((uid) => pending.candidates.find((candidate) => candidate.uid === uid)!);

    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks })).toEqual({ ok: true });
    expect(observations).toEqual([
      { states: ['sleep', 'sleep'], reduction: -2500, evidence: 0 },
      { states: ['sleep', 'sleep'], reduction: -2500, evidence: 0 },
    ]);
    expect(stateChangeObservations).toEqual([
      { states: ['sleep', 'sleep'], reduction: -2500, evidence: 0 },
      { states: ['sleep', 'sleep'], reduction: -2500, evidence: 0 },
    ]);
  });

  it('Test 1: opp が推理、self.scene に misread → side-channel set → drain → store', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3', 'e4', 'e5'];

    doReasoningUntilPending(s, 'r1');

    const pending = _drainPendingMisread();
    expect(pending).not.toBeNull();
    expect(pending!.reasoningUid).toBe('r1');
    expect(pending!.reasoningPlayer).toBe('opp');
    expect(pending!.candidates).toHaveLength(1);
    expect(pending!.candidates[0]).toEqual({ uid: 'm1', x: 2000 });
  });

  it('Test 2: misread 候補なし → side-channel null のまま', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    // self.scene 空
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    doReasoningUntilPending(s, 'r1');

    expect(_drainPendingMisread()).toBeNull();
  });

  it('Test 3: 複数 misread → 全候補が listed', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [
      makeChar('m1', 'TEST_M2K'),
      makeChar('m2', 'TEST_M500'),
    ];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    doReasoningUntilPending(s, 'r1');

    const pending = _drainPendingMisread();
    expect(pending).not.toBeNull();
    expect(pending!.candidates).toHaveLength(2);
    const xs = pending!.candidates.map((c) => c.x).sort((a, b) => a - b);
    expect(xs).toEqual([500, 2000]);
  });

  it('Test 4: sleep / stun の misread は候補外', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [
      makeChar('m1', 'TEST_M2K', 'sleep'),
      makeChar('m2', 'TEST_M500', 'stun'),
    ];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    doReasoningUntilPending(s, 'r1');

    expect(_drainPendingMisread()).toBeNull();
  });

  it('Test 5: dispatch misreadResolve → 選択 pick が sleep + lpOverride', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [
      makeChar('m1', 'TEST_M2K'),
      makeChar('m2', 'TEST_M500'),
    ];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    doReasoningUntilPending(s, 'r1');
    const pending = _drainPendingMisread();
    expect(pending).not.toBeNull();

    // store に転送
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });

    // 両方 pick で dispatch
    const r = dispatchCurrentDecision({
      type: 'misreadResolve',
      picks: [
        { uid: 'm1', x: 2000 },
        { uid: 'm2', x: 500 },
      ],
    });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // m1, m2 がスリープ
    expect(after.players.self.scene.find((c) => c.uid === 'm1')?.state).toBe('sleep');
    expect(after.players.self.scene.find((c) => c.uid === 'm2')?.state).toBe('sleep');
    // LP-X はこの推理中だけ。印字LP・既存修正は汚染しない。
    expect(after.players.opp.scene.find((c) => c.uid === 'r1')?.lpOverride).toBeNull();
    expect(after.players.opp.scene.find((c) => c.uid === 'r1')?.turnEffects['lpMod_reasoning']).toBeUndefined();
    // pending クリア
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });

  it('Test 6: misreadResolve with empty picks → no-op、ただし pending クリア', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3'];

    doReasoningUntilPending(s, 'r1');
    const pending = _drainPendingMisread();
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });

    const r = dispatchCurrentDecision({ type: 'misreadResolve', picks: [] });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // pick 0 件で m1 はアクティブのまま、r1 LP もそのまま
    expect(after.players.self.scene.find((c) => c.uid === 'm1')?.state).toBe('active');
    expect(after.players.opp.scene.find((c) => c.uid === 'r1')?.lpOverride).toBeNull();
    // pending クリア
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });

  it('Test 7: human misread 決定まで証拠取得と reasoning:end を保留する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3'];
    let reasoningEndCount = 0;
    event.on('reasoning:end', () => { reasoningEndCount += 1; });

    doReasoningUntilPending(s, 'r1');
    const pending = _drainPendingMisread();

    expect(pending).not.toBeNull();
    expect(s.players.opp.evidence).toEqual([]);
    expect(reasoningEndCount).toBe(0);

    useGameStateStore.setState({ gameState: s, pendingMisread: pending });
    expect(dispatchCurrentDecision({ type: 'misreadResolve', picks: [] })).toMatchObject({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.evidence.map((card) => card.cardId)).toEqual(['e1', 'e2', 'e3']);
    expect(reasoningEndCount).toBe(1);
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });

  it('Test 8: CPU reasoning step は human misread を同じstepでsurfaceし停止する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3'];
    const policy: AIPolicy = {
      name: 'reasoning-only',
      choose: (_state: GameState, moves: Move[]) => moves.find(
        (move) => move.kind === 'reasoning' && move.uid === 'r1',
      ) ?? null,
    };

    const step = stepTurn(s, policy, 'opp');

    expect(step.move?.kind).toBe('reasoning');
    expect(step.paused).toEqual({ humanPick: true });
    expect(step.nextState.players.opp.evidence).toEqual([]);

    useGameStateStore.getState().setGameState(step.nextState, { preserveRuntime: true });
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingMisread).toMatchObject({
      player: 'self',
      reasoningUid: 'r1',
      reasoningPlayer: 'opp',
    });
  });

  it.each([
    ['forged uid', [{ uid: 'forged', x: 2000 }]],
    ['forged x', [{ uid: 'm1', x: 9999 }]],
    ['duplicate uid', [{ uid: 'm1', x: 2000 }, { uid: 'm1', x: 2000 }]],
  ] as const)('Test 9: %s のミスリードpickを拒否する', (_label, picks) => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3'];
    doReasoningUntilPending(s, 'r1');
    const pending = _drainPendingMisread();
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });

    const result = dispatchCurrentDecision({ type: 'misreadResolve', picks });

    expect(result).toMatchObject({ ok: false, reason: 'not-allowed' });
    const after = useGameStateStore.getState();
    expect(after.pendingMisread).not.toBeNull();
    expect(after.gameState?.players.self.scene.find((c) => c.uid === 'm1')?.state).toBe('active');
    expect(after.gameState?.players.opp.evidence).toEqual([]);
  });

  it('Test 10: pending後に無効になった stale candidate を拒否する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3'];
    doReasoningUntilPending(s, 'r1');
    const pending = _drainPendingMisread();
    s.players.self.scene[0].state = 'sleep';
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });

    const result = dispatchCurrentDecision({
      type: 'misreadResolve', picks: [{ uid: 'm1', x: 2000 }],
    });

    expect(result).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().pendingMisread).not.toBeNull();
    expect(useGameStateStore.getState().gameState?.players.opp.evidence).toEqual([]);
  });

  it('Test 11: pending後に推理対象が離場した stale decision を拒否する', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('r1', 'TEST_R')];
    s.players.self.scene = [makeChar('m1', 'TEST_M2K')];
    s.players.opp.deck = ['e1', 'e2', 'e3'];
    doReasoningUntilPending(s, 'r1');
    const pending = _drainPendingMisread();
    s.players.opp.scene = [];
    useGameStateStore.setState({ gameState: s, pendingMisread: pending });

    const result = dispatchCurrentDecision({ type: 'misreadResolve', picks: [] });

    expect(result).toMatchObject({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().pendingMisread).not.toBeNull();
    expect(useGameStateStore.getState().gameState?.players.opp.evidence).toEqual([]);
  });
});
