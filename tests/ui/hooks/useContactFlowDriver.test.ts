// Phase 8 完全クローズ Commit 2: ContactFlowDriver smoke tests
//
// 注: useEffect 駆動の hook 自体は jsdom + act() でテストするのが本筋だが、
//     UI 単体テストは renderToString パターン (SSR) を採用しているため、
//     ここでは driver の内部 runOneStep を `_runDriverStep` 経由で検証する。
//     phase ごとの dispatch 選択ロジック (auto-advance / AI auto / modal open) の
//     一段 step を確認できれば十分。フル FSM 走破は FSM dispatch tests でカバー済。

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach } from 'vitest';
import { _runDriverStep, useContactFlowDriver } from '@/ui/hooks/useContactFlowDriver';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import * as flow from '@/engine/flow/index.js';
import { char as readChar } from '@/engine/read/char';
import { register as registerCardDef } from '@/engine/read/def';
import { D08017 } from '@/cards/ct-d08/D08017';
import { B05047 } from '@/cards/ct-p05/B05047';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';
import type { ActionContext } from '@/engine/types/results';
import { makeChar as baseChar } from '../../helpers/fixtures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function getActionContext(id: string) {
  const state = useGameStateStore.getState().gameState;
  return state ? flow.action._getContext(state, id) : undefined;
}

function updateActionContext(id: string, update: (context: ActionContext) => void): ActionContext {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  const next = produce(state, (draft) => {
    const context = flow.action._getContext(draft, id);
    if (!context) throw new Error(`missing ActionContext: ${id}`);
    update(context);
  });
  useGameStateStore.setState({ gameState: next });
  return getActionContext(id)!;
}

