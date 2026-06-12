// Phase 8 完全クローズ Commit 2: per-step action dispatch tests
//
// rules: 07-action-flow.md / 08-contact.md / 10-action-event.md
// spec: 計画 — Per-Step Action Dispatch

import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import * as flow from '@/engine/flow/index.js';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import { makeChar as baseChar } from '../../helpers/fixtures';

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
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    flow.action._resetActionContexts();
  });

  it('actionDeclareChar: sets activeActionId + ax phase guard-window + attacker sleeps', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    const result = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    expect(result.ok).toBe(true);
    const axId = useGameStateStore.getState().activeActionId;
    expect(axId).not.toBeNull();
    const ax = flow.action._getContext(axId!);
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
    const ax = flow.action._getContext(axId!);
    expect(ax?.phase).toBe('guard-window');
    expect(ax?.target.kind).toBe('case');
  });

  it('actionGuard with null → passGuard → leave-resolution (char target)', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const result = dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    expect(result.ok).toBe(true);
    const ax = flow.action._getContext(axId);
    expect(ax?.phase).toBe('leave-resolution');
  });

  it('actionGuard with null → judge phase for case target', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    const ax = flow.action._getContext(axId);
    expect(ax?.phase).toBe('judge');
  });

  it('actionAdvance progresses phase by 1', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    // leave-resolution → contact-pending
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId });
    const ax = flow.action._getContext(axId);
    expect(ax?.phase).toBe('contact-pending');
  });

  it('actionJudge (case target): removes opp evidence + adds self evidence', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    const r1 = dispatchEngineAction({ type: 'actionDeclareCase', byUid: 's1', targetPlayer: 'opp' });
    expect(r1.ok).toBe(true);
    const axId = useGameStateStore.getState().activeActionId!;
    const r2 = dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    expect(r2.ok).toBe(true);
    const axAfterGuard = flow.action._getContext(axId);
    expect(axAfterGuard?.phase).toBe('judge');
    // phase: judge
    const r3 = dispatchEngineAction({ type: 'actionJudge', actionId: axId });
    expect(r3.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.evidence.length).toBe(0);
    expect(after.players.self.evidence.length).toBe(1);
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
    let ax = flow.action._getContext(axId);
    expect(ax?.phase).toBe('action-1');
    // identify first uid owner
    const firstUid = ax?.firstUid;
    expect(firstUid).toBeDefined();
    // dispatch pass (any player who owns first)
    dispatchEngineAction({
      type: 'actionContact',
      actionId: axId,
      player: 'self',
      choice: { kind: 'pass' },
    });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId }); // action-1 → action-2
    ax = flow.action._getContext(axId);
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
        const cur = flow.action._getContext(axId);
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
