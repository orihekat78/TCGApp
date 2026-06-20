// distinct-name-count — sceneHas が query.distinctNames を honor して「それぞれカード名の異なる
// 〚特徴X〛のキャラがN枚以上」(rules/19) を計数する micro-cluster の挙動テスト。
// engine変更: src/engine/cond/eval.ts sceneHas case に distinctNames 分岐 1 つ追加 (純 additive)。
//
// 検証 (非MVP = smoke では踏めない → 専用 engine 駆動テスト必須。実 evalCond で sceneHas を駆動):
//   §1 distinct 3名 (大和/諸伏/黒田) → distinctNames nMin3 = true。
//   §2 ★核心★ 同名2枚 (大和×2print + 諸伏) → distinct=2 で false。raw sceneHas (length=3) は true
//      = distinctNames が「同名は1計数」へ挙動を変えることの 1対1 証跡。
//   §3 非 trait キャラは数えない (大和/諸伏 + 工藤新一[trait無] → distinct=2 false)。
//   §4 side:'self' — 相手の現場のキャラは数えない (self 大和/諸伏 + opp 黒田 → 2 false)。
//   §5 nMin 境界 — 大和/諸伏 (distinct=2) で nMin3=false / nMin2=true。
//   §6 自己包含 — excludeSelf 無しなので source キャラ自身も数える (B08067 qAndA「このキャラ自身も数える」)。
//   §7 出荷カード構造 — B08067/B08067P/PR236/PR242 登録 + condition/effect 形が distinctNames を持つ。
// rules: 19-special-rules.md (カード名), 15-abilities-effects.md (「〜の場合」conditional), 17 §条件アイコン

import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { B08067 } from '@/cards/ct-p08/B08067';
import { B08067P } from '@/cards/ct-p08/B08067P';
import { PR236 } from '@/cards/pr-01/PR236';
import { PR242 } from '@/cards/pr-01/PR242';
import type { CardDef, Condition } from '@/engine/types';

// synthetic 長野県警 chars。names[0] が distinct 判定キー (印字カード名)。
function ch(id: string, name: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [name], colors: ['黄'], level: 5, ap: 4000, lp: 1, traits: ['長野県警'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const YAMATO_1 = 'SYN_YAMATO_1';   // name 大和敢助
const YAMATO_2 = 'SYN_YAMATO_2';   // name 大和敢助 (別 print = 同名)
const MOROFUSHI = 'SYN_MOROFUSHI'; // name 諸伏高明
const KURODA = 'SYN_KURODA';       // name 黒田兵衛
const KUDO = 'SYN_KUDO';           // name 工藤新一 (trait 無)

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerAll(); // B08067/B08067P/PR236/PR242 込み
  registerCardDef(ch(YAMATO_1, '大和敢助'));
  registerCardDef(ch(YAMATO_2, '大和敢助'));
  registerCardDef(ch(MOROFUSHI, '諸伏高明'));
  registerCardDef(ch(KURODA, '黒田兵衛'));
  registerCardDef(ch(KUDO, '工藤新一', { traits: [] }));
});

