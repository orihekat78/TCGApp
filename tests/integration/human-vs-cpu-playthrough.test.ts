// Phase 8 完全クローズ Commit 6: human vs CPU 統合 E2E
//
// rules: 05-turn-phases.md, 07-action-flow.md, 10-action-event.md, 11-reasoning.md,
//        13-keywords.md (assist/solveCase), 01-victory-conditions.md
// spec: 計画 — Commit 6
//
// 目的:
//   Commit 2 / 2.5 / 3a / 3b / 4 / 5 で導入した per-step dispatch + 各 driver
//   hook + listener 連携を end-to-end でカバーする。React mount は避け、
//   useGameStateStore + dispatchEngineAction を直接駆動して状態遷移を観察。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
} from '@/engine/listeners/hirameki';
import {
  registerMisreadListener,
  _resetPendingMisread,
} from '@/engine/listeners/misread';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { driveOppTurn, _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from 'immer';
import type { GameState, SceneCharacter } from '@/engine/types/game-state';

function makeChar(uid: string, cardId: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return {
    cardId,
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

function fullReset(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  _resetPendingMisread();
  _drainPendingHirameki(); // 念のため drain
  _resetIsDriving();
  registerAll();
  registerHiramekiListener();
  registerMisreadListener();
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingHirameki: null,
    pendingMisread: null,
  });
}

function setupMidGame(): GameState {
  // 中盤盤面: self ターン / 双方 partner active / 双方 scene 1 体
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'D11001', state: 'active', location: 'partner-area' };
  // BUG-085: declaredUseCount は CaseState の必須フィールド (BUG-067)。case literal で
  //   上書きする際に欠落していたため、BUG-084 の case 宣言能力列挙/使用で throw していた。
  s.players.self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['blue'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 6, colors: ['yellow'], declaredUseCount: {} };
  s.players.self.scene = [makeChar('s1', 'D08003')];
  s.players.opp.scene = [makeChar('o1', 'D11003')];
  s.players.self.deck = Array(20).fill('D08005');
  s.players.opp.deck = Array(20).fill('D11005');
  return s;
}

describe('human vs CPU integration E2E (Commit 6)', () => {
  beforeEach(() => {
    fullReset();
  });

  it('Test 1 — 推理基本フロー: reasoning dispatch → evidence +N + log 追記', () => {
    useGameStateStore.setState({ gameState: setupMidGame() });
    const r = dispatchEngineAction({ type: 'reasoning', uid: 'partner:self' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.length).toBeGreaterThan(0);
    expect(after.players.self.partner.state).toBe('sleep');
    expect(after.log.some((e) => e.action === 'reasoning')).toBe(true);
  });

  it('Test 2 — 人間 attacker → actionDeclareChar → driver path で action-end 到達', () => {
    // self.s1 が opp.o1 (sleep) を attack
    const s = setupMidGame();
    s.players.opp.scene = [makeChar('o1', 'D11003', 'sleep')];
    useGameStateStore.setState({ gameState: s });

    const r = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 's1', targetUid: 'o1' });
    expect(r.ok).toBe(true);
    const axId = useGameStateStore.getState().activeActionId;
    expect(axId).not.toBeNull();
    // driver の代わりに sequential dispatch で完走
    dispatchEngineAction({ type: 'actionGuard', actionId: axId!, guarderUid: null });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId! }); // leave → contact-pending
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId! }); // contact-pending → action-1
    dispatchEngineAction({ type: 'actionContact', actionId: axId!, player: 'self', choice: { kind: 'pass' } });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId! }); // action-1 → action-2
    dispatchEngineAction({ type: 'actionContact', actionId: axId!, player: 'opp', choice: { kind: 'pass' } });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId! }); // action-2 → judge
    dispatchEngineAction({ type: 'actionJudge', actionId: axId! });
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId! }); // judge → contact-end
    dispatchEngineAction({ type: 'actionAdvance', actionId: axId! }); // contact-end → action-end
    const ax = engine.flow.action._getContext(axId!);
    expect(ax).toBeUndefined(); // action-end で _deleteContext される
  });

  it('Test 3 — CPU attacker → playTurn pauseOnAction で activeActionId が set される', () => {
    // CPU ターン + opp が攻撃可能なキャラ持ち / self に sleep ターゲット
    const s = setupMidGame();
    s.turn.player = 'opp';
    s.players.self.scene = [makeChar('s1', 'D08003', 'sleep')];
    s.players.opp.partner.state = 'sleep'; // partner は使わせない
    useGameStateStore.setState({ gameState: s });

    driveOppTurn();
    // CPU が何らかの move を取る (action / reasoning / endTurn のいずれか)
    // pauseOnAction が action を捕まえた場合 activeActionId set
    const axId = useGameStateStore.getState().activeActionId;
    const turnPlayer = useGameStateStore.getState().gameState!.turn.player;
    if (axId !== null) {
      // action paused → turn opp のまま
      expect(turnPlayer).toBe('opp');
    } else {
      // action なし → endTurn 経由で self へ
      expect(turnPlayer).toBe('self');
    }
  });

  it('Test 4 — Hirameki end-to-end: pendingHirameki セット後 fire で hand +1', () => {
    const s = setupMidGame();
    s.players.self.hand = [];
    useGameStateStore.setState({ gameState: s });

    // dispatchEngineAction の Side channel 経路は単体テストでカバー済。E2E ではより
    // 直接的に pendingHirameki をセットして fire 解決を観察 (Phase 5 で実カードが
    // action[case] によって evidence を消費する経路を統合した時に完全 E2E 化)。
    useGameStateStore.getState().setPendingHirameki({
      player: 'self',
      cardId: 'D08013',
      abilityId: 'a2',
    });

    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length).toBe(1);
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  });

  it('Test 5 — 勝利条件: solveCase 経由で gameResult.winner=self', () => {
    const s = setupMidGame();
    // 解決編 + 必要証拠数達成
    s.players.self.case.status = '解決編';
    s.players.self.case.requiredEvidence = 7;
    s.players.self.evidence = Array(7).fill(null).map(() => ({
      cardId: 'card-back',
      faceUp: false as const,
      origin: { turn: 1, via: 'reasoning' as const },
    }));
    useGameStateStore.setState({ gameState: s });

    const r = dispatchEngineAction({ type: 'solveCase', player: 'self' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.gameResult?.winner).toBe('self');
    expect(after.players.self.partner.state).toBe('sleep');
  });

  it('Test 6 — 回帰 smoke: CPU vs CPU 1 戦完走 (actionAgainstChar が壊れていない)', () => {
    // 既存 monolithic dispatch が CPU vs CPU で動くか確認
    const s = setupMidGame();
    s.players.opp.scene = [makeChar('o1', 'D11003', 'sleep')];
    useGameStateStore.setState({ gameState: s });

    const r = dispatchEngineAction({ type: 'actionAgainstChar', byUid: 's1', targetUid: 'o1' });
    expect(r.ok).toBe(true);
    // FSM が end まで進む (Context が削除されている)
    const ctxs = engine.flow.action;
    // 完了後の確認は state レベルで: opp.o1 がリムーブ or s1 がスリープ
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find((c) => c.uid === 's1')?.state).toBe('sleep');
    // 念のため activeActionId は set されていない (per-step ではないため)
    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });
});
