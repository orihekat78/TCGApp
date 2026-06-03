// tests/engine/listeners/triggered-limit-guard — BUG-096 / BUG-097
// Fix1: triggered ability の limit:{turn,n} (【ターン①】) を enforcement (1ターン1回)。
// Fix2: D11016 a1 が「このキャラがガードしたとき」(guardUid===自分) のみ発火 (過剰発火修正)。
//
// 手法: triggered listener を登録し action:guarded hook を emit、pendingEffects に
// 積まれた (= 発火した) かどうかで gate を検証する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { engine } from '@/engine';
import { createEmptyGameState } from '@/engine/state-factory';
import { D11016 } from '@/cards/ct-d11/D11016';
import type { GameState } from '@/engine/types';

function sceneChar(cardId: string, uid: string) {
  return {
    cardId,
    uid,
    state: 'active' as const,
    isNamed: false,
    enterOrder: 1,
    enterOrderThisTurn: 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

// D11016 を self 現場に置き、相手ターン中 (a1 condition {turn,opp}) の state を作る
function setup(): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = 'opp';
    d.players.self.scene.push(sceneChar('D11016', 'D11016#0'));
  });
}

// 攻撃者 atk が guardUid をガードした、という action:guarded を emit
function emitGuard(s: GameState, guardUid: string): GameState {
  return produce(s, (d) => {
    event.emit(d, 'action:guarded', { byUid: 'atk', guardUid }, { player: 'opp', uid: 'atk' });
  });
}

describe('triggered limit + D11016 guardedBySelf (BUG-096/097)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    engine.cards._resetRegistry();
    engine.cards.register(D11016);
  });

  it('D11016 a1: 自分(D11016#0)がガード → 1回発火 (pendingEffects 1)', () => {
    registerTriggeredListener();
    const s = emitGuard(setup(), 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1);
  });

  it('Fix1 (limit): 同一ターンに2回ガード → 1回のみ発火 (2回目は limit で skip)', () => {
    registerTriggeredListener();
    let s = emitGuard(setup(), 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1);
    s = emitGuard(s, 'D11016#0'); // 同ターン2回目
    expect(s.pendingEffects).toHaveLength(1); // 増えない (【ターン1】enforcement)
  });

  it('Fix2 (guardedBySelf): 別キャラがガード → D11016 a1 不発火 (pendingEffects 0)', () => {
    registerTriggeredListener();
    const s = emitGuard(setup(), 'OTHER#9'); // D11016 以外がガード
    expect(s.pendingEffects).toHaveLength(0);
  });

  it('Fix1 limit reset: declaredUseCount がリセットされれば再度発火可 (ターン境界相当)', () => {
    registerTriggeredListener();
    let s = emitGuard(setup(), 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1);
    // ターン境界相当: resetTurnFlags が scene の declaredUseCount を空にするのと同じ操作
    s = produce(s, (d) => {
      d.players.self.scene[0].declaredUseCount = {};
      d.pendingEffects = []; // 前ターン分の queue をクリア (検証のため)
    });
    s = emitGuard(s, 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1); // リセット後は再度発火 (限界はカウンタ式)
  });
});
