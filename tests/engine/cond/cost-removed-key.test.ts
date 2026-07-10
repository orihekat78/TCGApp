// engine.cond.eval — costRemovedMatches.key + costRevealedMatches (attribution mini-wave ②, 2026-07-10)
// spec: .claude/specs/miniwave-attribution-costpaid.md
// costRemovedMatches に key ('removeDeckTop'|'removeFromHand'|'removeSetCard'、既定 removeDeckTop =
// 後方互換) を追加。costRevealedMatches は revealFromHand 記録を読む新 kind (3点同期)。
import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { CardDef, EffectCtx } from '@/engine/types';
import { makeCtx } from '../../helpers/fixtures';

function defOf(overrides: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: overrides.id, no: overrides.no ?? 'NO', kind: 'character', names: ['default'],
    colors: [], traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...overrides,
  };
}
function ctxWithCostPaid(costPaid: Record<string, unknown>): EffectCtx {
  const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
  ctx.costPaid = costPaid;
  return ctx;
}

describe('engine.cond.eval — costRemovedMatches.key / costRevealedMatches (attribution ②)', () => {
  beforeEach(() => _resetRegistry());

  // ---- costRemovedMatches key 既定 = removeDeckTop (後方互換回帰) ----
  it("key 未指定 — removeDeckTop 記録を読む [後方互換 pin]", () => {
    registerCardDef(defOf({ id: 'AGA', names: ['阿笠博士'] }));
    const cond = { kind: 'costRemovedMatches', filter: { cardName: '阿笠博士' } } as const;
    expect(evalCond(createEmptyGameState(), cond, ctxWithCostPaid({ removeDeckTop: { ids: ['AGA'] } }))).toBe(true);
    // removeFromHand のみ記録されている場合は既定 key では読まない
    expect(evalCond(createEmptyGameState(), cond, ctxWithCostPaid({ removeFromHand: { ids: ['AGA'] } }))).toBe(false);
  });

  it("key:'removeFromHand' — removeFromHand 記録を filter 判定 (B09060 FBI/赤井家)", () => {
    registerCardDef(defOf({ id: 'AKAI', names: ['赤井秀一'], traits: ['FBI', '赤井家'] }));
    const condFbi = { kind: 'costRemovedMatches', key: 'removeFromHand', filter: { trait: 'FBI' } } as const;
    const condAkai = { kind: 'costRemovedMatches', key: 'removeFromHand', filter: { trait: '赤井家' } } as const;
    const ctx = ctxWithCostPaid({ removeFromHand: { ids: ['AKAI'], level: 7 } });
    // 両特徴持ち → 2 条件独立成立 (公式Q&A「両方の効果の条件を満たす」)
    expect(evalCond(createEmptyGameState(), condFbi, ctx)).toBe(true);
    expect(evalCond(createEmptyGameState(), condAkai, ctx)).toBe(true);
  });

  it("key:'removeSetCard' — kind filter で character/event 分岐 (B08041)", () => {
    registerCardDef(defOf({ id: 'SEVT', kind: 'event' }));
    const condChar = { kind: 'costRemovedMatches', key: 'removeSetCard', filter: { kind: 'character' } } as const;
    const condEvt = { kind: 'costRemovedMatches', key: 'removeSetCard', filter: { kind: 'event' } } as const;
    const ctx = ctxWithCostPaid({ removeSetCard: { ids: ['SEVT'], kinds: ['event'] } });
    expect(evalCond(createEmptyGameState(), condEvt, ctx)).toBe(true);
    expect(evalCond(createEmptyGameState(), condChar, ctx)).toBe(false);
  });

  // ---- costRevealedMatches (新 kind、B09005) ----
  it('costRevealedMatches — 公開カードが filter 一致なら true (B09005 コナン/新一)', () => {
    registerCardDef(defOf({ id: 'CONAN', names: ['江戸川コナン'] }));
    const cond = { kind: 'costRevealedMatches', filter: { cardName: ['江戸川コナン', '工藤新一'] } } as const;
    const ctx = ctxWithCostPaid({ revealFromHand: { ids: ['CONAN'], count: 1 } });
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(true);
  });

  it('costRevealedMatches — filter 不一致 / n 不足 は false', () => {
    registerCardDef(defOf({ id: 'MOB', names: ['モブ'] }));
    const cond = { kind: 'costRevealedMatches', filter: { cardName: '江戸川コナン' } } as const;
    expect(evalCond(createEmptyGameState(), cond, ctxWithCostPaid({ revealFromHand: { ids: ['MOB'], count: 1 } }))).toBe(false);
    const condN2 = { kind: 'costRevealedMatches', filter: {}, n: 2 } as const;
    expect(evalCond(createEmptyGameState(), condN2, ctxWithCostPaid({ revealFromHand: { ids: ['MOB'], count: 1 } }))).toBe(false);
  });

  it('costRevealedMatches — costPaid 未払い (未定義) は false [fail-closed pin]', () => {
    const cond = { kind: 'costRevealedMatches', filter: {} } as const;
    expect(evalCond(createEmptyGameState(), cond, ctxWithCostPaid({}))).toBe(false);
    const ctxNoCost = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
    expect(evalCond(createEmptyGameState(), cond, ctxNoCost)).toBe(false);
  });
});
