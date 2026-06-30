// engine additive wave (2026-06-30) — 4 つの純 additive 評価器 primitive の挙動テスト。
//
// #1 evidenceDiff Condition — 「相手の証拠が自分の証拠より N 以上多い場合」(B05103
//    「籌を帷幄の中に運らし…」= player:'opp', other:'self', n:2 → opp.evidence − self.evidence >= 2)。
//    evidenceAtLeast(片側閾値)では差を表現できない。player/other は resolvePlayer 規約。
// #2 sceneCountCompare Condition — 自他現場キャラ枚数の比較 (B05081 威嚇射撃「自分の現場にいる
//    キャラが相手の現場にいるキャラより少ない場合」= player:'self', other:'opp', cmp:'lt')。
//    handCountAtLeastOther の scene 版だが cmp で 5 比較子を一般化。.scene.length = キャラ枚数。
// #3 removeColorAtLeast.cardKind — リムーブエリアを色 AND カード種別で計数 (B08004 江戸川コナン
//    「自分のリムーブエリアに【黒】のキャラが3枚以上ある場合に宣言できる」= 黒イベントを数えない)。
//    既存 removeColorAtLeast に optional cardKind を追加 (未指定なら従来通り全種別 = 回帰0)。
// #4 $self.sceneColorNot.<color> dyn — 現場で「指定色以外の色を持つ」キャラ数 (B02002 江戸川コナン
//    「自分の現場にいる【青】以外の色を持つキャラ1枚につき AP+1000」)。colorNot は some説 (公式 B08079)。
//
// いずれも既存登録カードは未宣言/未使用 ⇒ 挙動不変 (smoke baseline 不変)。専用テスト必須。
// rules: 01(証拠), 03(現場=scene), 15(「〜の場合」effect 内 conditional / 「以上」), 16(セット),
//        19(色は変装で変わりうる=charRead.colors が現 cardId 参照), 22(アクション宣言タイミング)。

import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { evalDyn } from '@/engine/dyn/eval';
import { char as charRead } from '@/engine/read/char';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Condition, EffectCtx } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function ev(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'event', names: [id], colors: ['青'], level: 4, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
});

// ============================================================
// #1 evidenceDiff Condition (B05103)
// ============================================================
describe('engine-additive-0630 #1 evidenceDiff', () => {
  function setup(selfN: number, oppN: number): GameState {
    const s = createEmptyGameState();
    s.players.self.evidence = Array.from({ length: selfN }, () => ({ cardId: 'X', faceUp: false }));
    s.players.opp.evidence = Array.from({ length: oppN }, () => ({ cardId: 'X', faceUp: false }));
    return s;
  }
  const cond = (player: 'self' | 'opp', other: 'self' | 'opp', n: number): Condition =>
    ({ kind: 'evidenceDiff', player, other, n } as unknown as Condition);

  it('opp − self = 2 ≥ n:2 → true (B05103 相手が2つ以上多い)', () => {
    expect(evalCond(setup(3, 5), cond('opp', 'self', 2), makeCtx())).toBe(true);
  });
  it('opp − self = 1 < n:2 → false', () => {
    expect(evalCond(setup(4, 5), cond('opp', 'self', 2), makeCtx())).toBe(false);
  });
  it('opp − self = 3 ≥ n:2 → true', () => {
    expect(evalCond(setup(2, 5), cond('opp', 'self', 2), makeCtx())).toBe(true);
  });
  it('差が負 (self の方が多い) → false', () => {
    expect(evalCond(setup(6, 2), cond('opp', 'self', 2), makeCtx())).toBe(false);
  });
  it('player/other は resolvePlayer 規約 (source.player=opp 視点で反転)', () => {
    // owner=opp の場合、cond.player:'self'=opp実体, cond.other:'opp'=self実体 → opp(5)-self(3)=2
    const ctx = makeCtx({ source: { player: 'opp', area: 'scene' } });
    expect(evalCond(setup(3, 5), cond('self', 'opp', 2), ctx)).toBe(true);
  });
});

