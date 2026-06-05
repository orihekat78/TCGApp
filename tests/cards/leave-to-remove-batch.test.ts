// engine-extension #1 leave:to-remove batch — 実カード経由 sanity test
//
// 検証対象: D03013 / D04010 / B03013 / B03091 / B03130 / B04010 / B06009 / B08084 / B08089 / PR054
// 焦点: leave:to-remove で 自身の a1 (drawの場合) effect が queue されることを実カード経由で確認。
//   - 既存 leave-to-remove.test.ts は fake card で hook 配線を検証 (engine 層)
//   - 本 test は real card def + registerAll() で「カードとして」発火するかを検証 (cards 層)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import {
  registerTriggeredListener,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import type { GameState } from '@/engine/types';

/** scene に登場 → effect cause で removeToRemove。produce 内で実行し after を返す。 */
function enterThenRemove(state: GameState, cardId: string): GameState {
  return produce(state, (draft) => {
    const ch = mutate.scene.enter(draft, 'self', cardId, {});
    mutate.scene.removeToRemove(draft, ch.uid, 'effect');
  });
}

/**
 * turn=opp gate を満たすため state.turn.byPlayer を 'opp' に。
 * (selfOnly:true なので self の現場に登場 + opp ターンで自身の leave 発火が条件)
 */
function setOppTurn(state: GameState): GameState {
  return produce(state, (draft) => {
    draft.turn.player = 'opp';
  });
}

describe('engine-extension #1 leave:to-remove batch — 実カード経由 sanity', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
  });

  it.each([
    ['D03013', '鈴木次郎吉'],   // 引く1
    ['D04010', 'ジョディ・スターリング'], // 相手 discard 1
    ['B03013', '大尉'],          // AP-2000 turn
    ['B03091', '高木長介'],      // 自分の警察 AP+1000 turn
    ['B03130', 'マッドサイエンティスト'], // 引く1
    ['B04010', '本堂瑛祐'],      // level≤4 sleep
    ['B06009', 'トラカゲ'],      // 引く1 + discard 1
    ['B08084', 'ウォッカ'],      // 引く1 + discard 1
    ['B08089', 'ヘルエンジェル'], // 引く1 + 解決編 conditional discard 1
    ['PR054',  '灰原哀'],        // 登場時 draw + leave self-discard 1
    // batch #2 (2026-06-05 残課題)
    ['D03004', '怪盗キッド'],    // level≤5 sleep state → stun
    ['B08042', 'メデューサ'],    // sleep state → stun (no level limit)
    ['B04030', '黒羽快斗'],      // level≤8 stun
    ['B04030P', '黒羽快斗 P'],   // 同
    ['B04059', '水無怜奈'],      // level≤5 sleep
    ['B09007', '脇田兼則'],      // 引く1
    ['B09007P', '脇田兼則 P'],   // 同
  ])('%s (%s): 相手ターン中の leave:to-remove で pendingEffects に queue される', (cardId) => {
    const s = setOppTurn(createEmptyGameState());
    const after = enterThenRemove(s, cardId);
    // 少なくとも 1 件 effect が queue (PR054 は enter draw 含む 2 件、その他は a1 leave のみ 1 件)
    expect(after.pendingEffects.length).toBeGreaterThanOrEqual(1);
    // leave:to-remove triggered effect が含まれる
    const hasLeave = after.pendingEffects.some((pe) => pe.triggeredBy.hook === 'leave:to-remove');
    expect(hasLeave, `${cardId} leave:to-remove not queued`).toBe(true);
  });

  it('D03013: 自分ターン中 (condition turn=opp 不一致) では発火しない', () => {
    // byPlayer 既定 'self' のままなので turn=opp condition で gate される
    const after = enterThenRemove(createEmptyGameState(), 'D03013');
    const hasLeave = after.pendingEffects.some((pe) => pe.triggeredBy.hook === 'leave:to-remove');
    expect(hasLeave).toBe(false);
  });
});
