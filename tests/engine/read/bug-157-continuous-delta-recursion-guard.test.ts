// BUG-157 — read.char.ap/lp/level の continuousDelta 無 guard 相互再帰 → stack overflow 修正 (2026-06-27)。
//
// read/char.ts の ap/lp/level は local `continuousDelta` を直接呼ぶ (再入 guard `_inContinuousDelta` は
// candidates.ts の continuousDeltaSafe のみが set/clear)。cond/eval.ts の apAtLeast/lpAtLeast も
// charRead.ap/lp 直呼び。→ continuous apDelta(gated lpAtLeast) ⇄ lpDelta(gated apAtLeast) や
// 自己循環 (apDelta gated apAtLeast→self) で無限相互再帰 → RangeError(stack overflow)。
//
// 修正: candidates.ts で continuousDeltaSafe を export、read/char.ts の ap/lp/level が
// continuousDeltaSafe 経由に。再入時 base 値で 0 を返し depth-2 で終端 (matchOneFilter と同 posture)。
//
// 検証:
//   §1 ★RED→GREEN 相互循環 (A.apDelta⇄B.lpDelta) — ap(A) が throw せず有限値を返す。
//   §2 ★RED→GREEN 自己循環 (apDelta gated apAtLeast→self) — ap(C) が throw せず base を返す。
//   §3 回帰: 非循環 continuous apDelta (turn gate) は従来どおり base+delta を合算 (挙動不変)。
// rules: 15, 19 (下限なし), 24 §常時有効型
// spec: .claude/specs/engine-bugfix-156-157-cost-recursion.md

import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeChar } from '../../helpers/fixtures';
import type { CardDef, GameState, TargetingRef, Condition } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 3000, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const ALL_SELF: TargetingRef = { kind: 'all', query: { area: 'scene', side: 'self' } } as TargetingRef;
const SELF_REF: TargetingRef = { kind: 'self' } as TargetingRef;

// 相互循環: threshold を base 超 (n:9999) にして .some() short-circuit を防ぎ強制再帰。
//   A: continuous apDelta:+5000 gated by 「self 現場に lp>=9999 のキャラがいる」
//   B: continuous lpDelta:+5000 gated by 「self 現場に ap>=9999 のキャラがいる」
const CYC_A: CardDef = ch('CYC_A', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'lpAtLeast', ref: ALL_SELF, n: 9999 } as Condition, continuousModifier: { apDelta: 5000 }, description: 'apDelta gated lpAtLeast', ruleRefs: [] }],
});
const CYC_B: CardDef = ch('CYC_B', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'apAtLeast', ref: ALL_SELF, n: 9999 } as Condition, continuousModifier: { lpDelta: 5000 }, description: 'lpDelta gated apAtLeast', ruleRefs: [] }],
});
// 自己循環: apDelta gated by 自分自身の apAtLeast。
const SELF_CYC: CardDef = ch('SELF_CYC', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'apAtLeast', ref: SELF_REF, n: 9999 } as Condition, continuousModifier: { apDelta: 5000 }, description: 'apDelta gated self apAtLeast', ruleRefs: [] }],
});
// satisfiable-at-base 自己循環: gate を base 値で成立 (n:1<=base 3000)。guard 終端 *かつ* delta 適用を証明。
//   ap(SAT) → continuousDeltaSafe(flag) → continuousDelta → evalCond(apAtLeast self n:1) → ap(SAT)再入で base 0 化
//   → ap=base 3000>=1 成立 → apDelta+5000 適用 → 3000+5000=8000 (再入は 0 終端だが外側 condition は通る)。
const SAT_CYC: CardDef = ch('SAT_CYC', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'apAtLeast', ref: SELF_REF, n: 1 } as Condition, continuousModifier: { apDelta: 5000 }, description: 'apDelta gated self apAtLeast n1 (satisfiable at base)', ruleRefs: [] }],
});
// 非循環回帰: 【自分ターン中】continuous apDelta:+2000 (condition が ap/lp を読まない)。
const TURN_AP: CardDef = ch('TURN_AP', {
  abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', condition: { kind: 'turn', player: 'self' } as Condition, continuousModifier: { apDelta: 2000 }, description: '【自分ターン中】apDelta +2000', ruleRefs: [] }],
});

function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  registerCardDef(CYC_A);
  registerCardDef(CYC_B);
  registerCardDef(SELF_CYC);
  registerCardDef(SAT_CYC);
  registerCardDef(TURN_AP);
  registerTriggeredListener();
});

describe('BUG-157 §1 — 相互循環 (apDelta⇄lpDelta) で stack overflow しない', () => {
  it('ap(A) は throw せず有限値を返す (再入は base 0 で終端)', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-a', cardId: 'CYC_A', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-b', cardId: 'CYC_B', state: 'active' }));
    expect(() => charRead.ap(s, 'u-a')).not.toThrow();
    // 再入時 lp/ap は base のみ (5000<9999) → 両 condition 不成立 → delta 不適用 → base ap=3000。
    expect(charRead.ap(s, 'u-a')).toBe(3000);
    expect(charRead.lp(s, 'u-b')).toBe(3000);
  });
});

describe('BUG-157 §2 — 自己循環 (apDelta gated self apAtLeast) で stack overflow しない', () => {
  it('ap(C) は throw せず base を返す', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-c', cardId: 'SELF_CYC', state: 'active' }));
    expect(() => charRead.ap(s, 'u-c')).not.toThrow();
    // 再入 ap=base 3000<9999 → condition 不成立 → apDelta 不適用 → 3000。
    expect(charRead.ap(s, 'u-c')).toBe(3000);
  });
});

describe('BUG-157 §4 — satisfiable-at-base 循環: guard 終端 かつ delta 適用 (再入 0 でも外側 condition は通る)', () => {
  it('ap(SAT) は throw せず base+delta=8000 を返す', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-sat', cardId: 'SAT_CYC', state: 'active' }));
    expect(() => charRead.ap(s, 'u-sat')).not.toThrow();
    // 再入 ap=base 3000>=1 → condition 成立 → apDelta+5000 適用 → 8000。
    expect(charRead.ap(s, 'u-sat')).toBe(8000);
  });
});

describe('BUG-157 §3 — 回帰: 非循環 continuous apDelta は従来どおり合算 (挙動不変)', () => {
  it('【自分ターン中】apDelta +2000 が base に合算される', () => {
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-t', cardId: 'TURN_AP', state: 'active' }));
    expect(charRead.ap(s, 'u-t')).toBe(5000); // base 3000 + 2000
  });
  it('相手ターン中は condition 不成立で base のみ', () => {
    const s = base();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene.push(makeChar({ uid: 'u-t', cardId: 'TURN_AP', state: 'active' }));
    expect(charRead.ap(s, 'u-t')).toBe(3000);
  });
});
