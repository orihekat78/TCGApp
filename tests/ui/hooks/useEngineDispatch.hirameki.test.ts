// Phase 8 完全クローズ Commit 3a: hiramekiResolve dispatch tests
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import {
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { CardDef } from '@/engine/types';
import type { GameState } from '@/engine/types/game-state';
import { isCausalLogEntry, startCausalSession } from '@/engine/log/causal';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import * as flow from '@/engine/flow/index.js';
import { _getResolutionLock } from '@/engine/event/registry.js';

const PAUSED_HIRAMEKI_ID = 'TEST-PAUSED-HIRAMEKI';
const PAUSED_HIRAMEKI_TARGET_ID = 'TEST-PAUSED-HIRAMEKI-TARGET';
const pausedHirameki: CardDef = {
  id: PAUSED_HIRAMEKI_ID,
  no: 'TEST/PAUSED-HIRAMEKI',
  kind: 'character',
  names: ['テスト用ヒラメキ'],
  colors: ['青'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [{
    id: 'a1',
    type: 'triggered',
    scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    effect: {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$pick',
            state: 'sleep',
            target: {
              kind: 'pick',
              query: { area: 'scene', side: 'either' },
              n: { min: 1, max: 1 },
              chooser: 'self',
            },
          },
        },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ],
    },
    description: '【ヒラメキ】キャラを1枚選びスリープさせ、カードを1枚引く。',
    ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
  }],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};
