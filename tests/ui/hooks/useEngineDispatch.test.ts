// Phase 8 Task 8.1: useEngineDispatch / dispatchEngineAction
//
// rules: 05-turn-phases.md (メインフェイズ), 11-reasoning.md, 12-next-hint.md,
//        21-declared-ability-cost.md
//
// 仕様:
//   - dispatchEngineAction(action) は engine.flow の対応関数を呼び、結果を store に反映
//   - gameState が null のとき: { ok:false, reason:'no-state' } を返し engine 関数は呼ばれない
//   - canX 判定が false のとき: { ok:false, reason:'not-allowed' } を返し state 不変
//   - engine が throw した場合: { ok:false, reason:'engine-error', detail:... }
//   - Immer の produce 経由で書込 — gameState 参照が更新され、未変更スライスは共有

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  dispatchEngineAction,
  useEngineDispatch,
} from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { FILE_CARD_BACK_PLACEHOLDER } from '@/engine/types/game-state';
import * as flow from '@/engine/flow';
import type {
  GameState,
  FileCard,
  SceneCharacter,
} from '@/engine/types/game-state';
import type { EffectStackEntry } from '@/engine/types/effect-stack';
import { makeChar as baseChar } from '../../helpers/fixtures';
import { register as engineRegisterCardDef } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { appendCausal, isCausalLogEntry, startCausalSession } from '@/engine/log/causal';
import { snapshotPendingRuntimeState } from '@/engine/effect/runtime-state';
import { currentPresentationSessionId, getPresentationQueue, resetPresentationQueue } from '@/ui/presentation/coordinator';
import {
  beginMatchSession,
  currentMatchSessionToken,
  endMatchSession,
  isMatchSessionActive,
  matchSessionId,
} from '@/ui/services/matchSession';
import { isReplayOwnedState, markReplayOwnedState } from '@/ui/services/replayOwnership';
import { usePresentationStore } from '@/ui/presentation/store';
import {
  checkpointLiveReplayRecording,
  discardLiveReplayRecording,
  finalizeLiveReplayRecording,
  getFinalizedReplay,
} from '@/ui/services/liveReplayRecorder';

// ---- fixtures ----

function withMainPhase(s: GameState): GameState {
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

function withSelfPartnerActive(s: GameState): GameState {
  s.players.self.partner = { cardId: '', state: 'active', location: 'partner-area' };
  return s;
}

function makeChar(uid: string, cardId = 'cX'): SceneCharacter {
  return baseChar({ cardId, uid, enterOrder: 0 });
}

function makePendingEffect(id: string, state: EffectStackEntry['state']): EffectStackEntry {
  return {
    id,
    source: {
      player: 'self',
      cardId: 'surrender-test-card',
      abilityId: 'surrender-test-ability',
    },
    triggeredBy: { hook: 'surrender-test' },
    triggeredAt: { turn: 1, phase: 'main', nano: id === 'pending' ? 1 : 2 },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    state,
  };
}

function snapshotRejectedConcedeState() {
  const queue = getPresentationQueue();
  const store = useGameStateStore.getState();
  const humanRoot = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
  return {
    store: { ...store },
    runtime: snapshotPendingRuntimeState(),
    presentation: {
      sessionId: currentPresentationSessionId(),
      epoch: queue.currentEpoch(),
      revision: queue.revision(),
      outstanding: queue.outstandingCount(),
      items: queue.items(),
      controls: { ...usePresentationStore.getState() },
    },
    authority: {
      sessionActive: isMatchSessionActive(),
      sessionToken: currentMatchSessionToken(),
      humanRegistered: Object.prototype.hasOwnProperty.call(humanRoot, '__humanPlayerSide'),
      humanSide: humanRoot.__humanPlayerSide,
      replayOwned: isReplayOwnedState(store.gameState),
    },
  };
}

function expectRejectedConcedeState(before: ReturnType<typeof snapshotRejectedConcedeState>) {
  expect({ ...useGameStateStore.getState() }).toEqual(before.store);
  expect(useGameStateStore.getState().gameState).toBe(before.store.gameState);
  expect(snapshotPendingRuntimeState()).toEqual(before.runtime);
  const queue = getPresentationQueue();
  expect({
    sessionId: currentPresentationSessionId(),
    epoch: queue.currentEpoch(),
    revision: queue.revision(),
    outstanding: queue.outstandingCount(),
    items: queue.items(),
    controls: { ...usePresentationStore.getState() },
  }).toEqual(before.presentation);
  const humanRoot = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };
  expect({
    sessionActive: isMatchSessionActive(),
    sessionToken: currentMatchSessionToken(),
    humanRegistered: Object.prototype.hasOwnProperty.call(humanRoot, '__humanPlayerSide'),
    humanSide: humanRoot.__humanPlayerSide,
    replayOwned: isReplayOwnedState(useGameStateStore.getState().gameState),
  }).toEqual(before.authority);
}