// ============================================================
// #2 sceneCountCompare Condition (B05081)
// ============================================================
describe('engine-additive-0630 #2 sceneCountCompare', () => {
  function setup(selfN: number, oppN: number): GameState {
    registerCardDef(ch('C'));
    const s = createEmptyGameState();
    s.players.self.scene = Array.from({ length: selfN }, (_, i) => sceneChar('C', `s${i}`));
    s.players.opp.scene = Array.from({ length: oppN }, (_, i) => sceneChar('C', `o${i}`));
    return s;
  }
  const cmp = (c: 'lt' | 'le' | 'gt' | 'ge' | 'eq', p: 'self' | 'opp' = 'self', o: 'self' | 'opp' = 'opp'): Condition =>
    ({ kind: 'sceneCountCompare', player: p, other: o, cmp: c } as unknown as Condition);

  it('self(1) < opp(3) → cmp:lt true (B05081 自分が少ない)', () => {
    expect(evalCond(setup(1, 3), cmp('lt'), makeCtx())).toBe(true);
  });
  it('self(3) < opp(3) → cmp:lt false (同数)', () => {
    expect(evalCond(setup(3, 3), cmp('lt'), makeCtx())).toBe(false);
  });
  it('self(3) ≤ opp(3) → cmp:le true', () => {
    expect(evalCond(setup(3, 3), cmp('le'), makeCtx())).toBe(true);
  });
  it('self(3) = opp(3) → cmp:eq true / self(2) eq opp(3) false', () => {
    expect(evalCond(setup(3, 3), cmp('eq'), makeCtx())).toBe(true);
    expect(evalCond(setup(2, 3), cmp('eq'), makeCtx())).toBe(false);
  });
  it('self(4) > opp(3) → cmp:gt true / cmp:ge true', () => {
    expect(evalCond(setup(4, 3), cmp('gt'), makeCtx())).toBe(true);
    expect(evalCond(setup(4, 3), cmp('ge'), makeCtx())).toBe(true);
  });
});

// ============================================================
// #3 removeColorAtLeast.cardKind (B08004)
// ============================================================
describe('engine-additive-0630 #3 removeColorAtLeast.cardKind', () => {
  function setup(): GameState {
    registerCardDef(ch('K1', { colors: ['黒'] }));
    registerCardDef(ch('K2', { colors: ['黒'] }));
    registerCardDef(ev('KEVT', { colors: ['黒'] })); // 黒イベント (decoy: 「キャラ」には数えない)
    const s = createEmptyGameState();
    s.players.self.remove = ['K1', 'K2', 'KEVT']; // 黒キャラ2 + 黒イベ1
    return s;
  }
  const cond = (n: number, cardKind?: 'character' | 'event'): Condition =>
    ({ kind: 'removeColorAtLeast', player: 'self', color: '黒', n, cardKind } as unknown as Condition);

  it('cardKind:character で 黒キャラ2枚のみ計数 → n:3 false (黒イベは数えない、B08004)', () => {
    expect(evalCond(setup(), cond(3, 'character'), makeCtx())).toBe(false);
  });
  it('cardKind:character で n:2 → true', () => {
    expect(evalCond(setup(), cond(2, 'character'), makeCtx())).toBe(true);
  });
  it('cardKind 未指定 (従来) → 黒3枚全部計数 n:3 true (回帰0)', () => {
    expect(evalCond(setup(), cond(3), makeCtx())).toBe(true);
  });
  it('cardKind:event で 黒イベ1枚のみ → n:1 true / n:2 false', () => {
    expect(evalCond(setup(), cond(1, 'event'), makeCtx())).toBe(true);
    expect(evalCond(setup(), cond(2, 'event'), makeCtx())).toBe(false);
  });
  it('未登録id (lookupCardDef→null, d?.kind=undefined) は cardKind 指定時に計数しない (review minor guard)', () => {
    const s = setup();
    s.players.self.remove = ['K1', 'K2', 'GHOST']; // GHOST は registerCardDef されていない
    // cardKind:character → K1,K2 のみ計数 (GHOST は undefined!=='character' で除外) → n:2 true / n:3 false
    expect(evalCond(s, cond(2, 'character'), makeCtx())).toBe(true);
    expect(evalCond(s, cond(3, 'character'), makeCtx())).toBe(false);
  });
});

