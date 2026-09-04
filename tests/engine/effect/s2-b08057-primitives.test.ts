// S2 deck cluster (2026-07-10, B08057 宮野エレーナ a2): 3 additive primitive。
//   P1: atomRemoveAreaToDeckTop の bindKey opt — 移動成功分を bound へ accumulate (moved-count 材料)。
//   P2: Condition boundCountCompare{bindKey,cmp,n} — 「カードを合わせて3枚移した場合」gate。
//   P3: atom deckBottomReorderBound — 直前に deck bottom へ移した bound block の並べ替えを
//       human に surface (deckToBottomBound BUG-136 tail の独立 atom 版。AI = 移動順のまま恒等)。
// rules: 15 (「〜まで」=0可) / 21 (コスト) / 26。grounding = B08057 調査 2026-07-10。
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { evalCond } from '@/engine/cond/eval';
import { deckOccurrenceAuthority } from '@/engine/effect/deck-occurrence-authority';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx, Candidate, Condition } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['赤'], level: 5, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const L5: CardDef = { id: 'L5', no: 'L5', kind: 'character', names: ['レ5'], colors: ['赤'], level: 5, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const L4: CardDef = { id: 'L4', no: 'L4', kind: 'character', names: ['レ4'], colors: ['赤'], level: 4, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const L1: CardDef = { id: 'L1', no: 'L1', kind: 'character', names: ['レ1'], colors: ['赤'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState): EffectCtx {
  const c = mutate.scene.enter(s, 'self', 'HOST', {});
  return { source: { player: 'self', uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}
function deckBindings(s: GameState, indexes: number[]): Candidate[] {
  return indexes.map(index => {
    const authority = deckOccurrenceAuthority(s, 'self', index);
    if (!authority) throw new Error(`missing deck occurrence authority at ${index}`);
    return authority;
  });
}
beforeEach(() => {
  resetDefRegistry(); _resetUidCounter();
  registerCardDef(HOST); registerCardDef(L5); registerCardDef(L4); registerCardDef(L1);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  (globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide = null;
});

describe('P1: removeAreaToDeckTop bindKey accumulate', () => {
  it('移動成功で bound に 1 entry 追加 (dest bottom / 連続呼びで accumulate)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = ['L5', 'L4'];
    s.players.self.deck = ['HOST'];
    runAtom(s, 'removeAreaToDeckTop' as never, { player: 'self', dest: 'bottom', bindKey: '$moved', target: 'L5' }, ctx);
    runAtom(s, 'removeAreaToDeckTop' as never, { player: 'self', dest: 'bottom', bindKey: '$moved', target: 'L4' }, ctx);
    const b = (ctx.bindings as Record<string, Candidate[]>)['$moved'] ?? [];
    expect(b.map(c => (c as { cardId?: string }).cardId)).toEqual(['L5', 'L4']);
    expect(s.players.self.deck).toEqual(['HOST', 'L5', 'L4']);
  });
  it('対象不在 (moved=false) は bound に積まない', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = [];
    s.players.self.deck = ['HOST'];
    runAtom(s, 'removeAreaToDeckTop' as never, { player: 'self', dest: 'bottom', bindKey: '$moved', target: 'L5' }, ctx);
    expect(((ctx.bindings as Record<string, Candidate[]>)['$moved'] ?? []).length).toBe(0);
  });
  it('bindKey 未指定は従来挙動 (bindings 無汚染)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.remove = ['L5'];
    s.players.self.deck = ['HOST'];
    runAtom(s, 'removeAreaToDeckTop' as never, { player: 'self', dest: 'bottom', target: 'L5' }, ctx);
    expect(Object.keys(ctx.bindings).length).toBe(0);
  });
});

describe('P2: boundCountCompare condition', () => {
  function cnt(ctx: EffectCtx, n: number, cmp: 'eq' | 'ge' = 'eq'): boolean {
    const s = base();
    return evalCond(s, { kind: 'boundCountCompare', bindKey: '$moved', cmp, n } as unknown as Condition, ctx);
  }
  it('要素数 3 で eq 3 = true / eq 2 = false', () => {
    const s = base(); const ctx = ctxFor(s);
    (ctx.bindings as Record<string, Candidate[]>)['$moved'] = ['L5', 'L4', 'L1'].map(id => ({ kind: 'card', cardId: id, area: 'deck', player: 'self' } as unknown as Candidate));
    expect(cnt(ctx, 3)).toBe(true);
    expect(cnt(ctx, 2)).toBe(false);
    expect(cnt(ctx, 2, 'ge')).toBe(true);
  });
  it('binding 不在 = 0 扱い (eq 0 true / eq 3 false)', () => {
    const ctx = ctxFor(base());
    expect(cnt(ctx, 0)).toBe(true);
    expect(cnt(ctx, 3)).toBe(false);
  });
});

describe('P3: deckBottomReorderBound', () => {
  it('human 所有 + 2枚以上 → __pendingDeckReorderSide が bound の cardIds で立つ', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['HOST', 'L5', 'L4']; // bottom block = [L5, L4] (移動済想定)
    (ctx.bindings as Record<string, Candidate[]>)['$moved'] = deckBindings(s, [1, 2]);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runAtom(s, 'deckBottomReorderBound' as never, { player: 'self', bindKey: '$moved' }, ctx);
    const pend = (globalThis as { __pendingDeckReorderSide?: { player: string; cardIds: string[] } | null }).__pendingDeckReorderSide;
    expect(pend).not.toBeNull();
    expect(pend!.cardIds).toEqual(['L5', 'L4']);
    expect(s.players.self.deck, 'atom 自体は deck を動かさない (block は既置)').toEqual(['HOST', 'L5', 'L4']);
  });
  it('AI (非 human) → no-op / bound 1 枚以下 → no-op (順序が無意味)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['HOST', 'L5', 'L4'];
    (ctx.bindings as Record<string, Candidate[]>)['$moved'] = deckBindings(s, [1, 2]);
    runAtom(s, 'deckBottomReorderBound' as never, { player: 'self', bindKey: '$moved' }, ctx); // human=null
    expect((globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide).toBeNull();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    (ctx.bindings as Record<string, Candidate[]>)['$moved'] = deckBindings(s, [1]);
    runAtom(s, 'deckBottomReorderBound' as never, { player: 'self', bindKey: '$moved' }, ctx);
    expect((globalThis as { __pendingDeckReorderSide?: unknown }).__pendingDeckReorderSide).toBeNull();
  });
});
