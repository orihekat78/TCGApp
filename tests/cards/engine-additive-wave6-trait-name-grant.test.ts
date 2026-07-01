// engine additive wave-6 (2026-07-01) — P37 継続 trait/name grant (self-scope continuous)。
//
// ContinuousModifier.grantTraits / grantNames を read.char.traits/names + candidates.matchOneFilter
// (trait/cardName/cardNameNot) + cond/eval bond の全 honor site が effective 集合 (印字 ∪ granted) で
// 評価するか。grantKeywords と完全対称。
//   B08063「現場にいるこのキャラは〚特徴[長野県警]〛を持つ」(self trait、自己計数) /
//   B05012「〚カード名[毛利小五郎]〛としても扱い、〚特徴[探偵]〛を持つ」(self trait+name) /
//   B07053「〚カード名[怪盗キッド]〛としても扱う」(self name)。
// 付与は **board char (uid 既知) のみ** — deck/remove の同 cardId には及ばない (公式 Q&A
// 「現場にいなければ有効でない」)。ability.condition 成立中のみ (rules/24 §常時有効型)。
// 既存カードは未宣言 ⇒ 印字のみ (回帰0)。rules: 13/15/17/19(分割名)/24。
//
// DEFER: B06095 全8エリア turn aura (【宣言】) / B05101 permanent applied trait 変更 (「失う」+変装引継)。

import { describe, it, expect, beforeEach } from 'vitest';
import { char as charRead } from '@/engine/read/char';
import { candidates } from '@/engine/target/candidates';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import type { CardDef, GameState, Ability, ContinuousModifier, Condition, SceneCharacter } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
function grantAbility(cm: ContinuousModifier, condition?: Condition): Ability {
  return { id: 'grant', type: 'continuous', condition, continuousModifier: cm } as unknown as Ability;
}

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
});

/** self に uid を持つ scene char を並べた state を作る。 */
function withScene(...chars: SceneCharacter[]): GameState {
  const s = createEmptyGameState();
  s.players.self.scene.push(...chars);
  return s;
}
const ctxSelf = makeCtx({ source: { player: 'self', uid: 'granter', area: 'scene' } });
/** candidates の uid 集合 (char のみ)。 */
function candUids(s: GameState, query: Record<string, unknown>): string[] {
  return candidates(s, { kind: 'all', query } as never, ctxSelf)
    .filter(c => c.kind === 'char')
    .map(c => (c as { uid: string }).uid)
    .sort();
}

// ============================================================
// #1 self trait grant — read.char.traits + matchOneFilter
// ============================================================
describe('wave6 #1 self trait grant', () => {
  beforeEach(() => {
    registerCardDef(ch('GRANTER', { traits: ['大学生'], abilities: [grantAbility({ grantTraits: ['探偵'] })] }));
    registerCardDef(ch('PLAIN', { traits: ['大学生'] }));
  });

  it('read.char.traits: granter は印字 ∪ granted', () => {
    const s = withScene(sceneChar('GRANTER', 'granter'), sceneChar('PLAIN', 'plain'));
    expect(charRead.traits(s, 'granter').sort()).toEqual(['大学生', '探偵']);
    // decoy: 付与を宣言しない PLAIN は印字のみ (回帰0)
    expect(charRead.traits(s, 'plain')).toEqual(['大学生']);
  });

  it('matchOneFilter trait[探偵]: granter のみ候補 (PLAIN は除外)', () => {
    const s = withScene(sceneChar('GRANTER', 'granter'), sceneChar('PLAIN', 'plain'));
    expect(candUids(s, { side: 'self', filter: { trait: ['探偵'] } })).toEqual(['granter']);
  });

  it('印字特徴[大学生]は grant で失われない (union、両方が候補)', () => {
    const s = withScene(sceneChar('GRANTER', 'granter'), sceneChar('PLAIN', 'plain'));
    expect(candUids(s, { side: 'self', filter: { trait: ['大学生'] } })).toEqual(['granter', 'plain']);
  });
});

// ============================================================
// #2 board-only — deck/remove の同 cardId は付与されない (c===null)
// ============================================================
describe('wave6 #2 board char only (deck copy not granted)', () => {
  beforeEach(() => {
    registerCardDef(ch('GRANTER', { traits: ['大学生'], abilities: [grantAbility({ grantTraits: ['探偵'] })] }));
  });

  it('deck の GRANTER は trait[探偵] filter に一致しない (印字のみ)', () => {
    const s = withScene(sceneChar('GRANTER', 'granter'));
    s.players.self.deck.push('GRANTER');
    const deckHits = candidates(s, { kind: 'all', query: { side: 'self', area: 'deck', filter: { trait: ['探偵'] } } } as never, ctxSelf);
    expect(deckHits).toHaveLength(0);
    // board 側は一致する (対比)
    expect(candUids(s, { side: 'self', filter: { trait: ['探偵'] } })).toEqual(['granter']);
  });
});

