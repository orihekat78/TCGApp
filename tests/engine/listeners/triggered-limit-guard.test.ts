// tests/engine/listeners/triggered-limit-guard — BUG-096 / BUG-097
// Fix1: triggered ability の limit:{turn,n} (【ターン①】) を enforcement (1ターン1回)。
// Fix2: D11016 a1 は「このキャラが指定されたアクション」を別キャラがガードしたときのみ発火。
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
import { D11007 } from '@/cards/ct-d11/D11007';
import type { GameState } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

function sceneChar(cardId: string, uid: string, apOverride: number | null = null) {
  return baseScene(cardId, uid, { apOverride });
}

// D11016 を self 現場に置き、相手ターン中 (a1 condition {turn,opp}) の state を作る
function setup(): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.turn.player = 'opp';
    d.players.self.scene.push(sceneChar('D11016', 'D11016#0'));
  });
}

// 攻撃者 atk の元対象 targetUid を guardUid がガードした action:guarded を emit
function emitGuard(s: GameState, guardUid: string, targetUid: string): GameState {
  return produce(s, (d) => {
    event.emit(d, 'action:guarded', { byUid: 'atk', guardUid, targetUid }, { player: 'opp', uid: 'atk' });
  });
}

describe('triggered limit + D11016 selected-target guard (BUG-096/097)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    engine.cards._resetRegistry();
    engine.cards.register(D11016);
  });

  it('D11016 a1: D11016#0 が元対象で別キャラがガード → 1回発火', () => {
    registerTriggeredListener();
    const s = emitGuard(setup(), 'OTHER#9', 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1);
  });

  it('Fix1 (limit): 同一ターンに2回ガード → 1回のみ発火 (2回目は limit で skip)', () => {
    registerTriggeredListener();
    let s = emitGuard(setup(), 'OTHER#9', 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1);
    s = emitGuard(s, 'OTHER#9', 'D11016#0'); // 同ターン2回目
    expect(s.pendingEffects).toHaveLength(1); // 増えない (【ターン1】enforcement)
  });

  it('Fix2: D11016 自身が別対象をガード → a1 不発火', () => {
    registerTriggeredListener();
    const s = emitGuard(setup(), 'D11016#0', 'OTHER#9');
    expect(s.pendingEffects).toHaveLength(0);
  });

  it('Fix1 limit reset: declaredUseCount がリセットされれば再度発火可 (ターン境界相当)', () => {
    registerTriggeredListener();
    let s = emitGuard(setup(), 'OTHER#9', 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1);
    // ターン境界相当: resetTurnFlags が scene の declaredUseCount を空にするのと同じ操作
    s = produce(s, (d) => {
      d.players.self.scene[0].declaredUseCount = {};
      d.pendingEffects = []; // 前ターン分の queue をクリア (検証のため)
    });
    s = emitGuard(s, 'OTHER#9', 'D11016#0');
    expect(s.pendingEffects).toHaveLength(1); // リセット後は再度発火 (限界はカウンタ式)
  });
});

describe('D11007 a3 contactOpponentApHigher 自己照合 (BUG-098)', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    engine.cards._resetRegistry();
    engine.cards.register(D11007);
  });

  // D11007 (AP override 4000) を self 現場、高AP相手 (override 6000) を opp 現場に置く。
  // a3 condition は {turn,self} なので自分ターン中。
  function setup(): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.scene.push(sceneChar('D11007', 'D11007#0', 4000));
      d.players.opp.scene.push(sceneChar('D11007', 'HIGH#0', 6000)); // cardId 流用、override で高AP
    });
  }

  function emitContact(s: GameState, aUid: string, bUid: string): GameState {
    return produce(s, (d) => {
      event.emit(d, 'contact:start', { aUid, bUid }, { player: 'self', uid: aUid });
    });
  }

  it('自分(D11007)が高AP相手と攻撃コンタクト → 発火 (pendingEffects 1)', () => {
    registerTriggeredListener();
    const s = emitContact(setup(), 'D11007#0', 'HIGH#0');
    expect(s.pendingEffects).toHaveLength(1);
  });

  it('別キャラ(OTHER)が攻撃者のコンタクト → D11007 a3 不発火 (自己照合、pendingEffects 0)', () => {
    registerTriggeredListener();
    const s = emitContact(setup(), 'OTHER#0', 'HIGH#0');
    expect(s.pendingEffects).toHaveLength(0);
  });
});
