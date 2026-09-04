// BUG-304 — a protected sceneRemove must gate a 「リムーブした場合」 chain.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B05041 } from '@/cards/ct-p05/B05041';
import { B05117 } from '@/cards/ct-p05/B05117';
import { B01092 } from '@/cards/ct-p01/B01092';
import { B02052 } from '@/cards/ct-p02/B02052';
import {
  applyChoiceAndContinuation,
  applyPickAndContinuation,
  applySetCardReplacement,
} from '@/engine/effect/apply-pick';
import {
  _drainPendingEffectChoiceSide,
  _drainPendingSetCardReplacementSide,
  resetPendingEffectSession,
  type PendingEffectPickSide,
} from '@/engine/effect/pending-state';
import { mutate } from '@/engine/mutate';
import * as contactFlow from '@/engine/flow/contact';
import { event } from '@/engine/event';
import { run as runEffect } from '@/engine/effect/resolver';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Effect, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar, makeCtx } from '../../helpers/fixtures';

const effect: Effect = {
  kind: 'chain',
  steps: [
    { kind: 'atom', verb: 'sceneRemove', args: { uid: 'target', cause: 'effect' } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ],
};

function run(protectedTarget: boolean) {
  const state = createEmptyGameState();
  const target = makeChar({ uid: 'target', cardId: 'TARGET', state: 'active' });
  if (protectedTarget) target.setCards = [{ cardId: B05041.id, faceUp: true, instanceId: 'set:1' }];
  state.players.opp.scene = [target];
  state.players.self.deck = ['DRAW'];
  const ctx = makeCtx({
    source: { player: 'self', cardId: 'SOURCE', abilityId: 'a1', uid: 'source', area: 'scene' },
    bindings: {},
    dyn: {},
  });
  const result = produce(state, draft => runEffect(draft, effect, ctx));
  return { result, ctx };
}

function card(id: string, rarity: CardDef['rarity'] = 'C'): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['青'],
    traits: [],
    keywords: [],
    rarity,
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function patternAState(targetCardId = 'VICTIM', withGuardian = true): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [
    makeChar({ uid: 'victim', cardId: targetCardId, state: 'active' }),
    ...(withGuardian ? [makeChar({ uid: 'guardian', cardId: B01092.id, state: 'active' })] : []),
  ];
  state.players.opp.deck = ['DRAW'];
  return state;
}

function sceneRemovePick(targetCardId = 'VICTIM'): PendingEffectPickSide {
  return {
    player: 'self',
    ownerPlayer: 'opp',
    candidates: [{ kind: 'char', uid: 'victim', cardId: targetCardId, player: 'self' }],
    atomVerb: 'sceneRemove',
    atomArgs: { uid: '$pick', cause: 'effect' },
    nMin: 1,
    nMax: 1,
    source: { cardId: 'SOURCE', abilityId: 'a1', uid: 'source', area: 'scene' },
    continuation: {
      kind: 'chain',
      remainder: [{ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }],
      ctx: makeCtx({
        source: { player: 'opp', cardId: 'SOURCE', abilityId: 'a1', uid: 'source', area: 'scene' },
        bindings: {},
        dyn: {},
      }),
    },
  };
}

function replacementChainState(setCardCount = 1) {
  const state = createEmptyGameState();
  state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  const host = mutate.scene.enter(state, 'self', 'KAITOU', {});
  const replacementTarget = mutate.scene.enter(state, 'self', 'KAITOU', {});
  const replacementTargetTwo = setCardCount > 1
    ? mutate.scene.enter(state, 'self', 'KAITOU', {})
    : null;
  for (let i = 0; i < setCardCount; i += 1) {
    mutate.char.setCard(state, host.uid, B02052.id, true);
  }
  state.players.opp.deck = ['DRAW'];
  const pending = sceneRemovePick('KAITOU');
  pending.candidates = [{ kind: 'char', uid: host.uid, cardId: 'KAITOU', player: 'self' }];
  return { state, host, replacementTarget, replacementTargetTwo, pending };
}