const pausedHiramekiTarget: CardDef = {
  id: PAUSED_HIRAMEKI_TARGET_ID,
  no: 'TEST/PAUSED-HIRAMEKI-TARGET',
  kind: 'character',
  names: ['対象'],
  colors: ['赤'],
  level: 1,
  ap: 1000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

describe('hiramekiResolve dispatch (Commit 3a)', () => {
  let actionSessionSeq = 0;
  function resolvePendingHirameki(choice: 'fire' | 'skip') {
    const pending = useGameStateStore.getState().pendingHirameki;
    if (!pending) throw new Error('expected pending Hirameki');
    return dispatchEngineAction(bindPendingDecision(pending, { type: 'hiramekiResolve', choice }));
  }

  beforeAll(() => {
    registerAll();
    registerHiramekiListener();
    registerCardDef(pausedHirameki);
    registerCardDef(pausedHiramekiTarget);
  });

  beforeEach(() => {
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({ gameState: null, pendingHirameki: null, pendingEffectPick: null });
    _resetPendingHirameki();
    _clearPendingEffectPickQueue();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  afterEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  function makeStateWithDeckAndPending(): GameState {
    const s = createEmptyGameState();
    s.players.self.deck = ['x1', 'x2', 'x3'];
    s.players.self.hand = [];
    return s;
  }

  function makeActionHiramekiState(
    evidenceCardId = PAUSED_HIRAMEKI_ID,
  ): {
    state: GameState;
    actorUid: string;
    pickUid: string;
    sessionId: string;
  } {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const actor = mutate.scene.enter(state, 'self', PAUSED_HIRAMEKI_TARGET_ID, {});
    const pickTarget = mutate.scene.enter(state, 'opp', PAUSED_HIRAMEKI_TARGET_ID, {});
    state.players.opp.case = {
      cardId: 'D08026',
      status: 'case-front',
      requiredEvidence: 7,
      colors: ['blue'],
    };
    state.players.opp.evidence = [{
      cardId: evidenceCardId,
      faceUp: false,
      origin: { turn: 1, via: 'reasoning' },
    }];
    state.players.self.deck = ['GAIN-EVIDENCE-1', 'GAIN-EVIDENCE-2', 'GAIN-EVIDENCE-3'];
    state.players.opp.deck = ['DRAW-AFTER-PICK-1', 'DRAW-AFTER-PICK-2', 'DRAW-AFTER-PICK-3'];
    const sessionId = `hirameki-action-${++actionSessionSeq}`;
    startCausalSession(state, sessionId);
    resetPresentationQueue(sessionId);
    return { state, actorUid: actor.uid, pickUid: pickTarget.uid, sessionId };
  }

  function openActionHirameki(
    evidenceCardId = PAUSED_HIRAMEKI_ID,
    configure?: (state: GameState) => void,
  ) {
    const setup = makeActionHiramekiState(evidenceCardId);
    configure?.(setup.state);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    useGameStateStore.setState({ gameState: setup.state });
    expect(dispatchEngineAction({
      type: 'actionDeclareCase',
      byUid: setup.actorUid,
      targetPlayer: 'opp',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    return { ...setup, actionId };
  }

  it('listener が pending を set した後 dispatchEngineAction 経由で Zustand へ転送される', () => {
    const s = makeStateWithDeckAndPending();
    s.players.self.evidence = [
      { cardId: 'D08013', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    useGameStateStore.setState({ gameState: s });

    // 直接 emit してから side channel が drain されることを確認するため、
    // 何らかの dispatch を経由する必要がある。ここでは reasoning dispatch を ((中身は無関係)) 利用。
    // 代わりに event.emit を直接呼んで side channel をセット → dispatch (no-op) で drain。
    engine.event.emit(
      useGameStateStore.getState().gameState!,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08013' } },
      { player: 'opp', uid: 'attacker' },
    );

    // 次の dispatch で drain が走る (endTurn は state.turn.player==='opp' なので not-allowed,
    // 代わりに直接側チャネル → setState を経由するため、ここでは endTurn を試して drain 発火を見る)
    surfacePendingSideChannels();

    const pending = useGameStateStore.getState().pendingHirameki;
    expect(pending).not.toBeNull();
    expect(pending?.cardId).toBe('D08013');
    expect(pending?.player).toBe('self');
  });

  it('rejects a correlation-less Hirameki pending at the public dispatch boundary', () => {
    const state = makeStateWithDeckAndPending();
    useGameStateStore.setState({ gameState: state });
    useGameStateStore.getState().setPendingHirameki({
      player: 'self',
      cardId: 'D08013',
      abilityId: 'a2',
    });
    const pending = useGameStateStore.getState().pendingHirameki!;
    const before = structuredClone(useGameStateStore.getState().gameState);

    const result = dispatchEngineAction(bindPendingDecision(pending, {
      type: 'hiramekiResolve',
      choice: 'fire',
    }));

    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().pendingHirameki).toEqual(pending);
    expect(useGameStateStore.getState().gameState).toEqual(before);
  });

  it('hiramekiResolve fire → ability effect が pendingEffects に queue → 解決後 hand+1', () => {
    const { actionId } = openActionHirameki('D08013');

    const r = resolvePendingHirameki('fire');
    expect(r.ok).toBe(true);
    // pendingHirameki クリア
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
    // hiramekiDraw n=1 → hand に 1 枚追加 / deck -1
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.hand.length).toBe(1);
    expect(after.players.opp.deck.length).toBe(2);
    expect(flow.action._getContext(after, actionId)).toMatchObject({
      phase: 'judge',
      judgeResolved: true,
      deferredCaseEvidenceGain: true,
    });
  });

  it('hiramekiResolve は解決中の証拠カードを refresh 対象から除外する', () => {
    openActionHirameki('D08013', (state) => {
      state.players.opp.deck = [];
    });

    const r = resolvePendingHirameki('fire');
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.hand).toEqual([]);
    expect(after.players.opp.remove).toEqual(['D08013']);
    expect(after.gameResult).toMatchObject({ winner: 'self', reason: 'deck-out' });
  });

  it('human ヒラメキが pick で pause/resume しても解決中カードを exact refresh から除外する', () => {
    const { pickUid, actionId } = openActionHirameki(PAUSED_HIRAMEKI_ID, (state) => {
      state.players.opp.deck = ['DRAW'];
      state.players.opp.remove = ['REFRESHABLE'];
    });
    expect(useGameStateStore.getState().pendingHirameki).toMatchObject({
      actionId,
      causalCorrelationEventId: expect.any(String),
      occurrence: { player: 'opp', cardId: PAUSED_HIRAMEKI_ID, removeIndex: 1 },
    });

    const fireResult = resolvePendingHirameki('fire');
    expect(fireResult, JSON.stringify(fireResult)).toMatchObject({ ok: true });
    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick?.atomVerb).toBe('sceneSetState');
    const resolveResult = dispatchEngineAction(bindPendingDecision(pick!, {
      type: 'effectPickResolve',
      pickedUid: pickUid,
    }));
    expect(resolveResult, JSON.stringify(resolveResult)).toMatchObject({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene.find((c) => c.uid === pickUid)?.state, 'pause 前の選択効果').toBe('sleep');
    expect(after.players.opp.hand, 'resume 後の draw').toEqual(['DRAW']);
    expect(after.players.opp.remove, '解決中ヒラメキは refresh 対象外').toEqual([PAUSED_HIRAMEKI_ID]);
    expect(after.players.opp.deck, '通常 remove カードだけ refresh').toEqual(['REFRESHABLE']);
    expect(after.refreshCount.opp).toBe(1);
    expect(flow.action._getContext(after, actionId)).toMatchObject({ phase: 'judge' });
  });

  it('hiramekiResolve skip → 効果適用なし、pendingHirameki クリアのみ', () => {
    openActionHirameki('D08013');

    const r = resolvePendingHirameki('skip');
    expect(r.ok).toBe(true);
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.hand.length).toBe(0); // 不変
    expect(after.players.opp.deck.length).toBe(3); // 不変
  });

  it('real case action keeps deferred gain state-owned while Hirameki pauses and resumes as one causal graph', () => {
    const { state, actorUid, pickUid, sessionId } = makeActionHiramekiState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    useGameStateStore.setState({ gameState: state });

    expect(dispatchEngineAction({
      type: 'actionDeclareCase',
      byUid: actorUid,
      targetPlayer: 'opp',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });

    const pending = useGameStateStore.getState().pendingHirameki;
    expect(pending).toMatchObject({
      actionId,
      player: 'opp',
      cardId: PAUSED_HIRAMEKI_ID,
      gainDeferred: true,
    });
    const afterJudge = useGameStateStore.getState().gameState!;
    expect(flow.action._getContext(afterJudge, actionId)).toMatchObject({
      phase: 'judge',
      judgeResolved: true,
      deferredCaseEvidenceGain: true,
    });
    expect(afterJudge.players.self.evidence).toHaveLength(0);

    expect(resolvePendingHirameki('fire')).toEqual({ ok: true });
    const effectPick = useGameStateStore.getState().pendingEffectPick;
    expect(effectPick?.atomVerb).toBe('sceneSetState');
    expect(useGameStateStore.getState().gameState?.players.self.evidence).toHaveLength(0);

    expect(dispatchEngineAction(bindPendingDecision(effectPick!, {
      type: 'effectPickResolve',
      pickedUid: pickUid,
    }))).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.evidence).toHaveLength(0);
    expect(flow.action._getContext(useGameStateStore.getState().gameState!, actionId)).toMatchObject({
      phase: 'judge',
      judgeResolved: true,
      deferredCaseEvidenceGain: true,
    });
    expect(useGameStateStore.getState().gameState?.gameResult).toBeUndefined();
    expect(_getResolutionLock()).toMatchObject({ locked: false });
    expect(useGameStateStore.getState()).toMatchObject({
      pendingHirameki: null,
      pendingMisread: null,
      pendingEffectPick: null,
      pendingEffectChoice: null,
      pendingEffectOptional: null,
      pendingChooseIntercept: null,
      pendingLeaveIntercept: null,
      pendingRps: null,
      pendingSetCardChoice: null,
      pendingSetCardReplacement: null,
      pendingEffectRepeatOptional: null,
      pendingDeckReveal: null,
      pendingDeckReorder: null,
      pendingDeckPlace: null,
    });

    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(flow.action._getContext(after, actionId)).toBeUndefined();
    expect(after.players.self.evidence).toHaveLength(1);

    const causal = after.log.filter(isCausalLogEntry);
    const decision = causal.find((entry) => entry.kind === 'activate' && entry.tags?.includes('hirameki'));
    expect(decision).toBeDefined();
    const childRoot = causal.find((entry) => entry.correlationEventId === decision?.eventId);
    expect(childRoot).toMatchObject({ kind: 'declare' });
    expect(childRoot?.parentEventId).toBeUndefined();
    expect(causal
      .filter((entry) => entry.parentEventId === undefined && entry.correlationEventId === undefined)
      .map((entry) => ({ kind: entry.kind, eventId: entry.eventId, source: entry.source })))
      .toEqual([{ kind: 'declare', eventId: `${sessionId}:1`, source: expect.any(Object) }]);
    const actionGain = causal.find((entry) => entry.kind === 'evidence' && entry.actor === 'self');
    expect(actionGain?.parentEventId).toBe(decision?.eventId);
    expect(causal.at(-1)).toMatchObject({ kind: 'summary', parentEventId: actionGain?.eventId });
    expect(causal.at(-1)?.tags ?? []).not.toContain('contact');
  });

  it('real case action skip records cancellation and defers gain until action completion', () => {
    const { state, actorUid } = makeActionHiramekiState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'actionDeclareCase', byUid: actorUid, targetPlayer: 'opp' }))
      .toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingHirameki).not.toBeNull();

    expect(resolvePendingHirameki('skip')).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.evidence).toHaveLength(0);
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence).toHaveLength(1);
    const causal = after.log.filter(isCausalLogEntry);
    const decision = causal.find((entry) => entry.kind === 'cancel' && entry.tags?.includes('hirameki'));
    expect(decision).toBeDefined();
    expect(causal.some((entry) => entry.correlationEventId === decision?.eventId)).toBe(false);
    const actionGain = causal.find((entry) => entry.kind === 'evidence' && entry.actor === 'self');
    expect(actionGain?.parentEventId).toBe(decision?.eventId);
  });

  it('pendingHirameki なし状態で hiramekiResolve dispatch → not-allowed', () => {
    const s = makeStateWithDeckAndPending();
    useGameStateStore.setState({ gameState: s, pendingHirameki: null });
    const r = dispatchEngineAction({
      type: 'hiramekiResolve',
      choice: 'fire',
      decisionId: 'missing-decision',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-allowed');
  });
});
