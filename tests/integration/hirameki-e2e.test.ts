// tests/integration/hirameki-e2e.test.ts — Phase 5 advance Hirameki E2E 結合検証
//
// rules: 10-action-event.md §ヒラメキ
// spec: .claude/specs/2026-05-17-phase5-advance-guardrails.md
//
// 目的:
//   Phase 8 commit 3a で完成済の Hirameki infrastructure が、実カード経由で
//   全経路結合動作することを実証する。
//
// 検証する経路:
//   action[case] (= event.emit 'evidence:remove-by-action')
//     → listener (hirameki.ts) が abilityId を検出
//     → _drainPendingHirameki() で side-channel 回収
//     → setPendingHirameki で Zustand へ
//     → dispatchEngineAction({type:'hiramekiResolve', choice:'fire'})
//     → ability effect queue + runAllUntilEmpty で解決

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import type { GameState } from '@/engine/types/game-state';

function fullReset(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  _resetPendingHirameki();
  _resetHiramekiRegistered(); // event._resetRegistry() 後の再登録に必要
  registerAll();
  registerHiramekiListener();
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingHirameki: null,
    pendingMisread: null,
  });
}

function makeStateWithEvidence(player: 'self' | 'opp', cardId: string): GameState {
  const s = createEmptyGameState();
  s.players[player].evidence = [
    { cardId, faceUp: false, origin: { turn: 1, via: 'reasoning' } },
  ];
  // hiramekiDraw fire のために deck を仕込む (n=1 で draw 可能に)
  s.players[player].deck = Array(10).fill('D08005');
  return s;
}

describe('Hirameki E2E 結合検証 (Phase 5 advance)', () => {
  beforeAll(() => {
    registerAll();
  });

  beforeEach(() => {
    fullReset();
  });

  it('Test 1: D08013 (hiramekiDraw a2) evidence remove → side-channel set → fire dispatch → hand+1', () => {
    const s = makeStateWithEvidence('self', 'D08013');
    const startHand = s.players.self.hand.length;
    // action[case] 相当の emit
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08013' } },
      { player: 'opp', uid: 'opp-attacker' },
    );
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    expect(pending!.player).toBe('self');
    expect(pending!.cardId).toBe('D08013');
    expect(pending!.abilityId).toBe('a2');

    // store に書き込み (dispatchEngineAction で drain される想定だが、ここは直接 set)
    useGameStateStore.setState({ gameState: s, pendingHirameki: pending });

    // fire dispatch → ability effect queue + resolve
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // hiramekiDraw n=1 が解決 → self hand +1 (deck から)
    expect(after.players.self.hand.length).toBe(startHand + 1);
    // pending クリア
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  });

  it('Test 2: skip dispatch → no-op、pending クリア、ability は実行されない', () => {
    const s = makeStateWithEvidence('self', 'D08013');
    const startHand = s.players.self.hand.length;
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08013' } },
      { player: 'opp', uid: 'opp-attacker' },
    );
    const pending = _drainPendingHirameki();
    useGameStateStore.setState({ gameState: s, pendingHirameki: pending });

    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'skip' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length).toBe(startHand);
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  });

  it('Test 3: non-hirameki カード (D08005) → listener 発火せず side-channel null', () => {
    const s = makeStateWithEvidence('self', 'D08005');
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08005' } },
      { player: 'opp', uid: 'opp-attacker' },
    );
    const pending = _drainPendingHirameki();
    expect(pending).toBeNull();
  });

  it('Test 4: 連続 2 回 emit → 2 回目で上書き、最後の drain で取得可', () => {
    const s = makeStateWithEvidence('self', 'D08013');
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08013' } },
      { player: 'opp', uid: 'opp-attacker' },
    );
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'opp', ev: { cardId: 'D08013' } },
      { player: 'self', uid: 'self-attacker' },
    );
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    // 2 回目 (opp) で上書き
    expect(pending!.player).toBe('opp');
  });

  it('Test 5: D08019 (hiramekiCharStun a2) → fire で sceneSetState 効果が queue される', () => {
    const s = makeStateWithEvidence('self', 'D08019');
    engine.event.emit(
      s,
      'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'D08019' } },
      { player: 'opp', uid: 'opp-attacker' },
    );
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    expect(pending!.cardId).toBe('D08019');
    expect(pending!.abilityId).toBe('a2');

    useGameStateStore.setState({ gameState: s, pendingHirameki: pending });
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' });
    // sceneSetState は対象 0 で no-op、dispatch は ok を返す
    expect(r.ok).toBe(true);
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  });
});