beforeEach(() => {
  _resetRegistry();
  register(B05041);
  register(B05117);
  register(B01092);
  register(B02052);
  register(card('VICTIM'));
  register(card('SOURCE'));
  register(card('DRAW'));
  register(card('MR-VICTIM', 'MR'));
  register({ ...card('MR-KAITOU', 'MR'), traits: ['怪盗'] });
  register({ ...card('KAITOU'), traits: ['怪盗'] });
  resetPendingEffectSession();
  useGameStateStore.getState().resetMatchSessionState();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  resetPendingEffectSession();
  useGameStateStore.getState().resetMatchSessionState();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('BUG-304 sceneRemove actual-removal chain gate', () => {
  it('blocks the chained draw when protection prevents the selected removal', () => {
    const { result, ctx } = run(true);
    expect(result.players.opp.scene.map(char => char.uid)).toEqual(['target']);
    expect(result.players.self.hand).toEqual([]);
    expect(ctx.dyn?.chainStepNoApply).toBe(true);
  });

  it('permits the chained draw after a real removal', () => {
    const { result, ctx } = run(false);
    expect(result.players.opp.scene).toEqual([]);
    expect(result.players.opp.remove).toEqual(['TARGET']);
    expect(result.players.self.hand).toEqual(['DRAW']);
    expect(ctx.dyn?.chainStepNoApply).not.toBe(true);
  });

  it('permits the chained draw when the removed host and its set card share a card ID', () => {
    const state = patternAState('VICTIM', false);
    state.players.self.scene[0]!.setCards = [{ cardId: 'VICTIM', faceUp: true, instanceId: 'set:same-id' }];

    applyPickAndContinuation(state, sceneRemovePick(), 'victim');

    expect(state.players.self.remove.filter((cardId) => cardId === 'VICTIM')).toHaveLength(2);
    expect(state.players.opp.hand).toEqual(['DRAW']);
  });

  it.each([
    ['accepts', 0, ['VICTIM'], ['B01092'], []],
    ['declines', 1, [], [], ['VICTIM']],
  ] as const)('pauses a Pattern-A removal and %s the leave intercept before the chain tail', (_label, choiceIndex, expectedHand, expectedGuardianRemove, expectedVictimRemove) => {
    const state = patternAState();

    applyPickAndContinuation(state, sceneRemovePick(), 'victim');

    const choice = _drainPendingEffectChoiceSide();
    expect(choice).not.toBeNull();
    expect(state.players.self.scene.map(char => char.uid)).toEqual(['victim', 'guardian']);
    expect(state.players.opp.hand).toEqual([]);

    applyChoiceAndContinuation(state, choice!, choiceIndex);

    expect(state.players.self.hand).toEqual(expectedHand);
    expect(state.players.self.remove).toEqual(expect.arrayContaining([...expectedGuardianRemove, ...expectedVictimRemove]));
    expect(state.players.self.scene.map(char => char.uid)).toEqual(choiceIndex === 0 ? [] : ['guardian']);
    expect(state.players.opp.hand).toEqual(choiceIndex === 0 ? [] : ['DRAW']);
  });

  it('keeps the exact B05117 set-card occurrence on a deferred leave-intercept choice', () => {
    const state = patternAState();
    const ctx = makeCtx({
      source: {
        player: 'opp',
        cardId: 'SOURCE',
        abilityId: 'b05117_set_t1',
        uid: 'source-host',
        area: 'scene',
        setCardId: B05117.id,
        setCardInstanceId: 'set:fox:source',
      },
      bindings: {},
      dyn: {},
    });

    runEffect(state, {
      kind: 'atom',
      verb: 'sceneRemove',
      args: { uid: 'victim', cause: 'effect' },
    }, ctx);

    const choice = _drainPendingEffectChoiceSide();
    expect(choice?.source).toMatchObject({
      cardId: 'SOURCE',
      abilityId: 'b05117_set_t1',
      uid: 'source-host',
      area: 'scene',
      setCardId: B05117.id,
      setCardInstanceId: 'set:fox:source',
    });

    applyChoiceAndContinuation(state, choice!, 1);
    expect(state.players.self.remove).toContain('VICTIM');
  });

  it('gates the chain tail when an MR target redirects to the partner area', () => {
    const state = patternAState('MR-VICTIM', false);

    applyPickAndContinuation(state, sceneRemovePick('MR-VICTIM'), 'victim');

    expect(state.players.self.partnerAreaMR?.cardId).toBe('MR-VICTIM');
    expect(state.players.self.scene).toEqual([]);
    expect(state.players.self.remove).not.toContain('MR-VICTIM');
    expect(state.players.opp.hand).toEqual([]);
    expect(_drainPendingEffectChoiceSide()).toBeNull();
  });

  it('gates the chain tail when an MR target and its set card share a card ID', () => {
    const state = patternAState('MR-VICTIM', false);
    state.players.self.scene[0]!.setCards = [{ cardId: 'MR-VICTIM', faceUp: true, instanceId: 'set:mr-same-id' }];

    applyPickAndContinuation(state, sceneRemovePick('MR-VICTIM'), 'victim');

    expect(state.players.self.partnerAreaMR?.cardId).toBe('MR-VICTIM');
    expect(state.players.self.remove).toEqual(['MR-VICTIM']);
    expect(state.players.opp.hand).toEqual([]);
  });

  it('gates the chain tail when the selected scene target becomes stale', () => {
    const state = patternAState('VICTIM', false);
    state.players.self.scene = [];
    state.players.self.hand = ['VICTIM'];

    applyPickAndContinuation(state, sceneRemovePick(), 'victim');

    expect(state.players.self.hand).toEqual(['VICTIM']);
    expect(state.players.self.remove).toEqual([]);
    expect(state.players.opp.hand).toEqual([]);
    expect(_drainPendingEffectChoiceSide()).toBeNull();
  });

  it('persists the intercepted chain and resumes it through the public decision dispatcher', () => {
    const state = patternAState();
    applyPickAndContinuation(state, sceneRemovePick(), 'victim');
    runAllUntilEmpty(state);

    expect(state.pendingRuntimeState).toBeDefined();
    expect(state.players.opp.hand).toEqual([]);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(
      JSON.parse(JSON.stringify(state)) as GameState,
    );
    const pending = useGameStateStore.getState().pendingEffectChoice;
    expect(pending).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(
      pending!,
      { type: 'choiceResolve', choiceIndex: 0 },
    ))).toEqual({ ok: true });

    const resumed = useGameStateStore.getState().gameState!;
    expect(resumed.players.self.hand).toEqual(['VICTIM']);
    expect(resumed.players.self.remove).toContain('B01092');
    expect(resumed.players.opp.hand).toEqual([]);
    expect(resumed.pendingRuntimeState).toBeUndefined();
  });

  it('pauses the chain tail behind a set-card replacement created by the selected removal', () => {
    const { state, host, replacementTarget, pending } = replacementChainState();

    applyPickAndContinuation(state, pending, host.uid);

    const replacement = _drainPendingSetCardReplacementSide();
    expect(replacement).not.toBeNull();
    expect(state.players.opp.hand).toEqual([]);
    expect(state.players.self.scene.some(char => char.uid === host.uid)).toBe(true);

    expect(applySetCardReplacement(state, replacement!, replacementTarget.uid)).toBe(true);
    expect(state.players.self.scene.some(char => char.uid === host.uid)).toBe(false);
    expect(state.players.self.scene.find(char => char.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(state.players.opp.hand).toEqual(['DRAW']);
  });

  it.each([
    ['moves the set card', true],
    ['removes the set card', false],
  ] as const)('keeps the chain paused after declining a leave intercept, then %s', (_label, moveSetCard) => {
    const { state, host, replacementTarget, pending } = replacementChainState();
    mutate.scene.enter(state, 'self', B01092.id, {});

    applyPickAndContinuation(state, pending, host.uid);
    const leaveChoice = _drainPendingEffectChoiceSide();
    expect(leaveChoice).not.toBeNull();
    applyChoiceAndContinuation(state, leaveChoice!, 1);

    const replacement = _drainPendingSetCardReplacementSide();
    expect(replacement).not.toBeNull();
    expect(state.players.opp.hand).toEqual([]);
    expect(state.players.self.scene.some((card) => card.uid === host.uid)).toBe(true);

    expect(applySetCardReplacement(
      state,
      replacement!,
      moveSetCard ? replacementTarget.uid : null,
    )).toBe(true);
    expect(_drainPendingEffectChoiceSide()).toBeNull();
    expect(state.players.self.scene.some((card) => card.uid === host.uid)).toBe(false);
    expect(state.players.opp.hand).toEqual(['DRAW']);
    if (moveSetCard) {
      expect(state.players.self.scene.find((card) => card.uid === replacementTarget.uid)?.setCards)
        .toMatchObject([{ cardId: B02052.id }]);
    } else {
      expect(state.players.self.remove).toContain(B02052.id);
    }
  });

  it('keeps an accepted leave intercept paused for the human set-card replacement', () => {
    const { state, host, replacementTarget, pending } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});

    applyPickAndContinuation(state, pending, host.uid);
    const leaveChoice = _drainPendingEffectChoiceSide();
    expect(leaveChoice).not.toBeNull();
    applyChoiceAndContinuation(state, leaveChoice!, 0);

    const replacement = _drainPendingSetCardReplacementSide();
    expect(replacement).not.toBeNull();
    expect(state.players.self.scene.map((entry) => entry.uid)).toEqual([
      host.uid,
      replacementTarget.uid,
    ]);
    expect(state.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(false);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.remove).toEqual([B01092.id]);
    expect(state.players.opp.hand).toEqual([]);

    expect(applySetCardReplacement(state, replacement!, replacementTarget.uid)).toBe(true);
    expect(state.players.self.hand).toEqual(['KAITOU']);
    expect(state.players.self.remove).toEqual([B01092.id]);
    expect(state.players.self.scene.find((entry) => entry.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(state.players.opp.hand).toEqual([]);
    expect(_drainPendingSetCardReplacementSide()).toBeNull();
  });

  it('resolves a B02052 on the accepted B01092 guardian before the target host replacement', () => {
    const { state, host, replacementTarget, pending } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);

    applyPickAndContinuation(state, pending, host.uid);
    const leaveChoice = _drainPendingEffectChoiceSide();
    expect(leaveChoice).not.toBeNull();
    applyChoiceAndContinuation(state, leaveChoice!, 0);

    const guardianReplacement = _drainPendingSetCardReplacementSide();
    expect(guardianReplacement?.fromUid).toBe(guardian.uid);
    expect(state.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(true);
    expect(state.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(true);

    expect(applySetCardReplacement(state, guardianReplacement!, replacementTarget.uid)).toBe(true);
    const hostReplacement = _drainPendingSetCardReplacementSide();
    expect(hostReplacement?.fromUid).toBe(host.uid);
    expect(state.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(false);
    expect(state.players.self.remove).toContain(B01092.id);
    expect(state.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(true);

    expect(applySetCardReplacement(state, hostReplacement!, null)).toBe(true);
    expect(state.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(false);
    expect(state.players.self.hand).toEqual(['KAITOU']);
    expect(state.players.self.remove).toEqual([B01092.id, B02052.id]);
    expect(state.players.opp.hand).toEqual([]);
  });

  it('keeps a contact unresolved through guardian and target B02052 replacements', () => {
    const { state, host, replacementTarget } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);
    state.actionContextSeq = 1;
    state.actionContexts = {
      ax_1: {
        id: 'ax_1',
        byUid: 'attacker',
        byPlayer: 'opp',
        target: { kind: 'char', uid: host.uid },
        phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: {
          player: 'self', targetUid: host.uid, interceptorUid: guardian.uid,
        },
        startedAt: { turn: 2, nano: 1 },
      },
    };

    expect(contactFlow.resolveLeaveIntercept(state, state.actionContexts.ax_1!, true).deferred).toBe(true);
    expect(state.actionContexts.ax_1?.judgeResolved).toBeUndefined();
    expect(state.actionContexts.ax_1).toMatchObject({
      pendingLeaveInterceptReplacement: {
        targetUid: host.uid,
        targetCardId: 'KAITOU',
        interceptorUid: guardian.uid,
        byUid: 'attacker',
        accept: true,
        stage: 'interceptor-cost',
      },
    });

    const guardianReplacement = _drainPendingSetCardReplacementSide();
    expect(applySetCardReplacement(state, guardianReplacement!, replacementTarget.uid)).toBe(true);
    expect(state.actionContexts.ax_1?.judgeResolved).toBeUndefined();
    expect(state.actionContexts.ax_1).toMatchObject({
      pendingLeaveInterceptReplacement: { stage: 'target-leave' },
    });

    const targetReplacement = _drainPendingSetCardReplacementSide();
    expect(targetReplacement).not.toBeNull();
    expect(applySetCardReplacement(state, targetReplacement!, null)).toBe(true);
    expect(state.actionContexts.ax_1).toMatchObject({ judgeResolved: true });
    expect(state.actionContexts.ax_1?.pendingLeaveInterceptReplacement).toBeUndefined();
    expect(state.players.self.hand).toEqual(['KAITOU']);
  });

  it('resumes the nested contact through only public decision authorities', () => {
    const { state, host, replacementTarget } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);
    state.actionContextSeq = 1;
    state.actionContexts = {
      ax_1: {
        id: 'ax_1',
        byUid: 'attacker',
        byPlayer: 'opp',
        target: { kind: 'char', uid: host.uid },
        phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: host.uid, interceptorUid: guardian.uid },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const leave = useGameStateStore.getState().pendingLeaveIntercept;

    expect(dispatchEngineAction(bindPendingDecision(leave!, {
      type: 'leaveInterceptResolve', accept: true,
    }))).toEqual({ ok: true });
    let current = useGameStateStore.getState();
    expect(current.pendingLeaveIntercept).toBeNull();
    expect(current.gameState?.actionContexts.ax_1?.judgeResolved).not.toBe(true);
    expect(current.gameState?.actionContexts.ax_1).toMatchObject({
      pendingLeaveInterceptReplacement: { stage: 'interceptor-cost' },
    });
    const guardianReplacement = current.pendingSetCardReplacement;
    expect(guardianReplacement?.fromUid).toBe(guardian.uid);

    expect(dispatchEngineAction(bindPendingDecision(guardianReplacement!, {
      type: 'setCardReplacementResolve', targetUid: replacementTarget.uid,
    }))).toEqual({ ok: true });
    current = useGameStateStore.getState();
    expect(current.gameState?.actionContexts.ax_1?.judgeResolved).not.toBe(true);
    expect(current.gameState?.actionContexts.ax_1).toMatchObject({
      pendingLeaveInterceptReplacement: { stage: 'target-leave' },
    });
    const targetReplacement = current.pendingSetCardReplacement;
    expect(targetReplacement?.fromUid).toBe(host.uid);

    expect(dispatchEngineAction(bindPendingDecision(targetReplacement!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: true });
    current = useGameStateStore.getState();
    expect(current.gameState?.actionContexts.ax_1).toMatchObject({ judgeResolved: true });
    expect(current.gameState?.actionContexts.ax_1?.pendingLeaveInterceptReplacement).toBeUndefined();
    expect(current.gameState?.players.self.hand).toEqual(['KAITOU']);
  });

  it('keeps the guardian stage through two public B02052 answers, including hydration and stale retries', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const host = mutate.scene.enter(state, 'self', 'KAITOU', {});
    const fakeGuardian = mutate.scene.enter(state, 'self', 'KAITOU', {});
    mutate.scene.enter(state, 'self', 'KAITOU', {});
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);
    mutate.char.setCard(state, guardian.uid, B02052.id, true);
    mutate.char.setCard(state, host.uid, B02052.id, true);
    state.actionContextSeq = 1;
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: host.uid }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: host.uid, interceptorUid: guardian.uid },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);

    const leave = useGameStateStore.getState().pendingLeaveIntercept;
    expect(dispatchEngineAction(bindPendingDecision(leave!, {
      type: 'leaveInterceptResolve', accept: true,
    }))).toEqual({ ok: true });
    const guardianFirst = useGameStateStore.getState().pendingSetCardReplacement;
    expect(guardianFirst?.fromUid).toBe(guardian.uid);

    expect(dispatchEngineAction(bindPendingDecision(guardianFirst!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: true });
    let current = useGameStateStore.getState();
    const guardianSecond = current.pendingSetCardReplacement;
    expect(guardianSecond?.fromUid).toBe(guardian.uid);
    expect(guardianSecond?.decisionId).not.toBe(guardianFirst?.decisionId);
    expect(current.gameState?.actionContexts.ax_1?.pendingLeaveInterceptReplacement)
      .toMatchObject({ stage: 'interceptor-cost' });
    expect(current.gameState?.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(true);

    const beforeFirstRetry = current.gameState;
    expect(dispatchEngineAction(bindPendingDecision(guardianFirst!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeFirstRetry);
    expect(useGameStateStore.getState().pendingSetCardReplacement?.decisionId).toBe(guardianSecond?.decisionId);

    const forged = JSON.parse(JSON.stringify(current.gameState)) as GameState;
    for (const entry of forged.pendingRuntimeState?.snapshot ?? []) {
      if (entry.key === '__pendingSetCardReplacementSide' || entry.key === '__pendingSetCardReplacementGuard') {
        ((entry.value as { resume?: { cause?: string } }).resume ??= {}).cause = 'effect';
      }
    }
    resetPendingEffectSession();
    expect(() => useGameStateStore.getState().setGameState(forged))
      .toThrow(/guardian resume no longer matches its accepted contact cost/);

    const forgedNonInterceptor = JSON.parse(JSON.stringify(current.gameState)) as GameState;
    const forgedContact = forgedNonInterceptor.actionContexts.ax_1!.pendingLeaveInterceptReplacement!;
    forgedContact.interceptorUid = fakeGuardian.uid;
    forgedContact.interceptorCardId = 'KAITOU';
    forgedContact.interceptorAbilityId = 'a1';
    for (const entry of forgedNonInterceptor.pendingRuntimeState?.snapshot ?? []) {
      if (entry.key === '__pendingSetCardReplacementSide' || entry.key === '__pendingSetCardReplacementGuard') {
        (entry.value as { fromUid: string }).fromUid = fakeGuardian.uid;
      }
    }
    resetPendingEffectSession();
    expect(() => useGameStateStore.getState().setGameState(forgedNonInterceptor))
      .toThrow(/guardian resume no longer matches its accepted contact cost/);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(current.gameState)) as GameState);
    current = useGameStateStore.getState();
    const hydratedGuardianSecond = current.pendingSetCardReplacement;
    expect(hydratedGuardianSecond?.fromUid).toBe(guardian.uid);
    expect(current.gameState?.actionContexts.ax_1?.pendingLeaveInterceptReplacement)
      .toMatchObject({ stage: 'interceptor-cost' });

    const beforeHydratedRetry = current.gameState;
    expect(dispatchEngineAction(bindPendingDecision(guardianFirst!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeHydratedRetry);

    expect(dispatchEngineAction(bindPendingDecision(hydratedGuardianSecond!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: true });
    current = useGameStateStore.getState();
    const hostReplacement = current.pendingSetCardReplacement;
    expect(hostReplacement?.fromUid).toBe(host.uid);
    expect(current.gameState?.actionContexts.ax_1?.pendingLeaveInterceptReplacement)
      .toMatchObject({ stage: 'target-leave' });

    const forgedReturnedGuardian = JSON.parse(JSON.stringify(current.gameState)) as GameState;
    forgedReturnedGuardian.players.self.scene.push(makeChar({
      uid: guardian.uid, cardId: B01092.id, state: 'active',
    }));
    expect(() => useGameStateStore.getState().setGameState(forgedReturnedGuardian))
      .toThrow(/accepted interceptor cost must remain paid/);

    useGameStateStore.setState({ gameState: forgedReturnedGuardian });
    const beforeForgedResolve = useGameStateStore.getState().gameState;
    expect(dispatchEngineAction(bindPendingDecision(hostReplacement!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeForgedResolve);

    useGameStateStore.setState({ gameState: current.gameState });

    const beforeSecondRetry = current.gameState;
    expect(dispatchEngineAction(bindPendingDecision(hydratedGuardianSecond!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeSecondRetry);

    expect(dispatchEngineAction(bindPendingDecision(hostReplacement!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: true });
    current = useGameStateStore.getState();
    expect(current.gameState?.actionContexts.ax_1).toMatchObject({ judgeResolved: true });
    expect(current.gameState?.actionContexts.ax_1?.pendingLeaveInterceptReplacement).toBeUndefined();
  });

  it('does not finalize a target-leave contact from a same-uid wrong-card RemoveResult', () => {
    const { state, host } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: host.uid }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveInterceptReplacement: {
          targetUid: host.uid, targetCardId: 'KAITOU', interceptorUid: guardian.uid,
          byUid: 'attacker', accept: false, stage: 'target-leave',
        },
        startedAt: { turn: 2, nano: 1 },
      },
    };

    expect(contactFlow.finalizeLeaveInterceptReplacement(state, 'ax_1', {
      removed: { uid: host.uid, cardId: 'WRONG-CARD' },
      setCardsRemoved: [], stackedCardsRemoved: 0, triggeredHooks: [],
    })).toBe(false);
    expect(state.actionContexts.ax_1?.pendingLeaveInterceptReplacement).toBeDefined();
    expect(state.actionContexts.ax_1?.judgeResolved).not.toBe(true);
  });

  it('emits and drains contact:judge observers only after the exact target removal finalizes the contact', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const host = mutate.scene.enter(state, 'self', 'KAITOU', {});
    const replacementTarget = mutate.scene.enter(state, 'self', 'KAITOU', {});
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: host.uid }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: host.uid, interceptorUid: guardian.uid },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    const unsubscribe = event.on('contact:judge', () => ({
      kind: 'custom',
      fn: (draft: GameState) => {
        draft.players.self.hand.push(
          draft.actionContexts.ax_1?.judgeResolved === true ? 'JUDGE-FIRST' : 'OBSERVER-TOO-EARLY',
        );
      },
    }));
    try {
      useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
      const leave = useGameStateStore.getState().pendingLeaveIntercept;
      expect(dispatchEngineAction(bindPendingDecision(leave!, {
        type: 'leaveInterceptResolve', accept: true,
      }))).toEqual({ ok: true });
      const guardianReplacement = useGameStateStore.getState().pendingSetCardReplacement;
      expect(dispatchEngineAction(bindPendingDecision(guardianReplacement!, {
        type: 'setCardReplacementResolve', targetUid: replacementTarget.uid,
      }))).toEqual({ ok: true });

      const settled = useGameStateStore.getState().gameState!;
      expect(settled.actionContexts.ax_1).toMatchObject({ judgeResolved: true });
      expect(settled.players.self.hand).toContain('JUDGE-FIRST');
      expect(settled.players.self.hand).not.toContain('OBSERVER-TOO-EARLY');
      expect(settled.pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it('publicly finalizes the contact when only the guardian has B02052', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const host = mutate.scene.enter(state, 'self', 'KAITOU', {});
    const replacementTarget = mutate.scene.enter(state, 'self', 'KAITOU', {});
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);
    state.actionContextSeq = 1;
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: host.uid }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: host.uid, interceptorUid: guardian.uid },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const leave = useGameStateStore.getState().pendingLeaveIntercept;
    expect(dispatchEngineAction(bindPendingDecision(leave!, {
      type: 'leaveInterceptResolve', accept: true,
    }))).toEqual({ ok: true });
    const guardianReplacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(dispatchEngineAction(bindPendingDecision(guardianReplacement!, {
      type: 'setCardReplacementResolve', targetUid: replacementTarget.uid,
    }))).toEqual({ ok: true });
    const settled = useGameStateStore.getState().gameState!;
    expect(settled.actionContexts.ax_1).toMatchObject({ judgeResolved: true });
    expect(settled.actionContexts.ax_1?.pendingLeaveInterceptReplacement).toBeUndefined();
    expect(settled.players.self.hand).toEqual(['KAITOU']);
  });

  it('uses the exact target RemoveResult instead of a duplicate card already in hand', () => {
    const { state, host } = replacementChainState();
    state.players.self.hand.push('KAITOU');
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: host.uid }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: host.uid, interceptorUid: 'stale-ignored-on-decline' },
        startedAt: { turn: 2, nano: 1 },
      },
    };

    expect(contactFlow.resolveLeaveIntercept(state, state.actionContexts.ax_1!, false).deferred).toBe(true);
    const replacement = _drainPendingSetCardReplacementSide();
    expect(applySetCardReplacement(state, replacement!, null)).toBe(true);
    expect(state.actionContexts.ax_1).toMatchObject({ judgeResolved: true });
    expect(state.log.find((entry) => entry.action === 'contact-judge')?.result).toContain('HIT');
  });

  it.each(['first', 'last'] as const)('rejects a human B02052 batch when its host is %s, before any mutation', (position) => {
    const { state, host } = replacementChainState();
    const safe = mutate.scene.enter(state, 'self', 'KAITOU', {});
    const uids = position === 'first' ? [host.uid, safe.uid] : [safe.uid, host.uid];
    const before = JSON.parse(JSON.stringify(state));

    expect(() => mutate.scene.removeToRemoveBatch(state, uids, 'effect')).toThrow('unsupported-human-deferred-batch');
    expect(state).toEqual(before);
    expect(_drainPendingSetCardReplacementSide()).toBeNull();
  });

  it('keeps AI B02052 batches on their existing no-defer path', () => {
    const { state, host, replacementTarget } = replacementChainState();
    const safe = mutate.scene.enter(state, 'self', 'KAITOU', {});
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;

    expect(() => mutate.scene.removeToRemoveBatch(state, [host.uid, safe.uid], 'effect')).not.toThrow();
    expect(state.players.self.scene.map((char) => char.uid)).toEqual([replacementTarget.uid]);
    expect(state.players.self.scene[0]?.setCards).toMatchObject([{ cardId: B02052.id }]);
    expect(_drainPendingSetCardReplacementSide()).toBeNull();
  });

  it('continues from a declined guardian B02052 to a moved host B02052', () => {
    const { state, host, replacementTarget, pending } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);

    applyPickAndContinuation(state, pending, host.uid);
    const leaveChoice = _drainPendingEffectChoiceSide();
    expect(leaveChoice).not.toBeNull();
    applyChoiceAndContinuation(state, leaveChoice!, 0);

    const guardianReplacement = _drainPendingSetCardReplacementSide();
    expect(guardianReplacement?.fromUid).toBe(guardian.uid);
    expect(applySetCardReplacement(state, guardianReplacement!, null)).toBe(true);

    const hostReplacement = _drainPendingSetCardReplacementSide();
    expect(hostReplacement?.fromUid).toBe(host.uid);
    expect(applySetCardReplacement(state, hostReplacement!, replacementTarget.uid)).toBe(true);
    expect(state.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(false);
    expect(state.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(false);
    expect(state.players.self.remove).toEqual([B02052.id, B01092.id]);
    expect(state.players.self.scene.find((entry) => entry.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(state.players.self.hand).toEqual(['KAITOU']);
    expect(state.players.opp.hand).toEqual([]);
  });

  it('does not treat an absent guardian as an already-paid B01092 cost', () => {
    const { state, host, pending } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});

    applyPickAndContinuation(state, pending, host.uid);
    const leaveChoice = _drainPendingEffectChoiceSide();
    expect(leaveChoice).not.toBeNull();
    mutate.scene.removeToRemove(state, guardian.uid, 'cost');

    applyChoiceAndContinuation(state, leaveChoice!, 0);

    expect(state.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(true);
    expect(_drainPendingSetCardReplacementSide()).toBeNull();
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.opp.hand).toEqual([]);
  });

  it('publicly rejects an accepted leave redirect forged onto a non-interceptor guardian', () => {
    const state = patternAState();
    state.players.self.scene.push(makeChar({ uid: 'forged-guardian', cardId: 'KAITOU', state: 'active' }));
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: 'victim' }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: 'victim', bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: 'victim', interceptorUid: 'forged-guardian' },
        startedAt: { turn: 2, nano: 1 },
      },
    };

    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const pending = useGameStateStore.getState().pendingLeaveIntercept;
    const before = useGameStateStore.getState().gameState;
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'leaveInterceptResolve', accept: true,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
    expect(useGameStateStore.getState().gameState?.players.self.scene.map((char) => char.uid))
      .toEqual(['victim', 'guardian', 'forged-guardian']);
  });

  it.each([
    ['target', { targetUid: 'guardian' }],
    ['player', { player: 'opp' }],
  ] as const)('rejects a persisted leave-intercept forge of its contact %s', (_field, patch) => {
    const state = patternAState();
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: 'victim' }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: 'victim', bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: 'victim', interceptorUid: 'guardian' },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    const forged = JSON.parse(JSON.stringify(state)) as GameState;
    Object.assign(forged.actionContexts.ax_1!.pendingLeaveIntercept!, patch);

    expect(() => useGameStateStore.getState().setGameState(forged)).toThrow('Invalid pendingLeaveIntercept');
  });

  it.each([
    ['target', (pending: { targetUid: string; player: 'self' | 'opp' }) => { pending.targetUid = 'guardian'; }],
    ['player', (pending: { targetUid: string; player: 'self' | 'opp' }) => { pending.player = 'opp'; }],
  ] as const)('rejects a public decline whose stored leave %s no longer matches the contact', (_field, forgePending) => {
    const state = patternAState();
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: 'victim' }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: 'victim', bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: 'victim', interceptorUid: 'guardian' },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const pending = useGameStateStore.getState().pendingLeaveIntercept;
    const forged = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState)) as GameState;
    forgePending(forged.actionContexts.ax_1!.pendingLeaveIntercept!);
    useGameStateStore.setState({ gameState: forged });
    const before = useGameStateStore.getState().gameState;

    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'leaveInterceptResolve', accept: false,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('rejects a persisted replacement whose AP snapshot defender no longer owns the contact', () => {
    const { state, host } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: host.uid }, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: host.uid, interceptorUid: guardian.uid },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const leave = useGameStateStore.getState().pendingLeaveIntercept;
    expect(dispatchEngineAction(bindPendingDecision(leave!, {
      type: 'leaveInterceptResolve', accept: true,
    }))).toEqual({ ok: true });

    const forged = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState)) as GameState;
    forged.actionContexts.ax_1!.apSnapshot!.bUid = guardian.uid;

    expect(() => useGameStateStore.getState().setGameState(forged))
      .toThrow('Invalid pendingLeaveInterceptReplacement');
  });

  it('hydrates a guarded public leave replacement using the snapshot defender, not the declared target', () => {
    const { state, host } = replacementChainState();
    const declaredTarget = mutate.scene.enter(state, 'self', 'KAITOU', {});
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    state.actionContexts = {
      ax_1: {
        id: 'ax_1', byUid: 'attacker', byPlayer: 'opp', target: { kind: 'char', uid: declaredTarget.uid },
        guardUid: host.uid, phase: 'judge',
        apSnapshot: { aUid: 'attacker', aAP: 5000, bUid: host.uid, bAP: 1000 },
        pendingLeaveIntercept: { player: 'self', targetUid: host.uid, interceptorUid: guardian.uid },
        startedAt: { turn: 2, nano: 1 },
      },
    };
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const leave = useGameStateStore.getState().pendingLeaveIntercept;

    expect(dispatchEngineAction(bindPendingDecision(leave!, {
      type: 'leaveInterceptResolve', accept: true,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingSetCardReplacement?.fromUid).toBe(host.uid);

    const persisted = JSON.parse(JSON.stringify(useGameStateStore.getState().gameState)) as GameState;
    useGameStateStore.getState().setGameState(persisted);
    const replacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(replacement?.fromUid).toBe(host.uid);
    expect(dispatchEngineAction(bindPendingDecision(replacement!, {
      type: 'setCardReplacementResolve', targetUid: null,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.actionContexts.ax_1).toMatchObject({ judgeResolved: true });
  });

  it('surfaces one public replacement decision per physical B02052 before removing the host', () => {
    const {
      state,
      host,
      replacementTarget,
      replacementTargetTwo,
      pending,
    } = replacementChainState(2);

    applyPickAndContinuation(state, pending, host.uid);
    const first = _drainPendingSetCardReplacementSide();
    expect(first).not.toBeNull();
    expect(applySetCardReplacement(state, first!, replacementTarget.uid)).toBe(true);

    const second = _drainPendingSetCardReplacementSide();
    expect(second).not.toBeNull();
    expect(second?.setCardInstanceId).not.toBe(first?.setCardInstanceId);
    expect(state.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(true);
    expect(state.players.self.scene.find((entry) => entry.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(state.players.opp.hand).toEqual([]);

    expect(applySetCardReplacement(state, second!, replacementTargetTwo!.uid)).toBe(true);
    expect(state.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(false);
    expect(state.players.self.scene.find((entry) => entry.uid === replacementTargetTwo!.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(state.players.opp.hand).toEqual(['DRAW']);
    expect(_drainPendingSetCardReplacementSide()).toBeNull();
  });

  it('publishes and restores the B02052 prompt after a public leave-intercept acceptance', () => {
    const { state, host, replacementTarget, pending } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    applyPickAndContinuation(state, pending, host.uid);
    runAllUntilEmpty(state);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const leaveChoice = useGameStateStore.getState().pendingEffectChoice;
    expect(leaveChoice).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(leaveChoice!, {
      type: 'choiceResolve',
      choiceIndex: 0,
    }))).toEqual({ ok: true });

    const afterChoice = useGameStateStore.getState().gameState!;
    expect(useGameStateStore.getState().pendingSetCardReplacement).not.toBeNull();
    expect(afterChoice.players.self.scene.map((entry) => entry.uid)).toEqual([
      host.uid,
      replacementTarget.uid,
    ]);
    expect(afterChoice.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(false);
    expect(afterChoice.players.self.remove).toEqual([B01092.id]);
    expect(afterChoice.players.opp.hand).toEqual([]);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(
      JSON.parse(JSON.stringify(afterChoice)) as GameState,
    );
    const replacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(replacement).not.toBeNull();
    const hydrated = useGameStateStore.getState().gameState!;
    expect(hydrated.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(false);
    expect(hydrated.players.self.remove).toEqual([B01092.id]);
    expect(dispatchEngineAction(bindPendingDecision(replacement!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTarget.uid,
    }))).toEqual({ ok: true });

    const settled = useGameStateStore.getState();
    expect(settled.gameState?.players.self.hand).toEqual(['KAITOU']);
    expect(settled.gameState?.players.self.remove).toEqual([B01092.id]);
    expect(settled.gameState?.players.self.scene.find((entry) => entry.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(settled.gameState?.players.opp.hand).toEqual([]);
    expect(settled.pendingSetCardReplacement).toBeNull();
  });

  it('persists nested guardian and host B02052 decisions without accepting a stale public answer', () => {
    const { state, host, replacementTarget, pending } = replacementChainState();
    const guardian = mutate.scene.enter(state, 'self', B01092.id, {});
    mutate.char.setCard(state, guardian.uid, B02052.id, true);
    applyPickAndContinuation(state, pending, host.uid);
    runAllUntilEmpty(state);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const leaveChoice = useGameStateStore.getState().pendingEffectChoice;
    expect(leaveChoice).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(leaveChoice!, {
      type: 'choiceResolve',
      choiceIndex: 0,
    }))).toEqual({ ok: true });

    const guardianPromptState = useGameStateStore.getState().gameState!;
    const guardianReplacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(guardianReplacement?.fromUid).toBe(guardian.uid);
    expect(guardianPromptState.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(true);
    expect(guardianPromptState.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(true);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(
      JSON.parse(JSON.stringify(guardianPromptState)) as GameState,
    );
    const hydratedGuardianReplacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(hydratedGuardianReplacement?.fromUid).toBe(guardian.uid);
    expect(dispatchEngineAction(bindPendingDecision(hydratedGuardianReplacement!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTarget.uid,
    }))).toEqual({ ok: true });

    const hostPromptState = useGameStateStore.getState().gameState!;
    const hostReplacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(hostReplacement?.fromUid).toBe(host.uid);
    expect(hostReplacement?.decisionId).not.toBe(hydratedGuardianReplacement?.decisionId);
    expect(hostPromptState.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(false);
    expect(hostPromptState.players.self.remove).toContain(B01092.id);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(
      JSON.parse(JSON.stringify(hostPromptState)) as GameState,
    );
    const hydratedHostReplacement = useGameStateStore.getState().pendingSetCardReplacement;
    const beforeStaleRetry = useGameStateStore.getState().gameState;
    expect(dispatchEngineAction(bindPendingDecision(hydratedGuardianReplacement!, {
      type: 'setCardReplacementResolve',
      targetUid: null,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeStaleRetry);
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(hydratedHostReplacement);

    expect(dispatchEngineAction(bindPendingDecision(hydratedHostReplacement!, {
      type: 'setCardReplacementResolve',
      targetUid: null,
    }))).toEqual({ ok: true });
    const settled = useGameStateStore.getState();
    expect(settled.gameState?.players.self.scene.some((entry) => entry.uid === guardian.uid)).toBe(false);
    expect(settled.gameState?.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(false);
    expect(settled.gameState?.players.self.hand).toEqual(['KAITOU']);
    expect(settled.gameState?.players.self.remove).toEqual([B01092.id, B02052.id]);
    expect(settled.gameState?.players.opp.hand).toEqual([]);
    expect(settled.pendingSetCardReplacement).toBeNull();
  });

  it('publishes a new decision for the second B02052 and rejects reuse of the first', () => {
    const {
      state,
      host,
      replacementTarget,
      replacementTargetTwo,
      pending,
    } = replacementChainState(2);
    applyPickAndContinuation(state, pending, host.uid);
    runAllUntilEmpty(state);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const first = useGameStateStore.getState().pendingSetCardReplacement;
    expect(first).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(first!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTarget.uid,
    }))).toEqual({ ok: true });

    const second = useGameStateStore.getState().pendingSetCardReplacement;
    expect(second).not.toBeNull();
    expect(second?.decisionId).not.toBe(first?.decisionId);
    expect(second?.setCardInstanceId).not.toBe(first?.setCardInstanceId);
    const beforeStaleRetry = useGameStateStore.getState().gameState;
    expect(dispatchEngineAction(bindPendingDecision(first!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTargetTwo!.uid,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeStaleRetry);
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(second);

    expect(dispatchEngineAction(bindPendingDecision(second!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTargetTwo!.uid,
    }))).toEqual({ ok: true });
    const settled = useGameStateStore.getState();
    expect(settled.gameState?.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(false);
    expect(settled.gameState?.players.self.scene.find((entry) => entry.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(settled.gameState?.players.self.scene.find((entry) => entry.uid === replacementTargetTwo!.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(settled.gameState?.players.opp.hand).toEqual(['DRAW']);
    expect(settled.pendingSetCardReplacement).toBeNull();
  });

  it('keeps the chain gated when the replacement resumes an MR redirect', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const host = mutate.scene.enter(state, 'self', 'MR-KAITOU', {});
    const replacementTarget = mutate.scene.enter(state, 'self', 'KAITOU', {});
    mutate.char.setCard(state, host.uid, B02052.id, true);
    state.players.opp.deck = ['DRAW'];
    const pending = sceneRemovePick('MR-KAITOU');
    pending.candidates = [{ kind: 'char', uid: host.uid, cardId: 'MR-KAITOU', player: 'self' }];

    applyPickAndContinuation(state, pending, host.uid);
    const replacement = _drainPendingSetCardReplacementSide();
    expect(replacement).not.toBeNull();
    expect(applySetCardReplacement(state, replacement!, replacementTarget.uid)).toBe(true);

    expect(state.players.self.partnerAreaMR?.cardId).toBe('MR-KAITOU');
    expect(state.players.self.remove).not.toContain('MR-KAITOU');
    expect(state.players.opp.hand).toEqual([]);
  });

  it('hydrates a public B02052 answer into an MR redirect without resuming the chain tail', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const host = mutate.scene.enter(state, 'self', 'MR-KAITOU', {});
    const replacementTarget = mutate.scene.enter(state, 'self', 'KAITOU', {});
    mutate.char.setCard(state, host.uid, B02052.id, true);
    state.players.opp.deck = ['DRAW'];
    const pending = sceneRemovePick('MR-KAITOU');
    pending.candidates = [{ kind: 'char', uid: host.uid, cardId: 'MR-KAITOU', player: 'self' }];

    applyPickAndContinuation(state, pending, host.uid);
    runAllUntilEmpty(state);
    expect(state.pendingRuntimeState?.snapshot.some((entry) =>
      entry.key === '__pendingSetCardReplacementContinuation' && entry.present)).toBe(true);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const replacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(replacement).not.toBeNull();

    expect(dispatchEngineAction(bindPendingDecision(replacement!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTarget.uid,
    }))).toEqual({ ok: true });

    const settled = useGameStateStore.getState();
    expect(settled.gameState?.players.self.partnerAreaMR?.cardId).toBe('MR-KAITOU');
    expect(settled.gameState?.players.self.scene.some((entry) => entry.uid === host.uid)).toBe(false);
    expect(settled.gameState?.players.self.remove).not.toContain('MR-KAITOU');
    expect(settled.gameState?.players.self.scene.find((entry) => entry.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(settled.gameState?.players.opp.hand).toEqual([]);
    expect(settled.gameState?.pendingRuntimeState).toBeUndefined();
    expect(settled.pendingSetCardReplacement).toBeNull();

    const beforeStaleRetry = settled.gameState;
    expect(dispatchEngineAction(bindPendingDecision(replacement!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTarget.uid,
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeStaleRetry);
  });

  it('persists the replacement continuation and resumes it through the public dispatcher', () => {
    const { state, host, replacementTarget, pending } = replacementChainState();
    applyPickAndContinuation(state, pending, host.uid);
    runAllUntilEmpty(state);

    expect(state.pendingRuntimeState?.snapshot.some((entry) =>
      entry.key === '__pendingSetCardReplacementContinuation' && entry.present)).toBe(true);
    expect(state.players.opp.hand).toEqual([]);

    resetPendingEffectSession();
    useGameStateStore.getState().setGameState(JSON.parse(JSON.stringify(state)) as GameState);
    const replacement = useGameStateStore.getState().pendingSetCardReplacement;
    expect(replacement).not.toBeNull();
    expect(replacement).not.toHaveProperty('continuation');
    const beforeRejectedAnswer = useGameStateStore.getState().gameState;
    expect(dispatchEngineAction(bindPendingDecision(replacement!, {
      type: 'setCardReplacementResolve',
      targetUid: 'forged-target',
    }))).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toBe(beforeRejectedAnswer);
    expect(useGameStateStore.getState().pendingSetCardReplacement).toBe(replacement);
    expect(beforeRejectedAnswer?.players.opp.hand).toEqual([]);
    expect(beforeRejectedAnswer?.pendingRuntimeState?.snapshot.some((entry) =>
      entry.key === '__pendingSetCardReplacementContinuation' && entry.present)).toBe(true);

    expect(dispatchEngineAction(bindPendingDecision(replacement!, {
      type: 'setCardReplacementResolve',
      targetUid: replacementTarget.uid,
    }))).toEqual({ ok: true });

    const resumed = useGameStateStore.getState();
    expect(resumed.gameState?.players.self.scene.some((card) => card.uid === host.uid)).toBe(false);
    expect(resumed.gameState?.players.self.scene.find((card) => card.uid === replacementTarget.uid)?.setCards)
      .toMatchObject([{ cardId: B02052.id }]);
    expect(resumed.gameState?.players.opp.hand).toEqual(['DRAW']);
    expect(resumed.gameState?.pendingRuntimeState).toBeUndefined();
    expect(resumed.pendingSetCardReplacement).toBeNull();
  });
});
