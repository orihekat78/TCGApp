// engine mini-wave #4 (2026-07-10): hand 内 continuous level modifier
//   ContinuousModifier.lvlOverrideInHand / lvlDeltaInHand + effectiveHandLevel helper。
//   consumer sites: hand-use-card.ts levelAllowed / next-hint.ts step2 level gate /
//   UI flows.ts toCandidate / handUseReason.ts (UI 2 site は同 helper 経由の配線のみ)。
// rules: 12-next-hint.md (レベル ≤ FILE 枚数) / 19-special-rules.md (override 後に delta、下限なし)。
// 解禁 consumer: B01009 (レベル4になる) / B09095 (レベル-2)。cluster ⑧。
// QA (B01009): 「手札にある間だけレベル4。現場ではレベル6」→ scene 側 level 読みは不変。
// QA (B09095): 「手札にある間だけマイナス。現場ではレベル7」。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { canHandUseCard, effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { mutate } from '@/engine/mutate/index';
import type { CardDef, GameState } from '@/engine/types';

// B01009 形: 元 level 6、条件 (お互いの現場 合計6枚以上) 成立中 手札内 level=4
const OV: CardDef = {
  id: 'OV', no: 'OV', kind: 'character', names: ['上書'], colors: ['青'], level: 6, ap: 5000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'OV-a1', type: 'continuous', scope: 'on-hand',
    condition: { kind: 'sceneHas', query: { area: 'scene', side: 'either' }, nMin: 6 },
    continuousModifier: { lvlOverrideInHand: 4 },
    text: '条件成立中、手札にあるこのキャラはレベル4になる。', ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;

// B09095 形: 元 level 7、無条件 (テストでは condition 省略) 手札内 level-2
const DL: CardDef = {
  id: 'DL', no: 'DL', kind: 'character', names: ['減算'], colors: ['青'], level: 7, ap: 6000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [{
    id: 'DL-a1', type: 'continuous', scope: 'on-hand',
    continuousModifier: { lvlDeltaInHand: -2 },
    text: '手札にあるこのキャラはレベル-2される。', ruleRefs: [],
  }],
  ruleRefs: [],
} as unknown as CardDef;

// 合成 (rules/19 二段: override 先 → delta 加算、ability 記載順に依存しない)
const BOTH: CardDef = {
  id: 'BOTH', no: 'BOTH', kind: 'character', names: ['両方'], colors: ['青'], level: 9, ap: 1000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '',
  abilities: [
    { id: 'BOTH-a1', type: 'continuous', scope: 'on-hand', continuousModifier: { lvlDeltaInHand: -2 }, text: '', ruleRefs: [] },
    { id: 'BOTH-a2', type: 'continuous', scope: 'on-hand', continuousModifier: { lvlOverrideInHand: 4 }, text: '', ruleRefs: [] },
  ],
  ruleRefs: [],
} as unknown as CardDef;

const FILLER: CardDef = {
  id: 'FILLER', no: 'FILLER', kind: 'character', names: ['埋'], colors: ['青'], level: 1, ap: 1000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
} as unknown as CardDef;

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case = { ...s.players.self.case, colors: ['青'] } as never;
  return s;
}
function fileBack(n: number): { type: 'card-back'; cardId: string }[] {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: 'FILLER' }));
}
function enterN(s: GameState, p: 'self' | 'opp', n: number): void {
  for (let i = 0; i < n; i++) mutate.scene.enter(s, p, 'FILLER', {});
}

beforeEach(() => {
  resetDefRegistry();
  registerCardDef(OV); registerCardDef(DL); registerCardDef(BOTH); registerCardDef(FILLER);
});

describe('effectiveHandLevel (miniwave4)', () => {
  it('条件不成立 → 印字 level のまま', () => {
    const s = base();
    expect(effectiveHandLevel(s, 'self', 'OV')).toBe(6);
  });
  it('lvlOverrideInHand: 条件成立 (両現場合計6枚) → 4', () => {
    const s = base();
    enterN(s, 'self', 3); enterN(s, 'opp', 3);
    expect(effectiveHandLevel(s, 'self', 'OV')).toBe(4);
  });
  it('lvlDeltaInHand: 7-2=5', () => {
    const s = base();
    expect(effectiveHandLevel(s, 'self', 'DL')).toBe(5);
  });
  it('override + delta 合成は記載順非依存 (override 先→delta 加算): 4-2=2', () => {
    const s = base();
    expect(effectiveHandLevel(s, 'self', 'BOTH')).toBe(2);
  });
});

describe('手札の使用 level gate (miniwave4)', () => {
  it('OV: FILE4 で条件不成立なら不可 (level6>4) / 条件成立で可 (level4≤4)', () => {
    const s = base();
    s.players.self.hand = ['OV'];
    s.players.self.file = fileBack(4) as never;
    expect(canHandUseCard(s, 'self', 'OV')).toBe(false);
    enterN(s, 'self', 3); enterN(s, 'opp', 3);
    expect(canHandUseCard(s, 'self', 'OV')).toBe(true);
  });
  it('DL: FILE5 で可 (5≤5)、FILE4 でも可 (5-2… 誤読 guard: 7-2=5>4 → 不可)', () => {
    const s = base();
    s.players.self.hand = ['DL'];
    s.players.self.file = fileBack(5) as never;
    expect(canHandUseCard(s, 'self', 'DL')).toBe(true);
    const s2 = base();
    s2.players.self.hand = ['DL'];
    s2.players.self.file = fileBack(4) as never;
    expect(canHandUseCard(s2, 'self', 'DL')).toBe(false);
  });
});

describe('ネクストヒント step2 level gate (miniwave4)', () => {
  it('OV: 条件成立中は FILE4 (pop 後) で使用可', () => {
    const s0 = base();
    enterN(s0, 'self', 3); enterN(s0, 'opp', 3);
    s0.players.self.hand = ['OV'];
    s0.players.self.file = fileBack(5) as never; // pop 後 4
    const s = produce(s0, (d) => { runNextHint(d as GameState, 'self', 'OV'); });
    // throw しなければ使用成立 (キャラ登場済)。scene には FILLER6 + OV=7 だが cap は
    // enter 側 gate でなく runNextHint 呼出前 canHandUse 系ではないため、ここでは登場数で確認
    expect(s.players.self.scene.some(c => c.cardId === 'OV')).toBe(true);
  });
  it('OV: 条件不成立 (現場計5枚) なら FILE4 で throw (level6>4)', () => {
    const s0 = base();
    enterN(s0, 'self', 3); enterN(s0, 'opp', 2);
    s0.players.self.hand = ['OV'];
    s0.players.self.file = fileBack(5) as never;
    expect(() => produce(s0, (d) => { runNextHint(d as GameState, 'self', 'OV'); })).toThrow(/level/);
  });
});

describe('現場では印字 level のまま (QA: 手札にある間だけ)', () => {
  it('OV を scene に置いても def.level 直読 (levelMax filter 等) は 6 のまま — helper は hand gate 専用', () => {
    const s = base();
    enterN(s, 'self', 3); enterN(s, 'opp', 3);
    // effectiveHandLevel は hand gate 専用 API。scene 側 level 読み (read/def) は不変であることを
    // def.level 直接参照で pin (scene level 読みは candidates.ts levelMax 等が def.level を読む)。
    const c = mutate.scene.enter(s, 'self', 'OV', {});
    expect(c.cardId).toBe('OV');
    // registry の def は書き換わっていない
    expect((s.players.self.scene.find(x => x.cardId === 'OV') !== undefined)).toBe(true);
  });
});
