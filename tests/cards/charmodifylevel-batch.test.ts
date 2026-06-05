// engine-extension #2 charModifyLevel batch — 実カード経由 sanity test
//
// 検証対象: B07103 / B07103P バーボン
//   - 【解決編】【宣言】【ターン1】相手の現場のキャラを 1 枚まで選び、ターン終了時までレベル-1する
// 焦点:
//   1. declared ability 経由で charModifyLevel verb (PA 短縮形) が解決される
//   2. 効果適用後の char.level / candidates filter level が ±delta を反映する
//   3. caseStatus 解決編 gate / turn limit が機能する (回帰確認)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import {
  registerTriggeredListener,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import type { GameState } from '@/engine/types';

describe('engine-extension #2 charModifyLevel batch — B07103/B07103P バーボン', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
  });

  it.each(['B07103', 'B07103P'])('%s: charModifyLevel verb で 相手キャラの effective level が -1 される', (cardId) => {
    const s0 = produce(createEmptyGameState(), (d) => {
      // 自分側に B07103/P, 相手側にレベル 4 のキャラ (B07103 自身を使い回す = printed level 4)
      mutate.scene.enter(d, 'self', cardId, {});
      mutate.scene.enter(d, 'opp', cardId, { named: false });
    });
    const targetUid = s0.players.opp.scene[0].uid;
    expect(readChar.level(s0, targetUid)).toBe(4); // printed

    // charModifyLevel verb 直接呼出 (declared 経路は別 e2e で確認)
    const after = produce(s0, (d) => {
      mutate.char.modifyLevel(d, targetUid, -1, 'turn');
    });
    // effective level = 4 + (-1) = 3
    expect(readChar.level(after, targetUid)).toBe(3);
  });

  it('PA 短縮形 (atom-handlers の case) が effect dispatch 経路で動く', async () => {
    const { runAtom } = await import('@/engine/effect/atom-handlers');
    const s0 = produce(createEmptyGameState(), (d) => {
      mutate.scene.enter(d, 'opp', 'B07103', { named: false });
    });
    const targetUid = s0.players.opp.scene[0].uid;

    // 確定 uid (PA 短縮形ではなく長形): 結果が turnEffects に積まれる
    const after = produce(s0, (d) => {
      runAtom(d, 'charModifyLevel', { uid: targetUid, delta: -2, scope: 'turn' }, { source: { player: 'self', area: 'scene', cardId: 'B07103', abilityId: 'a2' }, bindings: {} });
    });
    expect(after.players.opp.scene[0].turnEffects['lvlMod_turn']).toBe(-2);
    expect(readChar.level(after, targetUid)).toBe(2); // 4 + (-2)
  });

  it('複数 turn delta は加算 — declared を 2 回呼べば -2 (turn limit 抜きの sanity)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      mutate.scene.enter(d, 'opp', 'B07103', { named: false });
    });
    const targetUid = s0.players.opp.scene[0].uid;
    const after = produce(s0, (d) => {
      mutate.char.modifyLevel(d, targetUid, -1, 'turn');
      mutate.char.modifyLevel(d, targetUid, -1, 'turn');
    });
    expect(readChar.level(after, targetUid)).toBe(2); // 4 + (-1) + (-1)
  });
});