// ============================================================
// #4 $self.sceneColorNot.<color> dyn (B02002)
// ============================================================
describe('engine-additive-0630 #4 sceneColorNot dyn', () => {
  function setup(): GameState {
    registerCardDef(ch('BEARER', { colors: ['青'], ap: 5000 }));
    registerCardDef(ch('RED', { colors: ['赤'] }));
    registerCardDef(ch('BLURED', { colors: ['青', '赤'] })); // 2色: 赤(青以外)を持つ → 該当
    registerCardDef(ch('BLU2', { colors: ['青'] }));         // 単色青 → 非該当
    const s = createEmptyGameState();
    s.players.self.scene = [
      sceneChar('BEARER', 'b1'),
      sceneChar('RED', 'r1'),
      sceneChar('BLURED', 'br1'),
      sceneChar('BLU2', 'b2'),
    ];
    s.players.opp.scene = [sceneChar('RED', 'or1')]; // decoy: opp の青以外は self 集計に含めない
    return s;
  }
  const ctxSelf = (): EffectCtx => makeCtx({ source: { player: 'self', area: 'scene', uid: 'b1' } });

  it('青以外の色を持つキャラ = RED + BLURED の2枚 (単色青/bearer は非該当)', () => {
    expect(evalDyn(setup(), '$self.sceneColorNot.青', ctxSelf())).toBe(2);
    expect(evalDyn(setup(), '$self.sceneColorNot.青 * 1000', ctxSelf())).toBe(2000);
  });
  it('decoy: opp の 青以外キャラは self 集計に入らない (player ベース)', () => {
    // self 集計 = 2 のまま (opp の RED を足すと 3 になるはず)
    expect(evalDyn(setup(), '$self.sceneColorNot.青', ctxSelf())).toBe(2);
  });
  it('source.player=opp 視点では opp 現場を数える', () => {
    const s = setup();
    // opp.scene = [RED] → 青以外 1枚
    expect(evalDyn(s, '$self.sceneColorNot.青', makeCtx({ source: { player: 'opp', area: 'scene', uid: 'or1' } }))).toBe(1);
  });
  it('色未指定はエラー', () => {
    expect(() => evalDyn(setup(), '$self.sceneColorNot', ctxSelf())).toThrow(/sceneColorNot/);
  });

  // dyn が実機 AP read 経路から到達することの false-green ガード:
  // continuousModifier.apDelta(dyn) を charRead.ap が走査・合算 (B05030/B02002 同型)。
  it('AP path: continuous apDelta dyn = sceneColorNot×1000 が charRead.ap に反映', () => {
    const s = createEmptyGameState();
    registerCardDef(ch('AURABEARER', {
      colors: ['青'], ap: 5000,
      abilities: [{ id: 'a1', type: 'continuous', continuousModifier: { apDelta: { dyn: '$self.sceneColorNot.青 * 1000' } }, description: '青以外×AP+1000', ruleRefs: [] }],
    }));
    registerCardDef(ch('RED', { colors: ['赤'] }));
    registerCardDef(ch('BLU2', { colors: ['青'] }));
    s.players.self.scene = [sceneChar('AURABEARER', 'a1u'), sceneChar('RED', 'r1'), sceneChar('BLU2', 'b2')];
    // 青以外 = RED の1枚 → AP+1000 → 5000+1000 = 6000
    expect(charRead.ap(s, 'a1u')).toBe(6000);
  });
});
