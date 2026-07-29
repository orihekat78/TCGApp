// Phase 8 完全クローズ Commit 2: per-step action dispatch tests
//
// rules: 07-action-flow.md / 08-contact.md / 10-action-event.md
// spec: 計画 — Per-Step Action Dispatch

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickQueueLength,
  _peekPendingEffectPickSide,
  _pushPendingEffectPickSideForTest,
  type PendingEffectPickSide,
} from '@/engine/effect/pending-state';
import * as flow from '@/engine/flow/index.js';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../helpers/fixtures';

function getActionContext(id: string) {
  const state = useGameStateStore.getState().gameState;
  return state ? flow.action._getContext(state, id) : undefined;
}

function makeChar(uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseChar({ cardId: 'cX', uid, state, enterOrder: 0 });
}

function makeBattle(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [makeChar('s1', 'active')];
  s.players.opp.scene = [makeChar('t1', 'sleep')];
  s.players.opp.case = { cardId: 'C1', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
  s.players.opp.evidence = [
    { cardId: 'card-back', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
  ];
  s.players.self.deck = ['evi-1', 'evi-2', 'evi-3'];
  return s;
}

describe('useEngineDispatch — per-step action FSM', () => {
  beforeEach(() => {
    useGameStateStore.getState().resetMatchSessionState();
    _clearPendingEffectPickQueue();
    flow.action._resetActionContexts();
  });

  it('actionDeclareChar: sets activeActionId + ax phase guard-window + attacker sleeps', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    const result = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    expect(result.ok).toBe(true);
    const axId = useGameStateStore.getState().activeActionId;
    expect(axId).not.toBeNull();
    const ax = getActionContext(axId!);
    expect(ax?.phase).toBe('guard-window');
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find((c) => c.uid === 's1')?.state).toBe('sleep');
  });

  it('actionDeclareCase: sets activeActionId + ax phase guard-window + target=case', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    const result = dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    expect(result.ok).toBe(true);
    const axId = useGameStateStore.getState().activeActionId;
    expect(axId).not.toBeNull();
    const ax = getActionContext(axId!);
    expect(ax?.phase).toBe('guard-window');
    expect(ax?.target.kind).toBe('case');
  });

  it('hydrates a restored open ActionContext and rejects a second declaration', () => {
    const base = makeBattle();
    base.players.self.scene.push(makeChar('s2', 'active'));
    flow.action.declare(base, 's1', {
      kind: 'char',
      uid: 't1',
    });
    const restored = JSON.parse(JSON.stringify(base)) as GameState;

    useGameStateStore.getState().setGameState(restored);

    expect(useGameStateStore.getState().activeActionId).toBe('ax_1');
    expect(dispatchEngineAction({
      type: 'actionDeclareChar',
      byUid: 's2',
      targetUid: 't1',
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(Object.keys(useGameStateStore.getState().gameState?.actionContexts ?? {})).toEqual(['ax_1']);
  });

  it('restores the newest open nested ActionContext as active', () => {
    const base = makeBattle();
    base.actionContextSeq = 2;
    base.actionContexts = {
      ax_2: {
        id: 'ax_2',
        byUid: 't1',
        byPlayer: 'opp',
        target: { kind: 'char', uid: 's1' },
        phase: 'guard-window',
        startedAt: { turn: 2, nano: 2 },
      },
      ax_1: {
        id: 'ax_1',
        byUid: 's1',
        byPlayer: 'self',
        target: { kind: 'char', uid: 't1' },
        phase: 'judge',
        startedAt: { turn: 2, nano: 1 },
      },
    };

    useGameStateStore.getState().setGameState(
      JSON.parse(JSON.stringify(base)) as GameState,
    );

    expect(useGameStateStore.getState().activeActionId).toBe('ax_2');
  });

  it('restores and resolves a state-owned leave-intercept decision exactly once', () => {
    const base = makeBattle();
    base.players.opp.scene[0]!.cardId = 'DEFENDER';
    base.players.opp.scene.push({
      ...makeChar('interceptor', 'active'),
      cardId: 'INTERCEPTOR',
    });
    base.actionContextSeq = 1;
    base.actionContexts = {
      ax_1: {
        id: 'ax_1',
        byUid: 's1',
        byPlayer: 'self',
        target: { kind: 'char', uid: 't1' },
        phase: 'judge',
        apSnapshot: { aUid: 's1', aAP: 5000, bUid: 't1', bAP: 1000 },
        pendingLeaveIntercept: {
          player: 'opp',
          targetUid: 't1',
          interceptorUid: 'interceptor',
        },
        startedAt: { turn: 2, nano: 1 },
      },
    };

    useGameStateStore.getState().setGameState(
      JSON.parse(JSON.stringify(base)) as GameState,
    );
    const pending = useGameStateStore.getState().pendingLeaveIntercept;

    expect(useGameStateStore.getState().activeActionId).toBe('ax_1');
    expect(pending).toMatchObject({
      player: 'opp',
      targetUid: 't1',
      interceptorUid: 'interceptor',
      actionId: 'ax_1',
    });
    expect(dispatchEngineAction({
      type: 'leaveInterceptResolve',
      accept: true,
      decisionId: 'stale-decision',
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({
      type: 'leaveInterceptResolve',
      accept: true,
      decisionId: pending?.decisionId,
    })).toEqual({ ok: true });

    const restored = useGameStateStore.getState();
    const resolved = restored.gameState!;
    expect(restored.pendingLeaveIntercept).toBeNull();
    expect(flow.action._getContext(resolved, 'ax_1')).toMatchObject({
      judgeResolved: true,
    });
    expect(flow.action._getContext(resolved, 'ax_1')?.pendingLeaveIntercept).toBeUndefined();
    expect(resolved.players.opp.scene.map((card) => card.uid)).toEqual([]);
    expect(resolved.players.opp.hand).toContain('DEFENDER');
    expect(resolved.players.opp.remove).toContain('INTERCEPTOR');
    expect(resolved.log.filter((entry) => entry.action === 'contact-judge')).toHaveLength(1);
    expect(resolved.log.find((entry) => entry.action === 'contact-judge')?.result).toContain('MISS');
  });

  it('actionGuard with null → passGuard → leave-resolution (char target)', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const result = dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    expect(result.ok).toBe(true);
    const ax = getActionContext(axId);
    expect(ax?.phase).toBe('leave-resolution');
  });

  it('actionGuard with null → judge phase for case target', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    const ax = getActionContext(axId);
    expect(ax?.phase).toBe('judge');
  });

  it('actionAdvance progresses phase by 1', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    // leave-resolution → contact-pending
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId });
    const ax = getActionContext(axId);
    expect(ax?.phase).toBe('contact-pending');
  });

  it('actionAdvance cannot bypass guard-window', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;

    const result = dispatchEngineAction({ type: 'actionAdvance', actionId: axId });

    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(getActionContext(axId)?.phase).toBe('guard-window');
  });

  it('actionAdvance cannot skip an unresolved contact decision or judge', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const charAxId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: charAxId, guarderUid: null });
    dispatchEngineAction({ type: 'actionAdvance', actionId: charAxId });
    dispatchEngineAction({ type: 'actionAdvance', actionId: charAxId });
    expect(getActionContext(charAxId)?.phase).toBe('action-1');
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: charAxId }))
      .toEqual({ ok: false, reason: 'not-allowed' });

    flow.action._resetActionContexts();
    useGameStateStore.setState({ gameState: makeBattle(), activeActionId: null });
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    const caseAxId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: caseAxId, guarderUid: null });
    expect(getActionContext(caseAxId)?.phase).toBe('judge');
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: caseAxId }))
      .toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('actionContact rejects a player who does not own the current contact step', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId });
    const ax = getActionContext(axId)!;
    const firstOwner = ax.firstUid === 's1' ? 'self' : 'opp';
    const wrongPlayer = firstOwner === 'self' ? 'opp' : 'self';

    expect(dispatchEngineAction({
      type: 'actionContact',
      actionId: axId,
      player: wrongPlayer,
      choice: { kind: 'pass' },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(getActionContext(axId)?.phase).toBe('action-1');
  });

  it('rolls back GameState and ActionContext identity when a listener throws', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    const unsubscribe = event.on('action:declare', () => {
      throw new Error('injected action:declare failure');
    });

    expect(dispatchEngineAction({
      type: 'actionDeclareChar',
      byUid: 's1',
      targetUid: 't1',
    })).toEqual({
      ok: false,
      reason: 'engine-error',
      detail: 'injected action:declare failure',
    });

    const rolledBack = useGameStateStore.getState();
    expect(rolledBack.activeActionId).toBeNull();
    expect(rolledBack.gameState?.actionContexts).toBeUndefined();
    expect(rolledBack.gameState?.actionContextSeq).toBeUndefined();
    expect(rolledBack.gameState?.players.self.scene[0]?.state).toBe('active');

    unsubscribe();
    expect(dispatchEngineAction({
      type: 'actionDeclareChar',
      byUid: 's1',
      targetUid: 't1',
    }).ok).toBe(true);
    expect(useGameStateStore.getState().activeActionId).toBe('ax_1');
  });

  it('rolls back Zustand decisions and module side channels when a listener throws', () => {
    const existing: PendingEffectPickSide = {
      player: 'self',
      candidates: [],
      atomVerb: 'discard',
      atomArgs: { player: 'self' },
      nMin: 0,
      nMax: 1,
      source: { cardId: 'BASE', abilityId: 'a1' },
    };
    const leaked: PendingEffectPickSide = {
      ...existing,
      atomVerb: 'sceneRemove',
      source: { cardId: 'LEAK', abilityId: 'a2' },
    };
    _pushPendingEffectPickSideForTest(existing);
    useGameStateStore.setState({ gameState: makeBattle() });
    const decisionSeqBefore = useGameStateStore.getState().pendingDecisionSeq;
    const unsubscribe = event.on('action:declare', () => {
      useGameStateStore.getState().setPendingLeaveIntercept({
        player: 'opp',
        targetUid: 't1',
        interceptorUid: 'guard',
        actionId: 'ax_1',
      });
      _pushPendingEffectPickSideForTest(leaked);
      throw new Error('injected cross-boundary failure');
    });

    const result = dispatchEngineAction({
      type: 'actionDeclareChar',
      byUid: 's1',
      targetUid: 't1',
    });
    unsubscribe();

    expect(result).toEqual({
      ok: false,
      reason: 'engine-error',
      detail: 'injected cross-boundary failure',
    });

    const rolledBack = useGameStateStore.getState();
    expect(rolledBack.pendingLeaveIntercept).toBeNull();
    expect(rolledBack.pendingDecisionSeq).toBe(decisionSeqBefore);
    expect(_peekPendingEffectPickQueueLength()).toBe(1);
    expect(_peekPendingEffectPickSide()).toEqual(existing);
  });

  it('actionJudge (case target): removes opp evidence + adds self evidence', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    const r1 = dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    expect(r1.ok).toBe(true);
    const axId = useGameStateStore.getState().activeActionId!;
    const r2 = dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    expect(r2.ok).toBe(true);
    const axAfterGuard = getActionContext(axId);
    expect(axAfterGuard?.phase).toBe('judge');
    // phase: judge
    const r3 = dispatchEngineAction({ type: 'actionJudge', actionId: axId });
    expect(r3.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.evidence.length).toBe(0);
    expect(after.players.self.evidence.length).toBe(1);
  });

  it('actionJudge cannot resolve the same judge phase twice', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });

    expect(dispatchEngineAction({ type: 'actionJudge', actionId: axId })).toEqual({ ok: true });
    const afterFirst = useGameStateStore.getState().gameState!;
    expect(afterFirst.players.self.evidence.map((e) => e.cardId)).toEqual(['evi-1']);

    expect(dispatchEngineAction({ type: 'actionJudge', actionId: axId }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState?.players.self.evidence.map((e) => e.cardId))
      .toEqual(['evi-1']);
  });

  it('persists a newly deferred leave-intercept decision before surfacing it', () => {
    const base = makeBattle();
    base.actionContextSeq = 1;
    base.actionContexts = {
      ax_1: {
        id: 'ax_1',
        byUid: 's1',
        byPlayer: 'self',
        target: { kind: 'char', uid: 't1' },
        phase: 'judge',
        startedAt: { turn: 2, nano: 1 },
      },
    };
    useGameStateStore.setState({ gameState: base, activeActionId: 'ax_1' });
    const judge = vi.spyOn(flow.contact, 'judge').mockReturnValue({
      attackerAP: 5000,
      defenderAP: 1000,
      defenderRemoved: false,
      attackerRemoved: false,
      deferred: true,
      pendingLeaveIntercept: {
        player: 'opp',
        targetUid: 't1',
        interceptorUid: 'interceptor',
      },
    });

    const result = dispatchEngineAction({ type: 'actionJudge', actionId: 'ax_1' });
    judge.mockRestore();

    expect(result).toEqual({ ok: true });
    expect(flow.action._getContext(useGameStateStore.getState().gameState!, 'ax_1')?.pendingLeaveIntercept)
      .toEqual({
        player: 'opp',
        targetUid: 't1',
        interceptorUid: 'interceptor',
      });
    expect(useGameStateStore.getState().pendingLeaveIntercept).toMatchObject({
      actionId: 'ax_1',
      targetUid: 't1',
      interceptorUid: 'interceptor',
    });
  });

  it('actionJudge waits while another resolver decision is pending', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    useGameStateStore.getState().setPendingEffectOptional({
      player: 'self',
      source: { cardId: 'BLOCKER', abilityId: 'a1', uid: 'blocker#1' },
    });

    expect(dispatchEngineAction({ type: 'actionJudge', actionId: axId }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState?.players.opp.evidence).toHaveLength(1);
    expect(getActionContext(axId)?.judgeResolved).not.toBe(true);
  });

  it('actionGuard with invalid guarderUid → not-allowed', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const result = dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: 'nonexistent' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('actionContact pass + actionAdvance: progresses through action-1', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId }); // leave-resolution → contact-pending
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId }); // contact-pending → action-1
    let ax = getActionContext(axId);
    expect(ax?.phase).toBe('action-1');
    // identify first uid owner
    const firstUid = ax?.firstUid;
    expect(firstUid).toBeDefined();
    const current = useGameStateStore.getState().gameState!;
    const firstPlayer = current.players.self.scene.some(character => character.uid === firstUid)
      ? 'self'
      : 'opp';
    dispatchEngineAction({
      type: 'actionContact',
      actionId: axId,
      player: firstPlayer,
      choice: { kind: 'pass' },
    });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId }); // action-1 → action-2
    ax = getActionContext(axId);
    expect(ax?.phase).toBe('action-2');
  });

  // user_request 20260522_01 #8 fix
  it('actionJudge: case target が guard 成立 (guardUid set) → 証拠変動なし (rules/10)', () => {
    // 盤面: self が opp の事件カードに action、opp が s1 (active 自陣 char) で guard
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [makeChar('attacker', 'active')];
    s.players.opp.scene = [makeChar('guarder', 'active')];
    s.players.opp.case = { cardId: 'C1', status: '事件編', requiredEvidence: 7, colors: ['blue'] };
    s.players.opp.evidence = [
      { cardId: 'card-back', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
      { cardId: 'card-back', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    s.players.self.deck = ['evi-1', 'evi-2'];
    s.players.self.evidence = [];
    useGameStateStore.setState({ gameState: s });

    const evOppBefore = s.players.opp.evidence.length;
    const evSelfBefore = s.players.self.evidence.length;

    // 1. declare case
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'attacker', targetPlayer: 'opp' });
    const axId = useGameStateStore.getState().activeActionId!;

    // 2. guard 成立 (guardUid set)
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: 'guarder' });

    // 3. advance を action-end まで進める (leave-resolution → contact-pending → action-1 →
    //    action-2 → judge → contact-end → action-end)
    // 各 contact phase は pass で進める
    const advanceTillEnd = (): void => {
      for (let i = 0; i < 20; i++) {
        const cur = getActionContext(axId);
        if (!cur || cur.phase === 'action-end') break;
        if (cur.phase === 'action-1' || cur.phase === 'action-2' || cur.phase === 'action-1-redo') {
          dispatchEngineAction({
            type: 'actionContact',
            actionId: axId,
            player: cur.byPlayer,
            choice: { kind: 'pass' },
          });
        }
        if (cur.phase === 'judge') {
          dispatchEngineAction({ type: 'actionJudge', actionId: axId });
        }
        dispatchEngineAction({ type: 'actionAdvance', actionId: axId });
      }
    };
    advanceTillEnd();

    const after = useGameStateStore.getState().gameState!;
    // 証拠は不変 (guard 成立で rules/10 evidence change スキップ)
    expect(after.players.opp.evidence.length).toBe(evOppBefore);
    expect(after.players.self.evidence.length).toBe(evSelfBefore);
  });
});