const distinctGate = (nMin: number): Condition => ({ kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' }, distinctNames: true }, nMin });
const rawGate = (nMin: number): Condition => ({ kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' } }, nMin });

describe('distinct-name-count §1-6 — sceneHas distinctNames 計数 (evalCond)', () => {
  it('§1 distinct 3名 → distinctNames nMin3 = true', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar(YAMATO_1, 'y#1'), sceneChar(MOROFUSHI, 'm#1'), sceneChar(KURODA, 'k#1')];
    expect(evalCond(s, distinctGate(3), makeCtx())).toBe(true);
  });

  it('§2 ★同名2枚+別1枚 → distinct=2 で false / raw(length3)=true (挙動差の証跡)', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar(YAMATO_1, 'y#1'), sceneChar(YAMATO_2, 'y#2'), sceneChar(MOROFUSHI, 'm#1')];
    expect(evalCond(s, distinctGate(3), makeCtx())).toBe(false); // 大和/大和/諸伏 = 2 distinct
    expect(evalCond(s, rawGate(3), makeCtx())).toBe(true);       // distinctNames 無し = length 3
  });

  it('§3 非 trait キャラは数えない', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar(YAMATO_1, 'y#1'), sceneChar(MOROFUSHI, 'm#1'), sceneChar(KUDO, 'kd#1')];
    expect(evalCond(s, distinctGate(3), makeCtx())).toBe(false); // 工藤は trait 無 → distinct 長野県警 = 2
  });

  it('§4 side:self — 相手の現場のキャラは数えない', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar(YAMATO_1, 'y#1'), sceneChar(MOROFUSHI, 'm#1')];
    s.players.opp.scene = [sceneChar(KURODA, 'k#1')];
    expect(evalCond(s, distinctGate(3), makeCtx())).toBe(false); // self 側のみ = 2 distinct
  });

  it('§5 nMin 境界 — distinct=2 で nMin3=false / nMin2=true', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar(YAMATO_1, 'y#1'), sceneChar(MOROFUSHI, 'm#1')];
    expect(evalCond(s, distinctGate(3), makeCtx())).toBe(false);
    expect(evalCond(s, distinctGate(2), makeCtx())).toBe(true);
  });

  it('§6 excludeSelf 無し → source キャラ自身も数える (B08067 qAndA)', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar(YAMATO_1, 'y#1'), sceneChar(MOROFUSHI, 'm#1'), sceneChar(KURODA, 'k#1')];
    // ctx.source が現場の大和自身 — distinct gate は自己包含で3名成立
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'y#1', cardId: YAMATO_1, abilityId: 'a' } as never });
    expect(evalCond(s, distinctGate(3), ctx)).toBe(true);
  });
});

describe('distinct-name-count §7 — 出荷カード構造 (B08067/B08067P/PR236/PR242)', () => {
  const distinctSceneHas = { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' }, distinctNames: true }, nMin: 3 };

  it('B08067 諸伏高明: shape + a1 enter conditional に distinctNames gate', () => {
    expect(B08067.id).toBe('B08067');
    expect(B08067.kind).toBe('character');
    expect(B08067.names).toEqual(['諸伏高明']);
    expect(B08067.traits).toEqual(['警察', '長野県警']);
    expect(B08067.level).toBe(5);
    const a1 = B08067.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    // 【パートナー黄】【解決編】= ability.condition (and)
    expect(a1.condition).toEqual({ kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'caseStatus', status: '解決編' }] });
    // 「3枚以上いる場合」= effect conditional の if に distinctNames sceneHas
    expect(a1.effect?.kind).toBe('conditional');
    expect((a1.effect as { if: unknown }).if).toEqual(distinctSceneHas);
    // then: レベル7以下を1枚までリムーブ (どちらの現場でも)
    expect((a1.effect as { then: { verb: string; args: Record<string, unknown> } }).then).toEqual(
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } },
    );
  });

  it('B08067P: base spread (abilities 共有, img/rarity 差)', () => {
    expect(B08067P.id).toBe('B08067P');
    expect(B08067P.abilities).toBe(B08067.abilities);
    expect(B08067P.imageUrl).not.toBe(B08067.imageUrl);
    expect(B08067P.rarity).toBe('RP');
  });

  it('PR236 大和敢助: a1 sleepSelf+sleep-state remove / a2 sleepSelf+distinctNames declaration gate', () => {
    expect(PR236.names).toEqual(['大和敢助']);
    expect(PR236.traits).toEqual(['警察', '長野県警']);
    expect(PR236.level).toBe(7);
    const [a1, a2] = PR236.abilities;
    // a1: declared, cost sleepSelf, AP5000以下スリープ状態を remove
    expect(a1.type).toBe('declared');
    expect(a1.cost).toEqual({ kind: 'sleepSelf' });
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a1.effect).toEqual({ kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 5000 }, state: ['sleep'] } });
    expect(a1.condition).toBeUndefined(); // a1 に宣言ゲート無し
    // a2: declared, cost sleepSelf, 宣言ゲート = distinctNames sceneHas, AP8000以下 (状態不問) remove
    expect(a2.type).toBe('declared');
    expect(a2.cost).toEqual({ kind: 'sleepSelf' });
    expect(a2.condition).toEqual(distinctSceneHas);
    expect(a2.effect).toEqual({ kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } });
  });

  it('PR242: PR236 spread (同一テキスト別 promo)', () => {
    expect(PR242.id).toBe('PR242');
    expect(PR242.abilities).toBe(PR236.abilities);
    expect(PR242.imageUrl).not.toBe(PR236.imageUrl);
  });
});