// ============================================================
// #3 self name grant — cardName / cardNameNot + 分割名展開
// ============================================================
describe('wave6 #3 self name grant', () => {
  beforeEach(() => {
    registerCardDef(ch('ONDA', { names: ['恩田遼平'], abilities: [grantAbility({ grantNames: ['毛利小五郎'], grantTraits: ['探偵'] })] }));
    registerCardDef(ch('SPLIT', { names: ['ロボット'], abilities: [grantAbility({ grantNames: ['工藤新一&江戸川コナン'] })] }));
    registerCardDef(ch('OTHER', { names: ['鈴木園子'] }));
  });

  it('cardName[毛利小五郎]: 付与された ONDA が一致', () => {
    const s = withScene(sceneChar('ONDA', 'onda'), sceneChar('OTHER', 'other'));
    expect(candUids(s, { side: 'self', filter: { cardName: ['毛利小五郎'] } })).toEqual(['onda']);
  });

  it('read.char.names: 印字 ∪ granted', () => {
    const s = withScene(sceneChar('ONDA', 'onda'));
    expect(charRead.names(s, 'onda').sort()).toEqual(['恩田遼平', '毛利小五郎']);
  });

  it('cardNameNot[毛利小五郎]: 付与された ONDA は除外される', () => {
    const s = withScene(sceneChar('ONDA', 'onda'), sceneChar('OTHER', 'other'));
    expect(candUids(s, { side: 'self', filter: { cardNameNot: ['毛利小五郎'] } })).toEqual(['other']);
  });

  it('granted 名の分割名展開 (rules/19): [工藤新一] component が一致', () => {
    const s = withScene(sceneChar('SPLIT', 'split'));
    expect(candUids(s, { side: 'self', filter: { cardName: ['工藤新一'] } })).toEqual(['split']);
    expect(candUids(s, { side: 'self', filter: { cardName: ['江戸川コナン'] } })).toEqual(['split']);
  });
});

// ============================================================
// #4 bond (絆) honor — granted name が絆条件を満たす
// ============================================================
describe('wave6 #4 bond honors granted name', () => {
  beforeEach(() => {
    registerCardDef(ch('ONDA', { names: ['恩田遼平'], abilities: [grantAbility({ grantNames: ['毛利小五郎'] })] }));
    registerCardDef(ch('PLAIN', { names: ['恩田遼平'] }));
  });

  it('絆[毛利小五郎]: ONDA が現場 → true', () => {
    const s = withScene(sceneChar('ONDA', 'onda'));
    expect(evalCond(s, { kind: 'bond', cardName: '毛利小五郎' } as Condition, ctxSelf)).toBe(true);
  });
  it('絆[毛利小五郎]: 付与しない PLAIN のみ → false (回帰0)', () => {
    const s = withScene(sceneChar('PLAIN', 'plain'));
    expect(evalCond(s, { kind: 'bond', cardName: '毛利小五郎' } as Condition, ctxSelf)).toBe(false);
  });
});

// ============================================================
// #5 B08063 self-count — 自己付与した特徴を sceneHas が計数
// ============================================================
describe('wave6 #5 self-count (B08063 pattern)', () => {
  beforeEach(() => {
    registerCardDef(ch('KURODA', { names: ['黒田兵衛'], traits: ['警察'], abilities: [grantAbility({ grantTraits: ['長野県警'] })] }));
    registerCardDef(ch('NAGANO_A', { names: ['諸伏高明'], traits: ['長野県警'] }));
    registerCardDef(ch('NAGANO_B', { names: ['大和敢助'], traits: ['長野県警'] }));
  });

  it('sceneHas(trait[長野県警], distinctNames, nMin=3): 自己付与 KURODA を含め 3 → true', () => {
    const s = withScene(sceneChar('KURODA', 'kuroda'), sceneChar('NAGANO_A', 'a'), sceneChar('NAGANO_B', 'b'));
    const cond = { kind: 'sceneHas', query: { side: 'self', filter: { trait: ['長野県警'] }, distinctNames: true }, nMin: 3 } as unknown as Condition;
    expect(evalCond(s, cond, ctxSelf)).toBe(true);
  });
  it('KURODA が居ないと 2 のみ → false (自己付与が計数に効いている証跡)', () => {
    const s = withScene(sceneChar('NAGANO_A', 'a'), sceneChar('NAGANO_B', 'b'));
    const cond = { kind: 'sceneHas', query: { side: 'self', filter: { trait: ['長野県警'] }, distinctNames: true }, nMin: 3 } as unknown as Condition;
    expect(evalCond(s, cond, ctxSelf)).toBe(false);
  });
});

