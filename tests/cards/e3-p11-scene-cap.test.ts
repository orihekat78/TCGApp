// engine E3 P11 (2026-07-02) — sceneCapOverride: case card 継続能力で現場登場上限を override
//   「自分の現場に置けるキャラの枚数は〚最大N枚まで〛になる」(PR067 探偵の目、5→4)。
//
// 検証 (engine-only、consumer PR067 は card phase / card 凍結中):
//   §1 override 無 → sceneCap=5 (baseline)。
//   §2 case continuous sceneCapOverride:4 → sceneCap=4。
//   §3 登場ゲート: cap4 で 4 枚目登場 = 満杯 throw (mutate.scene.enter)。cap5 なら 4 枚目 OK。
//   §4 canHandUseCard/Switch が cap を honor (char は cap 未満のみ通常使用、cap 到達で switch 経路)。
//   §5 ability.condition false の override は無効 → cap5。
//   §6 ★additivity★ 絶対 invariant sceneAtMost5 は 5 のまま (cap4 でも 5 枚は throw しない)。
// rules: 03(現場5枚) / 20(スイッチ) / 17(継続能力) / 19(下限なし=非強制) / 24(常時有効型)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { sceneCap } from '@/engine/read/scene-cap';
import { evalCond } from '@/engine/cond/eval';
import { mutate } from '@/engine/mutate/index';
import { canHandUseCard, canHandUseCardSwitch } from '@/engine/flow/main/hand-use-card';
import { sceneAtMost5 } from '@/engine/invariant/sceneAtMost5';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, Condition, GameState, SceneCharacter } from '@/engine/types';

function caseDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'case', names: [id], colors: ['黒'], level: 6, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const capAbility = (n: number, condition?: Condition) => ({
  id: 'a1', type: 'continuous' as const, condition,
  continuousModifier: { sceneCapOverride: n }, description: `現場上限 ${n}`,
});
// case.cardId をセットし scene に k 体並べた state
function stateWith(caseId: string, k: number): GameState {
  return produce(createEmptyGameState(), (d) => {
    d.players.self.case.cardId = caseId;
    d.players.self.scene = Array.from({ length: k }, (_, i) => ({ cardId: 'FILLER', uid: `u${i}`, state: 'active' } as unknown as SceneCharacter));
  });
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  registerCardDef(ch('FILLER'));
  registerCardDef(ch('NEWCHAR'));
});

describe('E3 P11 sceneCapOverride', () => {
  it('§1 override 無 (空 case) → sceneCap=5', () => {
    expect(sceneCap(createEmptyGameState(), 'self')).toBe(5);
  });

  it('§2 case continuous sceneCapOverride:4 → sceneCap=4', () => {
    registerCardDef(caseDef('CASE4', { abilities: [capAbility(4)] }));
    expect(sceneCap(stateWith('CASE4', 0), 'self')).toBe(4);
    expect(sceneCap(stateWith('CASE4', 0), 'opp')).toBe(5); // opp の case は空 → 5 (per-player)
  });

  it('§3 登場ゲート: cap4 で 4 枚目登場は満杯 throw / cap5(override無) は 4 枚目 OK', () => {
    registerCardDef(caseDef('CASE4', { abilities: [capAbility(4)] }));
    // cap4: scene 4 枚 → enter で throw
    expect(() => produce(stateWith('CASE4', 4), (d) => { mutate.scene.enter(d, 'self', 'NEWCHAR', {} as never); })).toThrow(/scene full/);
    // cap4: scene 3 枚 → 4 枚目 OK (満杯ちょうど手前)
    expect(() => produce(stateWith('CASE4', 3), (d) => { mutate.scene.enter(d, 'self', 'NEWCHAR', {} as never); })).not.toThrow();
    // override 無 (空 case): scene 4 枚 → 5 枚目 OK
    const s5 = produce(createEmptyGameState(), (d) => {
      d.players.self.scene = Array.from({ length: 4 }, (_, i) => ({ cardId: 'FILLER', uid: `u${i}`, state: 'active' } as unknown as SceneCharacter));
    });
    expect(() => produce(s5, (d) => { mutate.scene.enter(d, 'self', 'NEWCHAR', {} as never); })).not.toThrow();
  });

  it('§4 canHandUseCard/Switch が cap を honor', () => {
    registerCardDef(caseDef('CASE4', { abilities: [capAbility(4)] }));
    // NEWCHAR を手札に + FILE 2 枚 (level1 char 使用のレベル許可) で cap 以外のゲートを通す。
    const withHand = (k: number): GameState => produce(stateWith('CASE4', k), (d) => {
      d.players.self.hand = ['NEWCHAR'];
      d.players.self.file = [{ type: 'card-back', cardId: 'X1' }, { type: 'card-back', cardId: 'X2' }];
    });
    // scene 4 枚 + cap4 → 通常使用不可 (満杯)、switch 経路可
    const full = withHand(4);
    expect(canHandUseCard(full, 'self', 'NEWCHAR')).toBe(false);
    expect(canHandUseCardSwitch(full, 'self', 'NEWCHAR')).toBe(true);
    // scene 3 枚 + cap4 → 通常使用可、switch 不可 (未満杯)
    const room = withHand(3);
    expect(canHandUseCard(room, 'self', 'NEWCHAR')).toBe(true);
    expect(canHandUseCardSwitch(room, 'self', 'NEWCHAR')).toBe(false);
  });

  it('§5 ability.condition false の override は無効 → cap5', () => {
    // caseStatus '解決編' condition だが空 state は '事件編' → false → override 不適用
    const cond = { kind: 'caseStatus', status: '解決編' } as unknown as Condition;
    registerCardDef(caseDef('CASECOND', { abilities: [capAbility(4, cond)] }));
    expect(sceneCap(stateWith('CASECOND', 0), 'self')).toBe(5);
  });

  it('§6 additivity: 絶対 invariant sceneAtMost5 は 5 のまま (cap4 でも 5 枚は throw しない)', () => {
    registerCardDef(caseDef('CASE4', { abilities: [capAbility(4)] }));
    expect(() => sceneAtMost5(stateWith('CASE4', 5), 'self')).not.toThrow(); // 5 は OK (絶対天井 5)
    expect(() => sceneAtMost5(stateWith('CASE4', 6), 'self')).toThrow(/scene at most 5/); // 6 = エンジンバグ
  });
});