function ContactDriverProbe(): null {
  useContactFlowDriver();
  return null;
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

describe('useContactFlowDriver — _runDriverStep', () => {
  beforeEach(() => {
    useGameStateStore.getState().resetMatchSessionState();
    useGameStateStore.setState({
      gameState: null,
      activeActionId: null,
      pendingDeckReorder: null,
      pendingDeckPlace: null,
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
    useContactModalStore.getState()._reset();
    flow.action._resetActionContexts();
  });

  it('shows effective AP for a modified guard candidate', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'active')];
    s.players.self.scene = [makeChar('s1', 'sleep'), makeChar('s2', 'active')];
    s.players.self.scene[1]!.turnEffects.apMod_contact = 2000;
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const ax = getActionContext(axId)!;

    _runDriverStep(useGameStateStore.getState().gameState!, ax);

    const guard = useContactModalStore.getState().guardPicker?.candidates
      .find((candidate) => candidate.uid === 's2');
    expect(guard?.ap).toBe(readChar.ap(s, 's2'));
  });

  it('guard-window phase with opp defender → AI auto-dispatches actionGuard', () => {
    // self が attacker → defender は opp → AI 自動応答
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const ax = getActionContext(axId)!;
    expect(ax.phase).toBe('guard-window');

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, ax);

    // AI 経由で guard dispatch 済 → phase 'leave-resolution'
    expect(getActionContext(axId)?.phase).toBe('leave-resolution');
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
    const ax = getActionContext(axId)!;
    expect(ax.phase).toBe('guard-window');

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, ax);

    // モーダルが open されている (self は s2 でガード可能)
    expect(useContactModalStore.getState().guardPicker).not.toBeNull();
    expect(useContactModalStore.getState().guardPicker?.actionId).toBe(axId);
    // dispatch はまだ走っていない → phase そのまま
    expect(getActionContext(axId)?.phase).toBe('guard-window');
  });

  it('auto-advance phase (leave-resolution) → driver dispatches actionAdvance', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    // 手動で guard pass → leave-resolution
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    const ax = getActionContext(axId)!;
    expect(ax.phase).toBe('leave-resolution');

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, ax);

    // advance → contact-pending
    expect(getActionContext(axId)?.phase).toBe('contact-pending');
  });

  it('pauses contact phase while a human deck reorder decision is pending', () => {
    useGameStateStore.setState({ gameState: makeBattle() });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null });
    expect(getActionContext(axId)?.phase).toBe('leave-resolution');

    useGameStateStore.setState({
      pendingDeckReorder: { player: 'self', cardIds: ['B04028', 'D08003'] },
    });
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(createElement(ContactDriverProbe)));

    expect(getActionContext(axId)?.phase).toBe('leave-resolution');
    act(() => root.unmount());
  });

  it('pauses B05047 disguise contact while human deck placement is pending', () => {
    registerCardDef(B05047);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'active')];
    s.players.self.scene = [makeChar('s1', 'sleep')];
    s.players.self.case = {
      cardId: 'WHITE-CASE',
      status: '事件編',
      requiredEvidence: 7,
      colors: [B05047.colors[0]!],
      declaredUseCount: {},
    };
    s.players.self.file = Array.from({ length: 6 }, () => ({
      type: 'card-back' as const,
      cardId: 'D08003',
    }));
    s.players.self.hand = ['B05047'];
    s.players.self.deck = ['D08003', 'D08007', 'D08013'];
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    const axId = useGameStateStore.getState().activeActionId!;
    updateActionContext(axId, (ax) => {
      ax.phase = 'action-1';
      ax.firstUid = 's1';
      ax.secondUid = 'o1';
    });

    expect(dispatchEngineAction({
      type: 'actionContact',
      actionId: axId,
      player: 'self',
      choice: { kind: 'disguise', cardId: 'B05047' },
    }).ok).toBe(true);
    expect(useGameStateStore.getState().pendingDeckPlace).toMatchObject({
      player: 'self',
      ownerPlayer: 'self',
      cardIds: ['D08003', 'D08007'],
    });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: axId }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(getActionContext(axId)?.phase).toBe('action-1');

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(createElement(ContactDriverProbe)));

    expect(getActionContext(axId)?.phase).toBe('action-1');
    act(() => root.unmount());
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('action-end phase → clears activeActionId', () => {
    useGameStateStore.setState({ gameState: makeBattle(), activeActionId: 'ax_999' });
    expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    useGameStateStore.setState({ activeActionId: null });
    // 手動で fake ax を 'action-end' にしておく
    flow.action._resetActionContexts();
    // 実際の ax を生成
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 't1' });
    const axId = useGameStateStore.getState().activeActionId!;
    // 強制的に phase を action-end へ
    const updatedAx = updateActionContext(axId, (context) => {
      context.phase = 'action-end';
    });

    const state = useGameStateStore.getState().gameState!;
    _runDriverStep(state, updatedAx);

    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });

  it('opens a human contact decision even when no cut-in or disguise candidate exists', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'active')];
    s.players.self.scene = [makeChar('s1', 'sleep')];
    s.players.self.hand = [];
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const ax = updateActionContext(axId, (context) => {
      context.phase = 'action-1';
      context.firstUid = 's1';
    });

    _runDriverStep(useGameStateStore.getState().gameState!, ax);

    expect(useContactModalStore.getState().cutInDisguise).toMatchObject({
      actionId: axId,
      player: 'self',
      candidates: [],
    });
    expect(getActionContext(axId)?.phase).toBe('action-1');
  });

  it('keeps duplicate hand occurrences distinct in a contact decision', () => {
    registerCardDef(D08017);
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'active')];
    s.players.self.scene = [makeChar('s1', 'sleep')];
    s.players.self.hand = ['D08017', 'D08017'];
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    const axId = useGameStateStore.getState().activeActionId!;
    const ax = updateActionContext(axId, (context) => {
      context.phase = 'action-1';
      context.firstUid = 's1';
    });

    _runDriverStep(useGameStateStore.getState().gameState!, ax);

    const cutins = useContactModalStore.getState().cutInDisguise?.candidates
      .filter((candidate) => candidate.kind === 'cutin')
      .map((candidate) => candidate.uid);
    expect(cutins).toEqual([
      'card:self:hand:D08017#0',
      'card:self:hand:D08017#1',
    ]);
  });

  it('opens the real action-1-redo decision for the first human actor', () => {
    registerCardDef(D08017);
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.scene = [makeChar('o1', 'active')];
    s.players.self.scene = [makeChar('s1', 'sleep')];
    s.players.self.hand = ['D08017'];
    useGameStateStore.setState({ gameState: s });
    dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'o1', targetUid: 's1' });
    const axId = useGameStateStore.getState().activeActionId!;
    updateActionContext(axId, (ax) => {
      ax.firstUid = 's1';
      ax.secondUid = 'o1';
      ax.firstActed = false;
      ax.secondActed = true;
      ax.phase = 'action-2';
    });

    dispatchEngineAction({ type: 'actionAdvance', actionId: axId });
    expect(getActionContext(axId)?.phase).toBe('action-1-redo');
    _runDriverStep(useGameStateStore.getState().gameState!, getActionContext(axId)!);

    expect(useContactModalStore.getState().cutInDisguise).toMatchObject({
      actionId: axId,
      player: 'self',
      actorLabel: '1番目 (再行動)',
      candidates: [{ uid: 'card:self:hand:D08017#0', cardId: 'D08017', kind: 'cutin' }],
    });
  });
});