// ============================================================
// #6 condition-gated grant — ability.condition 成立中のみ付与 (+再帰 guard sanity)
// ============================================================
describe('wave6 #6 condition-gated grant', () => {
  beforeEach(() => {
    // KEY が現場に居るときだけ 探偵 を付与 (condition=sceneHas cardName[KEY])
    const cond = { kind: 'sceneHas', query: { side: 'self', filter: { cardName: ['KEY'] } } } as unknown as Condition;
    registerCardDef(ch('CGRANT', { traits: ['大学生'], abilities: [grantAbility({ grantTraits: ['探偵'] }, cond)] }));
    registerCardDef(ch('KEY', { names: ['KEY'] }));
  });

  it('condition 不成立 (KEY 不在) → 付与されない', () => {
    const s = withScene(sceneChar('CGRANT', 'cg'));
    expect(charRead.traits(s, 'cg')).toEqual(['大学生']);
    expect(candUids(s, { side: 'self', filter: { trait: ['探偵'] } })).toEqual([]);
  });
  it('condition 成立 (KEY 在場) → 付与される (無限再帰なし)', () => {
    const s = withScene(sceneChar('CGRANT', 'cg'), sceneChar('KEY', 'key'));
    expect(charRead.traits(s, 'cg').sort()).toEqual(['大学生', '探偵']);
    expect(candUids(s, { side: 'self', filter: { trait: ['探偵'] } })).toEqual(['cg']);
  });
});

// ============================================================
// #7 opponent-side grant — grantWalk は side-agnostic (ownerSideOf が opp を解決)
// ============================================================
describe('wave6 #7 opponent-side grant (side-agnostic)', () => {
  beforeEach(() => {
    registerCardDef(ch('GRANTER', { traits: ['大学生'], abilities: [grantAbility({ grantTraits: ['探偵'] })] }));
  });

  it('opp 現場の granter が opp-side filter で trait[探偵] に一致 + read.char.traits も opp を解決', () => {
    const s = createEmptyGameState();
    s.players.opp.scene.push(sceneChar('GRANTER', 'oppg'));
    expect(charRead.traits(s, 'oppg').sort()).toEqual(['大学生', '探偵']);
    const hits = candidates(s, { kind: 'all', query: { side: 'opp', filter: { trait: ['探偵'] } } } as never, ctxSelf)
      .filter(c => c.kind === 'char').map(c => (c as { uid: string }).uid);
    expect(hits).toEqual(['oppg']);
  });
});

// ============================================================
// #8 B05012 shape — 同一 ability の grantTraits + grantNames が両方 honor
// ============================================================
describe('wave6 #8 same-ability trait+name (B05012 shape)', () => {
  beforeEach(() => {
    registerCardDef(ch('ONDA', { names: ['恩田遼平'], traits: ['大学生'], abilities: [grantAbility({ grantNames: ['毛利小五郎'], grantTraits: ['探偵'] })] }));
  });

  it('co-granted trait[探偵] と name[毛利小五郎] が同時に効く', () => {
    const s = withScene(sceneChar('ONDA', 'onda'));
    expect(charRead.traits(s, 'onda').sort()).toEqual(['大学生', '探偵']);
    expect(candUids(s, { side: 'self', filter: { trait: ['探偵'] } })).toEqual(['onda']);
    expect(candUids(s, { side: 'self', filter: { cardName: ['毛利小五郎'] } })).toEqual(['onda']);
  });
});

// ============================================================
// #9 複数 ability stacking + 印字==granted の dedup
// ============================================================
describe('wave6 #9 stacking + dedup', () => {
  beforeEach(() => {
    // 2 つの continuous ability がそれぞれ別特徴を付与 → 両方 accumulate
    registerCardDef(ch('MULTI', { traits: ['大学生'], abilities: [grantAbility({ grantTraits: ['探偵'] }), grantAbility({ grantTraits: ['警察'] })] }));
    // 印字特徴と同じ特徴を付与 → dedup で 1 つ
    registerCardDef(ch('DUP', { traits: ['探偵'], abilities: [grantAbility({ grantTraits: ['探偵'] })] }));
  });

  it('2 ability 分の特徴が accumulate', () => {
    const s = withScene(sceneChar('MULTI', 'm'));
    expect(charRead.traits(s, 'm').sort()).toEqual(['大学生', '探偵', '警察']);
    expect(candUids(s, { side: 'self', filter: { trait: ['警察'] } })).toEqual(['m']);
  });
  it('印字==granted は dedup で 1 つ (read.char.traits)', () => {
    const s = withScene(sceneChar('DUP', 'd'));
    expect(charRead.traits(s, 'd')).toEqual(['探偵']);
  });
});