// ---- tests ----

describe('dispatchEngineAction (pure function)', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useTargetPickerStore.getState()._reset();
    vi.restoreAllMocks();
  });

  describe('happy paths', () => {
    it('reasoning: sleeps active partner and appends a reasoning log entry', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result.ok).toBe(true);

      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.partner.state).toBe('sleep');
      expect(after.log.at(-1)?.action).toBe('reasoning');
    });

    it('handUseCard: sets turnState.handUseUsed and appends a handUseCard log', () => {
      const init = withMainPhase(createEmptyGameState());
      init.players.self.hand = ['X'];
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({
        type: 'handUseCard',
        player: 'self',
        cardId: 'X',
      });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.turnState.self.handUseUsed).toBe(true);
      expect(after.log.at(-1)?.action).toBe('handUseCard');
      expect(after.log.at(-1)?.target).toBe('X');
    });

    it('nextHint: pops FILE top to hand and flags nextHintUsed (Round 3: 実 cardId)', () => {
      const init = withMainPhase(createEmptyGameState());
      // Round 3: FileCard.card-back に cardId 必須化、ネクストヒントで実 cardId が手札に渡る
      const fb1: FileCard = { type: 'card-back', cardId: 'FILE_A' };
      const fb2: FileCard = { type: 'card-back', cardId: 'FILE_B' };
      const fb3: FileCard = { type: 'card-back', cardId: 'FILE_C' };
      init.players.self.file = [fb1, fb2, fb3];
      const handBefore = init.players.self.hand.length;
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({ type: 'nextHint', player: 'self' });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.players.self.file.length).toBe(2);
      expect(after.players.self.hand.length).toBe(handBefore + 1);
      // Round 3: 旧 FILE_CARD_BACK_PLACEHOLDER → 実 cardId (popTop は末尾 = FILE_C を返す)
      expect(after.players.self.hand.at(-1)).toBe('FILE_C');
      expect(after.turnState.self.nextHintUsed).toBe(true);
    });

    it('partnerAbility: appends a partnerAbility log entry', () => {
      const init = withMainPhase(createEmptyGameState());
      init.players.self.partner = { cardId: 'P1', state: 'active', location: 'partner-area' };
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({
        type: 'partnerAbility',
        player: 'self',
        abilId: 'A1',
      });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.log.at(-1)?.action).toBe('partnerAbility');
      expect(after.log.at(-1)?.target).toBe('A1');
    });

    it('declaredAbility: increments declaredUseCount and appends log', () => {
      // W6 step11: canDeclaredAbility の fail-closed 化に伴い、実カード同様 declared ability を持つ
      // def を登録する (旧「def 未登録でも true 素通り」前提の pin を更新)。
      engineRegisterCardDef({
        id: 'cX', no: 'cX', kind: 'character', names: ['cX'], colors: ['赤'], level: 3, ap: 3000, lp: 1,
        traits: [], keywords: [], rarity: 'C', imageUrl: '', ruleRefs: [],
        abilities: [{ id: 'A1', type: 'declared', scope: 'on-scene', effect: { kind: 'atom', verb: 'noop', args: {} }, description: 'test', ruleRefs: [] }],
      } as never);
      const init = withMainPhase(createEmptyGameState());
      init.players.self.scene = [makeChar('c1')];
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({
        type: 'declaredAbility',
        uid: 'c1',
        abilId: 'A1',
      });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(readChar.declaredUseCount(after, 'c1', 'A1')).toBe(1);
      expect(after.log.at(-1)?.action).toBe('declaredAbility');
    });

    it('endTurn: swaps turn.player, increments turn.number, advances to next player main phase (Round 2)', () => {
      // Round 2 修正前: endTurn のみ呼出 → phase='end' で stuck (= ターン終了 button 永続 disabled
      //   の root cause)。本 test は旧仕様で phase='end' を assert していたが、
      //   修正後は startTurn(nextPlayer) が連続実行され phase='main' に遷移する。
      const init = createEmptyGameState();
      init.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      // startTurn 内の runAutoPhase は deck から 1 枚 draw + FILE に 2 枚配置するため、
      // 最低 3 枚の opp deck が必要 (engine.flow.runAutoPhase 仕様)。
      init.players.opp.deck.push({ cardId: 'D11003', faceUp: false });
      init.players.opp.deck.push({ cardId: 'D11003', faceUp: false });
      init.players.opp.deck.push({ cardId: 'D11003', faceUp: false });
      useGameStateStore.setState({ gameState: init });

      const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });
      expect(result.ok).toBe(true);
      const after = useGameStateStore.getState().gameState!;
      expect(after.turn.player).toBe('opp');
      expect(after.turn.number).toBe(4);
      // Round 2: phase は next player の main に遷移済
      expect(after.turn.phase).toBe('main');
    });
  });

  describe('negative paths', () => {
    it('commits a live registered human surrender while an action context is pending', () => {
      const token = beginMatchSession('self');
      const init = withMainPhase(createEmptyGameState());
      startCausalSession(init, matchSessionId(token));
      init.pendingEffects = [
        makePendingEffect('pending', 'pending'),
        makePendingEffect('resolving', 'resolving'),
      ];
      init.pendingTurnTransition = {
        endingPlayer: 'self',
        stage: 'after-end-start',
        startNextTurn: true,
      };
      init.pendingReasoningContinuation = { token: 7, uid: 'reasoner:self', player: 'self' };
      init.pendingRuntimeState = {
        token: 1,
        snapshot: [
          { key: '__pendingContactStartAxId', present: true, value: 'ax_1' },
          {
            key: '__pendingDeckRevealSide',
            present: true,
            value: {
              player: 'self', visibility: 'public', viewer: 'all',
              revealed: ['D08001'], matched: null, presentation: 'reveal-return',
            },
          },
          {
            key: '__pendingPublicHandRevealSide',
            present: true,
            value: {
              owner: 'self', audience: 'all', cardIds: ['D08001'], handSnapshot: ['D08001'],
              lifetime: 'presentation', resolutionToken: 'public-hand-reveal:1',
              source: { cardId: 'surrender-test-card', abilityId: 'surrender-test-ability' },
            },
          },
        ],
      };
      init.actionContexts = {
        ax_1: {
          id: 'ax_1', byUid: 'partner:self', byPlayer: 'self',
          target: { kind: 'case', player: 'opp' }, phase: 'guard-window',
          startedAt: { turn: 1, nano: 1 },
        },
      };
      const causalCountBefore = init.log.length;
      useGameStateStore.getState().setGameState(init);
      const completedDeckReveal = useGameStateStore.getState().pendingDeckReveal;
      const presentationHandReveal = useGameStateStore.getState().pendingPublicHandReveal;
      expect(completedDeckReveal).not.toBeNull();
      expect(presentationHandReveal).not.toBeNull();
      useGameStateStore.setState({
        activeActionId: 'ax_1',
        pendingEffectPick: {} as never,
      });

      let ended = false;
      const sessionId = matchSessionId(token);
      try {
        expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token })).toEqual({ ok: true });
        const terminal = useGameStateStore.getState().gameState!;
        expect(terminal.gameResult).toEqual({ winner: 'opp', reason: 'concede' });
        expect(terminal.actionContexts).toEqual({});
        expect(terminal.pendingEffects.map(({ id, state }) => ({ id, state }))).toEqual([
          { id: 'pending', state: 'cancelled' },
          { id: 'resolving', state: 'cancelled' },
        ]);
        expect(terminal.pendingTurnTransition).toBeUndefined();
        expect(terminal.pendingRuntimeState).toBeUndefined();
        expect(terminal.pendingReasoningContinuation).toBeUndefined();
        expect(terminal.log.at(-1)).toMatchObject({
          kind: 'game-result',
          actor: 'opp', source: { kind: 'player', side: 'opp' },
          targets: [{ kind: 'player', side: 'self' }],
        });
        expect(terminal.log).toHaveLength(causalCountBefore + 1);
        expect(terminal.log.filter(isCausalLogEntry).filter(({ kind }) => kind === 'game-result'))
          .toHaveLength(1);
        expect(useGameStateStore.getState().activeActionId).toBeNull();
        expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
        expect(useGameStateStore.getState().pendingDeckReveal).toBe(completedDeckReveal);
        expect(useGameStateStore.getState().pendingPublicHandReveal).toBe(presentationHandReveal);
        expect(dispatchEngineAction({ type: 'actionAdvance', actionId: 'ax_1' }))
          .toEqual({ ok: false, reason: 'not-allowed' });
        expect(useGameStateStore.getState().gameState).toBe(terminal);
        endMatchSession({ preserveGameState: true });
        ended = true;
        const replay = getFinalizedReplay(sessionId);
        expect(replay?.result).toEqual({ winner: 'opp', reason: 'concede', turns: 1 });
        expect(replay?.frames).toHaveLength(1);
        discardLiveReplayRecording(sessionId);
      } finally {
        if (!ended) endMatchSession();
      }
    });

    it('rolls back a terminal publish when a Zustand subscriber throws once', () => {
      const token = beginMatchSession('self');
      const init = withMainPhase(createEmptyGameState());
      startCausalSession(init, matchSessionId(token));
      init.pendingEffects = [makePendingEffect('pending', 'pending')];
      init.pendingRuntimeState = {
        token: 1,
        snapshot: [{ key: '__pendingContactStartAxId', present: true, value: 'ambient-action' }],
      };
      useGameStateStore.getState().setGameState(init);
      useGameStateStore.setState({
        activeActionId: 'ambient-action',
        activeCardUid: 'active-card',
        activeCardLabel: 'Active Card',
        pendingDecisionSeq: 41,
        pendingEffectPick: {} as never,
      });
      const before = snapshotRejectedConcedeState();
      let throwOnce = true;
      let unsubscribe: (() => void) | null = useGameStateStore.subscribe(() => {
        if (!throwOnce) return;
        throwOnce = false;
        throw new Error('one-shot terminal subscriber failure');
      });

      try {
        expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token }))
          .toEqual({
            ok: false,
            reason: 'engine-error',
            detail: 'one-shot terminal subscriber failure',
          });
        expectRejectedConcedeState(before);
        unsubscribe();
        unsubscribe = null;
        const sessionId = matchSessionId(token);
        expect(finalizeLiveReplayRecording(sessionId)).toBe(false);
        expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token }))
          .toEqual({ ok: true });
        endMatchSession({ preserveGameState: true });
        const replay = getFinalizedReplay(sessionId);
        expect(replay?.result).toEqual({ winner: 'opp', reason: 'concede', turns: 1 });
        expect(replay?.frames).toHaveLength(1);
        expect(replay?.frames[0]?.causalEventIds).toEqual([`${sessionId}:1`]);
        discardLiveReplayRecording(sessionId);
      } finally {
        unsubscribe?.();
        if (isMatchSessionActive()) endMatchSession();
      }
    });

    it('does not restore stale runtime when a failed concession starts a replacement session', () => {
      const token = beginMatchSession('self');
      const init = withMainPhase(createEmptyGameState());
      startCausalSession(init, matchSessionId(token));
      init.pendingRuntimeState = {
        token: 41,
        snapshot: [{ key: '__pendingContactStartAxId', present: true, value: 'old-session' }],
      };
      useGameStateStore.getState().setGameState(init);
      let replacementToken: ReturnType<typeof beginMatchSession> | null = null;
      let replacement: GameState | null = null;
      let replacementRuntime: ReturnType<typeof snapshotPendingRuntimeState> | null = null;
      let replaceOnce = true;
      const unsubscribe = useGameStateStore.subscribe((state) => {
        if (!replaceOnce || state.gameState?.gameResult === undefined) return;
        replaceOnce = false;
        replacementToken = beginMatchSession('self');
        replacement = withMainPhase(createEmptyGameState());
        startCausalSession(replacement, matchSessionId(replacementToken));
        replacement.pendingRuntimeState = {
          token: 42,
          snapshot: [{ key: '__pendingContactStartAxId', present: true, value: 'new-session' }],
        };
        useGameStateStore.getState().setGameState(replacement);
        replacementRuntime = snapshotPendingRuntimeState();
        throw new Error('concede subscriber replaced session');
      });

      try {
        expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token }))
          .toEqual({
            ok: false,
            reason: 'engine-error',
            detail: 'concede subscriber replaced session',
          });
        expect(replacementToken).not.toBeNull();
        expect(currentMatchSessionToken()).toBe(replacementToken);
        expect(useGameStateStore.getState().gameState).toBe(replacement);
        expect(snapshotPendingRuntimeState()).toEqual(replacementRuntime);
      } finally {
        unsubscribe();
        if (isMatchSessionActive()) endMatchSession();
      }
    });

    it('keeps a legitimate same-session publication made while concession rolls back', () => {
      const token = beginMatchSession('self');
      const init = withMainPhase(createEmptyGameState());
      startCausalSession(init, matchSessionId(token));
      useGameStateStore.getState().setGameState(init);
      const storeBefore = useGameStateStore.getState();
      const replayBefore = checkpointLiveReplayRecording();
      const nested = { ...init, turn: { ...init.turn, number: init.turn.number + 1 } };
      let nestedPublished = false;
      const nestedUnsubscribe = useGameStateStore.subscribe((state) => {
        if (nestedPublished || state !== storeBefore) return;
        nestedPublished = true;
        useGameStateStore.getState().setGameState(nested);
      });
      const failingUnsubscribe = useGameStateStore.subscribe((state) => {
        if (state.gameState?.gameResult !== undefined) {
          throw new Error('concede terminal publish failure');
        }
      });

      try {
        expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token }))
          .toEqual({
            ok: false,
            reason: 'engine-error',
            detail: 'concede terminal publish failure',
          });
        expect(nestedPublished).toBe(true);
        expect(useGameStateStore.getState().gameState).toBe(nested);
        expect(checkpointLiveReplayRecording()?.statesLength)
          .toBe((replayBefore?.statesLength ?? 0) + 1);
      } finally {
        failingUnsubscribe();
        nestedUnsubscribe();
        if (isMatchSessionActive()) endMatchSession();
      }
    });

    it('keeps same-GameState UI and runtime published while concession rolls back', () => {
      const token = beginMatchSession('self');
      const init = withMainPhase(createEmptyGameState());
      startCausalSession(init, matchSessionId(token));
      useGameStateStore.getState().setGameState(init);
      const storeBefore = useGameStateStore.getState();
      const runtime = globalThis as { __pendingContactStartAxId?: string };
      let nestedRuntime: ReturnType<typeof snapshotPendingRuntimeState> | null = null;
      let nestedPublished = false;
      const nestedUnsubscribe = useGameStateStore.subscribe((state) => {
        if (nestedPublished || state !== storeBefore) return;
        nestedPublished = true;
        useGameStateStore.getState().setActiveCard('nested-concede-card', 'nested concede');
        runtime.__pendingContactStartAxId = 'nested-concede-runtime';
        nestedRuntime = snapshotPendingRuntimeState();
      });
      const failingUnsubscribe = useGameStateStore.subscribe((state) => {
        if (state.gameState?.gameResult !== undefined) {
          throw new Error('concede same-state publish failure');
        }
      });

      try {
        expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token }))
          .toEqual({
            ok: false,
            reason: 'engine-error',
            detail: 'concede same-state publish failure',
          });
        expect(useGameStateStore.getState()).toMatchObject({
          gameState: init,
          activeCardUid: 'nested-concede-card',
          activeCardLabel: 'nested concede',
        });
        expect(snapshotPendingRuntimeState()).toEqual(nestedRuntime);
      } finally {
        failingUnsubscribe();
        nestedUnsubscribe();
        if (isMatchSessionActive()) endMatchSession();
        delete runtime.__pendingContactStartAxId;
      }
    });

    it('rejects concession outside strict live-human authority without mutation', () => {
      const assertRejected = (action: Parameters<typeof dispatchEngineAction>[0]) => {
        const before = snapshotRejectedConcedeState();
        expect(dispatchEngineAction(action)).toEqual({ ok: false, reason: 'not-allowed' });
        expectRejectedConcedeState(before);
      };

      const inactiveToken = beginMatchSession('self');
      useGameStateStore.getState().setGameState(withMainPhase(createEmptyGameState()));
      endMatchSession({ preserveGameState: true });
      assertRejected({ type: 'concede', player: 'self', sessionToken: inactiveToken });

      const missingToken = beginMatchSession('self');
      useGameStateStore.getState().setGameState(withMainPhase(createEmptyGameState()));
      delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
      assertRejected({ type: 'concede', player: 'self', sessionToken: missingToken });
      endMatchSession();

      const nullHumanToken = beginMatchSession(null);
      useGameStateStore.getState().setGameState(withMainPhase(createEmptyGameState()));
      assertRejected({ type: 'concede', player: 'self', sessionToken: nullHumanToken });
      endMatchSession();

      const staleToken = beginMatchSession('self');
      const currentToken = beginMatchSession('self');
      useGameStateStore.getState().setGameState(withMainPhase(createEmptyGameState()));
      assertRejected({ type: 'concede', player: 'self', sessionToken: staleToken });
      useGameStateStore.setState({ spectatorMode: true });
      assertRejected({ type: 'concede', player: 'self', sessionToken: currentToken });
      useGameStateStore.setState({ spectatorMode: false });
      assertRejected({ type: 'concede', player: 'opp', sessionToken: currentToken });
      const terminal = withMainPhase(createEmptyGameState());
      terminal.gameResult = { winner: 'opp', reason: 'concede' };
      useGameStateStore.getState().setGameState(terminal);
      assertRejected({ type: 'concede', player: 'self', sessionToken: currentToken });
      endMatchSession();
    });

    it('rejects pre-commit and replay concession without mutation', () => {
      const noStateBefore = snapshotRejectedConcedeState();
      expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: 0 as never }))
        .toEqual({ ok: false, reason: 'no-state' });
      expectRejectedConcedeState(noStateBefore);

      const token = beginMatchSession('self');
      const replay = withMainPhase(createEmptyGameState());
      markReplayOwnedState(replay);
      useGameStateStore.getState().setReplayGameState(replay);
      const replayBefore = snapshotRejectedConcedeState();
      expect(dispatchEngineAction({ type: 'concede', player: 'self', sessionToken: token }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      expectRejectedConcedeState(replayBefore);
      endMatchSession();
    });

    it('no-state: returns { ok:false, reason:"no-state" } and does not call engine', () => {
      const spy = vi.spyOn(flow, 'doReasoning');
      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result).toEqual({ ok: false, reason: 'no-state' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('reasoning on sleeping partner: returns not-allowed and state unchanged', () => {
      const init = withMainPhase(createEmptyGameState());
      init.players.self.partner = { cardId: '', state: 'sleep', location: 'partner-area' };
      useGameStateStore.setState({ gameState: init });
      const before = useGameStateStore.getState().gameState;

      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not-allowed');
      expect(useGameStateStore.getState().gameState).toBe(before);
    });

    it('endTurn when phase=auto: returns not-allowed', () => {
      const init = createEmptyGameState();
      init.turn = { number: 1, player: 'self', phase: 'auto', isFirstPlayerFirstTurn: false };
      useGameStateStore.setState({ gameState: init });
      const before = useGameStateStore.getState().gameState;

      const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not-allowed');
      expect(useGameStateStore.getState().gameState).toBe(before);
    });

    it('endTurn by non-turn player: returns not-allowed', () => {
      const init = withMainPhase(createEmptyGameState());
      useGameStateStore.setState({ gameState: init });
      const result = dispatchEngineAction({ type: 'endTurn', player: 'opp' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('not-allowed');
    });

    it('direct endTurn dispatch is rejected while an action picker is unresolved', () => {
      const init = withMainPhase(createEmptyGameState());
      useGameStateStore.setState({ gameState: init });
      useTargetPickerStore.getState()._setPhase({
        phase: 'picking',
        candidates: ['self-1'],
        purpose: 'action:source',
      });

      const result = dispatchEngineAction({ type: 'endTurn', player: 'self' });

      expect(result).toEqual({ ok: false, reason: 'not-allowed' });
      expect(useGameStateStore.getState().gameState!.turn.player).toBe('self');
    });

    it('engine throw: captured as { ok:false, reason:"engine-error", detail }', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });

      vi.spyOn(flow, 'doReasoning').mockImplementation(() => {
        throw new Error('boom');
      });

      const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('engine-error');
        expect(result.detail).toMatch(/boom/);
      }
    });

    it('rejects a malformed presentation commit without advancing UI surfaces or runtime', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      startCausalSession(init, 'dispatch-validation');
      resetPresentationQueue('dispatch-validation');
      appendCausal(init, {
        actor: 'self',
        kind: 'use',
        targets: [],
        outcome: { type: 'none' },
      });
      useGameStateStore.getState().setGameState(init);

      const runtime = globalThis as { __pendingContactStartAxId?: string };
      runtime.__pendingContactStartAxId = 'runtime-before';
      const stateBefore = useGameStateStore.getState().gameState;
      const surfaceBefore = useGameStateStore.getState().activeActionId;
      const runtimeBefore = snapshotPendingRuntimeState();

      vi.spyOn(flow, 'doReasoning').mockImplementation((draft) => {
        appendCausal(draft, {
          actor: 'self',
          kind: 'draw',
          targets: [],
          outcome: { type: 'none' },
        });
        (draft.log.at(-1) as { parentEventId?: string }).parentEventId = 'dispatch-validation:999';
        runtime.__pendingContactStartAxId = 'runtime-after';
      });

      try {
        const result = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBe('engine-error');
          expect(result.detail).toMatch(/presentation|parent|missing|edge/i);
        }
        expect(useGameStateStore.getState().gameState).toBe(stateBefore);
        expect(useGameStateStore.getState().activeActionId).toBe(surfaceBefore);
        expect(snapshotPendingRuntimeState()).toEqual(runtimeBefore);
      } finally {
        delete runtime.__pendingContactStartAxId;
        useGameStateStore.setState({ activeActionId: null });
      }
    });
  });

  describe('Immer integration', () => {
    it('produces a new top-level reference after a successful dispatch', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });
      const before = useGameStateStore.getState().gameState;

      dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      const after = useGameStateStore.getState().gameState;
      expect(after).not.toBe(before);
    });

    it('unchanged slice (opp) keeps the same reference (structural sharing)', () => {
      const init = withMainPhase(withSelfPartnerActive(createEmptyGameState()));
      useGameStateStore.setState({ gameState: init });
      const oppBefore = useGameStateStore.getState().gameState!.players.opp;

      dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
      const oppAfter = useGameStateStore.getState().gameState!.players.opp;
      expect(oppAfter).toBe(oppBefore);
    });
  });
});

describe('useEngineDispatch (hook wrapper)', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
  });

  it('returns a dispatch function delegating to dispatchEngineAction', () => {
    const { dispatch } = useEngineDispatch();
    expect(typeof dispatch).toBe('function');

    const init = createEmptyGameState();
    init.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: init });

    const result = dispatch({ type: 'endTurn', player: 'self' });
    expect(result.ok).toBe(true);
    expect(useGameStateStore.getState().gameState!.turn.player).toBe('opp');
  });
});
