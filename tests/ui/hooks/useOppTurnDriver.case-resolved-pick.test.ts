// BUG-090: human の auto-phase で 事件編→解決編 になり case card a1 (case:to-resolved →
// discard) が発火しても、その discard pick が UI に surface せず「何も起きない」問題の回帰テスト。
//
// rules: 01-victory-conditions.md (解決編移行), 15-abilities-effects.md (条件発動)
//
// 根本原因: driveOppTurn は opp ターン終了後に flow.startTurn(self)+runAllUntilEmpty で
//   human の auto-phase を回す。__humanPlayerSide='self' のとき a1 の discard は side-channel
//   pick queue (__pendingEffectPickQueue) に積まれるが、driveOppTurn は dispatchEngineAction
//   と違い _drainPendingEffectPickSide → store.setPendingEffectPick を呼ばず、pick が取り残されて
//   EffectPickerModal が出なかった。

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest';
import { driveOppTurn, _resetIsDriving } from '@/ui/hooks/useOppTurnDriver';
import { useGameStateStore } from '@/ui/state/store';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _setHumanPlayerSide } from '@/engine/listeners/triggered';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { registerAll } from '@/cards';
import type { GameState } from '@/engine/types/game-state';

/**
 * opp は endTurn しかできない最小状態 + human(self) は D08026 事件編 / FILE 6。
 * driveOppTurn → opp endTurn → flow.startTurn(self) の auto-phase で FILE +2 = 8 →
 * 解決編へ移行し a1 (discard) が発火する。手札に候補が2枚あるので human pick が必要。
 */
function setup(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: 'D08001', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'PO', state: 'sleep', location: 'partner-area' };
  s.players.opp.deck = ['c1', 'c2', 'c3'];
  s.players.opp.case = { cardId: 'CO', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  s.players.self.case = { cardId: 'D08026', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} };
  const fb = { type: 'card-back' as const, cardId: 'D08017' };
  s.players.self.file = [fb, fb, fb, fb, fb, fb]; // 6 → auto-phase +2 = 8 → 解決編
  s.players.self.deck = ['D08017', 'D08017', 'D08017', 'D08017'];
  s.players.self.hand = ['D08017', 'D08019'];
  return s;
}

describe('driveOppTurn — human auto-phase で解決編移行時の a1 discard pick surface (BUG-090)', () => {
  beforeAll(() => registerAll());
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
    _resetIsDriving();
    _resetActionContexts();
    _clearPendingEffectPickQueue();
    _setHumanPlayerSide('self');
  });
  afterEach(() => _setHumanPlayerSide(null));

  it('FILE7→解決編→a1: store.pendingEffectPick に discard pick が surface する', () => {
    useGameStateStore.setState({ gameState: setup() });

    driveOppTurn();

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.case.status, 'auto-phase で解決編へ移行').toBe('解決編');

    const pick = useGameStateStore.getState().pendingEffectPick;
    expect(pick, 'a1 の discard pick が store に surface すべき (取り残し禁止)').not.toBeNull();
    expect(pick?.atomVerb).toBe('discard');
    expect(pick?.player).toBe('self');
    // 候補は手札のカード (リムーブ対象を human が選ぶ)
    expect((pick?.candidates.length ?? 0), '手札候補が存在').toBeGreaterThan(0);
  });
});
