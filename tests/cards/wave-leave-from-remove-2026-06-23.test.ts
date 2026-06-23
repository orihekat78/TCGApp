// wave leave-from-remove (2026-06-23) — 【相手ターン中】【現場リムーブ時】→ リムーブエリアから登場/手札 (engine変更0)
//
// 検証対象 (10 枚): B02075/P 諸伏高明 (trait 長野県警 Lv≤6 sleep登場) / B02066/P メアリー (a1 enter draw+discard,
//   a2 cardName メアリー Lv≤5 sleep登場) / B05091/P 風見裕也 (a1 絆降谷零 突撃[キャラ], a2 cardName 降谷零 Lv≤6 sleep登場,
//   a3 ヒラメキ sleep) / B05099/P 高木渉 (and[partnerColor黄,turn opp] trait 警察 Lv≤4 sleep登場) /
//   B05058 富沢雄三 (a2 trait 鈴木財閥 → 手札, a1 継続trait付与 DEFER) / B05116 火傷の男 (a2 color黒 Lv≤4 sleep登場, a1 forced-target DEFER)。
//
// engine変更0: leave:to-remove (B03113) + sceneEnter from:remove (B02038) + handAddFromRemove (B03005) の既存 settled path 再録。
// コア (a2 leave→from-remove) は decoy 込み behavioral 1対1。二次節 (enter draw+discard / 絆 continuous keyword /
//   ヒラメキ sleep) は verbatim 既存 pattern ゆえ structural 同型断言。
// DEFER (DEFERRED-INDEX §leave-from-remove): B05111 全体 (ヒラメキ「アクション中のキャラ」actor-binding gap) /
//   B05058 a1 (継続 self-trait 付与機構なし) / B05116 a1 (forced-target 機構なし)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { GameState, SceneCharacter } from '@/engine/types';
import { B02075 } from '@/cards/ct-p02/B02075';
import { B02075P } from '@/cards/ct-p02/B02075P';
import { B02066 } from '@/cards/ct-p02/B02066';
import { B02066P } from '@/cards/ct-p02/B02066P';
import { B05091 } from '@/cards/ct-p05/B05091';
import { B05091P } from '@/cards/ct-p05/B05091P';
import { B05099 } from '@/cards/ct-p05/B05099';
import { B05099P } from '@/cards/ct-p05/B05099P';
import { B05058 } from '@/cards/ct-p05/B05058';
import { B05116 } from '@/cards/ct-p05/B05116';
import { sceneChar as baseScene } from '../helpers/fixtures';

function sceneChar(cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter {
  return baseScene(cardId, uid, { state });
}

function oppTurn(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false }; // 【相手ターン中】
  return s;
}