// ============================================================
// partnerColorsOverride: case 継続で【パートナー(色)】評価を全6色化 (PR067 探偵の目)
// ============================================================
describe('E3 P11 partnerColorsOverride', () => {
  const ALL6 = ['青', '緑', '白', '赤', '黄', '黒'];
  const colAbility = (colors: string[], condition?: Condition) => ({
    id: 'a1', type: 'continuous' as const, condition,
    continuousModifier: { partnerColorsOverride: colors }, description: 'partner 全色化',
  });
  const partnerColorCond = (color: string): Condition => ({ kind: 'partnerColor', color } as unknown as Condition);
  // partner=青 単色 / case=override
  function pcState(caseId: string): GameState {
    return produce(createEmptyGameState(), (d) => {
      d.players.self.partner.cardId = 'PARTNER_BLUE';
      d.players.self.case.cardId = caseId;
    });
  }
  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(ch('PARTNER_BLUE', { kind: 'partner', colors: ['青'] } as Partial<CardDef>));
  });

  it('override 無 → 印字色のみ (partner=青 に 緑 は false)', () => {
    registerCardDef(caseDef('CASE_PLAIN'));
    const s = pcState('CASE_PLAIN');
    const ctx = { source: { player: 'self', area: 'case', cardId: 'CASE_PLAIN' }, bindings: {} } as never;
    expect(evalCond(s, partnerColorCond('青'), ctx)).toBe(true);
    expect(evalCond(s, partnerColorCond('緑'), ctx)).toBe(false);
  });

  it('全6色 override → 任意色の【パートナー(色)】が成立 (緑 も true)', () => {
    registerCardDef(caseDef('CASE_ALL6', { abilities: [colAbility(ALL6)] }));
    const s = pcState('CASE_ALL6');
    const ctx = { source: { player: 'self', area: 'case', cardId: 'CASE_ALL6' }, bindings: {} } as never;
    for (const c of ALL6) expect(evalCond(s, partnerColorCond(c), ctx)).toBe(true);
  });

  it('ability.condition false の override は無効 → 印字色', () => {
    const cond = { kind: 'caseStatus', status: '解決編' } as unknown as Condition;
    registerCardDef(caseDef('CASE_COND', { abilities: [colAbility(ALL6, cond)] }));
    const s = pcState('CASE_COND'); // 事件編 → condition false
    const ctx = { source: { player: 'self', area: 'case', cardId: 'CASE_COND' }, bindings: {} } as never;
    expect(evalCond(s, partnerColorCond('緑'), ctx)).toBe(false); // override 無効 → 青のみ
  });
});
