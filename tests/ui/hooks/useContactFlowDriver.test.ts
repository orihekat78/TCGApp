// Phase 8 完全クローズ Commit 2: ContactFlowDriver smoke tests
//
// 注: useEffect 駆動の hook 自体は jsdom + act() でテストするのが本筋だが、
//     UI 単体テストは renderToString パターン (SSR) を採用しているため、
//     ここでは driver の内部 runOneStep を `_runDriverStep` 経由で検証する。
//     phase ごとの dispatch 選択ロジック (auto-advance / AI auto / modal open) の
//     一段 step を確認できれば十分。フル FSM 走破は FSM dispatch tests でカバー済。

import { describe, it, expect, beforeEach } from 'vitest';
import { _runDriverStep } from '@/ui/hooks/useContactFlowDriver';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { createEmptyGameState } from '@/engine/state-factory';
import * as flow from '@/engine/flow/index.js';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';

function makeChar(uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return {
    cardId: 'cX',
    uid,
    state,
    isNamed: false,
    enterOrder: 0,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
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

describe('useContactFlowDriver — _runDriverStep', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, activeActionId: null });
    useContactModalStore.getState()._reset();
    flow.action._resetActionContexts();
  });

  it('guard-window phase with opp defender → AI auto-dispatches actionGuard', () => {
    // self が attacker → defender は opp → AI 自動応答
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const ax = flow.action._getContext(axId)!;
    expect(ax.phase).toBe('guard-window');

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, ax);

    // AI 経由で guard dispatch 済 → phase 'leave-resolution'
    expect(flow.action._getContext(axId)?.phase).toBe('leave-resolution');
    // モーダルは open されていない
    expect(useContactModalStore.getState().guardPicker).toBeNull();
  });

  it('guard-window phase with self defender → opens GuardPickerModal', () => {
    // opp が attacker (s1 を opp に置く) → defender は self → モーダル open
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'active')];
    s.players.self.scene = [makeChar('s1', 'sleep'), makeChar('s2', 'active')];
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const ax = flow.action._getContext(axId)!;
    expect(ax.phase).toBe('guard-window');

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, ax);

    // モーダルが open されている (self は s2 でガード可能)
    expect(useContactModalStore.getState().guardPicker).not.toBeNull();
    expect(useContactModalStore.getState().guardPicker?.actionId).toBe(axId);
    // dispatch はまだ走っていない → phase そのまま
    expect(flow.action._getContext(axId)?.phase).toBe('guard-window');
  });

  it('auto-advance phase (leave-resolution) → driver dispatches actionAdvance', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    // 手動で guard pass → leave-resolution
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    const ax = flow.action._getContext(axId)!;
    expect(ax.phase).toBe('leave-resolution');

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, ax);

    // advance → contact-pending
    expect(flow.action._getContext(axId)?.phase).toBe('contact-pending');
  });

  it('action-end phase → clears activeActionId', () => {
    useGameStateStore.setState({ gameState: makeBattle(), activeActionId: 'ax_999' });
    // 手動で fake ax を 'action-end' にしておく
    flow.action._resetActionContexts();
    // 実際の ax を生成
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const ax = flow.action._getContext(axId)!;
    // 強制的に phase を action-end へ
    ax.phase = 'action-end';

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, ax);

    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });
});