describe('wave leave-from-remove — 【相手ターン中】【現場リムーブ時】→ リムーブエリアから登場/手札', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---------- B02075 諸伏高明: trait 長野県警 Lv≤6 (登録 pool に Lv≤6 長野県警 不在 → decoy 除外で filter 検証) ----------
  it('B02075: 相手ターン現場リムーブ — 長野県警 Lv7(D09006) は levelMax6 で除外 / 警察非長野県警(D05011) は trait で除外', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B02075', 'moro#1')];
    // remove: D09006(諸伏高明 L7 長野県警=level decoy) / D05011(白鳥 L3 警察,警視庁=trait decoy)
    s.players.self.remove = ['D09006', 'D05011'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'moro#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'D09006'), 'L7 長野県警は登場しない (levelMax6)').toBeFalsy();
    expect(s.players.self.scene.find((c) => c.cardId === 'D05011'), '警察非長野県警は登場しない (trait)').toBeFalsy();
    // leaving char B02075(自身 L7 長野県警) も remove へ移動 → levelMax6 で自己再登場も除外 = 3枚全残存
    expect([...s.players.self.remove].sort(), '誰も登場せず remove 3枚全残存 (自身L7含む)').toEqual(['B02075', 'D05011', 'D09006']);
  });

  it('B02075: 自分ターンでは発火しない (【相手ターン中】gate)', () => {
    let s = oppTurn();
    s.turn.player = 'self';
    s.players.self.scene = [sceneChar('B02075', 'moro#1')];
    s.players.self.remove = ['D09006'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'moro#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.scene.length, '自分ターンは何も登場しない').toBe(0);
  });

  it('B02075/B02075P: 構造同型 (parallel)', () => {
    const a = B02075.abilities[0];
    expect(a.trigger).toEqual({ hook: 'leave:to-remove', selfOnly: true });
    expect(a.condition).toEqual({ kind: 'turn', player: 'opp' });
    expect((a.effect as any).verb).toBe('sceneEnter');
    expect((a.effect as any).args).toMatchObject({ player: 'self', from: 'remove', max: 1, viaEffect: true, enterSleep: true, filter: { trait: '長野県警', levelMax: 6, kind: 'character' } });
    expect(B02075P.abilities).toEqual(B02075.abilities);
  });

  // ---------- B02066 メアリー: a2 cardName メアリー Lv≤5 sleep登場 (positive + decoy) ----------
  it('B02066: 相手ターン現場リムーブ — メアリー L3(B02065) がスリープ登場 / 赤非メアリー(D04004) は除外', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B02066', 'mary#1')];
    // remove: B02065(メアリー L3 ≤5 = match) / D04004(赤井秀一 赤 = cardName 不一致)
    s.players.self.remove = ['B02065', 'D04004'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'mary#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    const entered = s.players.self.scene.find((c) => c.cardId === 'B02065');
    expect(entered, 'メアリー B02065 が登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場 (enterSleep)').toBe('sleep');
    expect(s.players.self.remove, 'B02065 はリムーブから抜けた').not.toContain('B02065');
    expect(s.players.self.scene.find((c) => c.cardId === 'D04004'), '赤非メアリーは登場しない').toBeFalsy();
    expect(s.players.self.remove, 'D04004 はリムーブに残る').toContain('D04004');
  });

  it('B02066: a1 = 【登場時】draw+discard 構造 (enter trigger, sequence[draw,discard])', () => {
    const a1 = B02066.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const steps = (a1.effect as any).steps;
    expect(steps[0]).toEqual({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
    expect(steps[1]).toEqual({ kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } });
    expect(B02066P.abilities).toEqual(B02066.abilities);
  });

  // ---------- B05091 風見裕也: a2 cardName 降谷零 Lv≤6 sleep登場 (positive + level decoy) ----------
  it('B05091: 相手ターン現場リムーブ — 降谷零 L3(B02078) がスリープ登場 / 降谷零 L8(D05002) は levelMax6 で除外', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B05091', 'kazami#1')];
    // remove: B02078(降谷零 L3 ≤6 = match) / D05002(降谷零 L8 = level decoy)
    s.players.self.remove = ['B02078', 'D05002'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'kazami#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    const entered = s.players.self.scene.find((c) => c.cardId === 'B02078');
    expect(entered, '降谷零 B02078 が登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.self.scene.find((c) => c.cardId === 'D05002'), 'L8 降谷零は登場しない (levelMax6)').toBeFalsy();
    expect(s.players.self.remove, 'D05002 はリムーブに残る').toContain('D05002');
  });

  it('B05091: a1 = 絆降谷零 continuous 突撃[キャラ] / a3 = ヒラメキ sleep 構造同型', () => {
    const [a1, , a3] = B05091.abilities;
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'bond', cardName: '降谷零' });
    expect((a1 as any).continuousModifier.grantKeywords()).toEqual(['突撃[キャラ]']);
    expect(a3.scope).toBe('on-evidence');
    expect(a3.trigger).toEqual({ hook: 'evidence:remove-by-action', optional: true });
    expect((a3.effect as any).verb).toBe('sceneSetState');
    expect((a3.effect as any).args.state).toBe('sleep');
    // parallel: a1 は grantKeywords closure を含むため deep-equal 不可 → 構造同型を分割断言
    expect(B05091P.abilities.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect((B05091P.abilities[0] as any).continuousModifier.grantKeywords()).toEqual(['突撃[キャラ]']);
    expect(B05091P.abilities[0].condition).toEqual({ kind: 'bond', cardName: '降谷零' });
    expect(B05091P.abilities[1]).toEqual(B05091.abilities[1]); // a2 (closure無)
    expect(B05091P.abilities[2]).toEqual(B05091.abilities[2]); // a3 (closure無)
  });

  // ---------- B05099 高木渉: and[partnerColor黄, turn opp] trait 警察 Lv≤4 sleep登場 ----------
  it('B05099: パートナー黄 + 相手ターン現場リムーブ — 警察 L4(D05013) がスリープ登場 / 警察 L5(D03006) は levelMax4 で除外', () => {
    let s = oppTurn();
    s.players.self.partner.cardId = 'D05001'; // 黄 partner → 【パートナー黄】成立
    s.players.self.scene = [sceneChar('B05099', 'takagi#1')];
    // remove: D05013(高木渉 L4 警察 = match) / D03006(中森銀三 L5 警察 = level decoy)
    s.players.self.remove = ['D05013', 'D03006'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'takagi#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    const entered = s.players.self.scene.find((c) => c.cardId === 'D05013');
    expect(entered, '警察 L4 D05013 が登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.self.scene.find((c) => c.cardId === 'D03006'), 'L5 警察は登場しない (levelMax4)').toBeFalsy();
  });

  it('B05099: パートナー非黄では発火しない (【パートナー黄】gate)', () => {
    let s = oppTurn();
    s.players.self.partner.cardId = 'D01001'; // 青 partner → gate 不成立
    s.players.self.scene = [sceneChar('B05099', 'takagi#1')];
    s.players.self.remove = ['D05013'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'takagi#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'D05013'), 'パートナー非黄では登場しない').toBeFalsy();
    expect(B05099P.abilities).toEqual(B05099.abilities);
  });

  // ---------- B05058 富沢雄三: a2 trait 鈴木財閥 → 手札 (a1 DEFER) ----------
  it('B05058: 相手ターン現場リムーブ — 鈴木財閥(D03012) を手札へ / 非鈴木財閥(D04004) は除外', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B05058', 'tomizawa#1')];
    // remove: D03012(鈴木朋子 鈴木財閥 = match) / D04004(赤井秀一 = trait 不一致)
    s.players.self.remove = ['D03012', 'D04004'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'tomizawa#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    expect(s.players.self.hand, '鈴木財閥 D03012 を手札に加える').toContain('D03012');
    expect(s.players.self.remove, 'D03012 はリムーブから抜けた').not.toContain('D03012');
    expect(s.players.self.hand, '非鈴木財閥 D04004 は手札に加えない').not.toContain('D04004');
    expect(s.players.self.remove, 'D04004 はリムーブに残る').toContain('D04004');
  });

  it('B05058: a1 (継続trait付与) は DEFER ゆえ abilities は a2 のみ', () => {
    expect(B05058.abilities.length).toBe(1);
    expect(B05058.abilities[0].id).toBe('a2');
    expect((B05058.abilities[0].effect as any).verb).toBe('handAddFromRemove');
  });

  // ---------- B05116 火傷の男: a2 color 黒 Lv≤4 sleep登場 (a1 DEFER) ----------
  it('B05116: 相手ターン現場リムーブ — 黒 L2(B07101) がスリープ登場 / 黒 L6(D07008) は levelMax4 で除外', () => {
    let s = oppTurn();
    s.players.self.scene = [sceneChar('B05116', 'yakedo#1')];
    // remove: B07101(テキーラ L2 黒 = match) / D07008(ベルモット L6 黒 = level decoy)
    s.players.self.remove = ['B07101', 'D07008'];
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'yakedo#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    const entered = s.players.self.scene.find((c) => c.cardId === 'B07101');
    expect(entered, '黒 L2 B07101 が登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.self.scene.find((c) => c.cardId === 'D07008'), 'L6 黒は登場しない (levelMax4)').toBeFalsy();
    expect(s.players.self.remove, 'D07008 はリムーブに残る').toContain('D07008');
  });

  it('B05116: a1 (forced-target) は DEFER ゆえ abilities は a2 のみ', () => {
    expect(B05116.abilities.length).toBe(1);
    expect(B05116.abilities[0].id).toBe('a2');
    expect((B05116.abilities[0].effect as any).args.filter).toEqual({ color: '黒', levelMax: 4, kind: 'character' });
  });
});
