// engine mini-wave #5 (2026-07-10): deck-reveal 拡張 P3+P2。
//   P3: atomDeckRevealUntil に fromBottom?: boolean — 「デッキ下から公開」(B03049)。走査方向のみ切替、
//       bind/bindMatch/refresh は既存流用。未指定は byte 互換 (既存 ~60 消費者)。
//   P2: 新 atom deckPlaceSplitBound — 「見た各カードを上か下へ」(B05047)。human = side-channel
//       __pendingDeckPlaceSide await (deckReorder 同型)、AI = 全カード元順 top (恒等 = smoke 不変)。
// rules: 26 (見ている間はデッキ扱い) / 15。設計 = .claude/specs/miniwave5-deck-reveal-grounding.md
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { _drainPendingDeckPlaceSide } from '@/engine/effect/atom-handlers/_shared';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx, Candidate } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const WH: CardDef = { id: 'WH', no: 'WH', kind: 'character', names: ['白キャラ'], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const RD: CardDef = { id: 'RD', no: 'RD', kind: 'event', names: ['赤イベ'], colors: ['赤'], level: 2, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState): EffectCtx {
  const c = mutate.scene.enter(s, 'self', 'HOST', {});
  return { source: { player: 'self', uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}
beforeEach(() => {
  resetDefRegistry(); _resetUidCounter();
  registerCardDef(HOST); registerCardDef(WH); registerCardDef(RD);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
});

describe('P3: deckRevealUntil fromBottom (miniwave5)', () => {
  it('fromBottom:true + maxN:1 でデッキ最下 1 枚を公開 ($revealed に底カード)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['RD', 'RD', 'WH']; // top=RD[0], bottom=WH
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', fromBottom: true, maxN: 1, filter: { color: '白', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' }, ctx);
    const matched = (ctx.bindings as Record<string, Candidate[]>)['$matched'];
    expect(matched.length, '底の白キャラが match').toBe(1);
    expect((matched[0] as { cardId?: string }).cardId).toBe('WH');
  });
  it('fromBottom:true + maxN:2 は底から 2 枚 (底優先順) を公開', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['WH', 'RD', 'RD']; // bottom 2 = RD,RD → 白は window 外
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', fromBottom: true, maxN: 2, filter: { color: '白' }, bind: '$revealed', bindMatch: '$matched' }, ctx);
    const matched = (ctx.bindings as Record<string, Candidate[]>)['$matched'];
    const revealed = (ctx.bindings as Record<string, Candidate[]>)['$revealed'];
    expect(matched.length, 'top の WH は window 外 = 不一致').toBe(0);
    expect(revealed.map(c => (c as { cardId?: string }).cardId), '底 2 枚のみ').toEqual(['RD', 'RD']);
  });
  it('fromBottom:true + 不一致 → matched 空 / $revealed に底カード (それ以外分岐の素材)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['WH', 'RD']; // bottom=RD (白でない)
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', fromBottom: true, maxN: 1, filter: { color: '白', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' }, ctx);
    expect((ctx.bindings as Record<string, Candidate[]>)['$matched'].length).toBe(0);
    expect((ctx.bindings as Record<string, Candidate[]>)['$revealed'].map(c => (c as { cardId?: string }).cardId)).toEqual(['RD']);
  });
  it('bindMatch 省略 + filter 省略 → $revealed に window 全体 (matched 除外 gate、B05047 用)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['RD', 'WH', 'RD'];
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 2, bind: '$revealed' }, ctx);
    const revealed = (ctx.bindings as Record<string, Candidate[]>)['$revealed'];
    expect(revealed.map(c => (c as { cardId?: string }).cardId), '2 枚とも保持 (先頭欠落しない)').toEqual(['RD', 'WH']);
  });
  it('fromBottom 未指定は従来 top 走査 (byte 互換)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['RD', 'WH']; // top=RD
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 1, filter: { color: '赤' }, bind: '$revealed', bindMatch: '$matched' }, ctx);
    const matched = (ctx.bindings as Record<string, Candidate[]>)['$matched'];
    expect(matched.length).toBe(1);
    expect((matched[0] as { cardId?: string }).cardId, 'top の RD').toBe('RD');
  });
});

describe('P2: deckPlaceSplitBound (miniwave5)', () => {
  function bindWindow(ctx: EffectCtx, ids: string[]): void {
    (ctx.bindings as Record<string, Candidate[]>)['$revealed'] = ids.map(id => ({ kind: 'card', cardId: id, area: 'deck', player: 'self' } as unknown as Candidate));
  }
  it('AI (human でない) は全カード元順で top = デッキ恒等 (smoke 不変)', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['RD', 'WH', 'RD'];
    bindWindow(ctx, ['RD', 'WH']); // 上 2 枚を見た想定
    runAtom(s, 'deckPlaceSplitBound' as never, { player: 'self', bindKey: '$revealed' }, ctx);
    expect(s.players.self.deck, 'デッキ不変 (恒等)').toEqual(['RD', 'WH', 'RD']);
    expect(_drainPendingDeckPlaceSide(), 'pending 立たない').toBeNull();
  });
  it('human owner は side-channel pending を立てて await (カード未移動)', () => {
    const s = base(); const ctx = ctxFor(s);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    s.players.self.deck = ['RD', 'WH', 'RD'];
    bindWindow(ctx, ['RD', 'WH']);
    runAtom(s, 'deckPlaceSplitBound' as never, { player: 'self', bindKey: '$revealed' }, ctx);
    const pending = _drainPendingDeckPlaceSide();
    expect(pending, 'pending あり').not.toBeNull();
    expect(pending!.player).toBe('self');
    expect(pending!.cardIds).toEqual(['RD', 'WH']);
    expect(s.players.self.deck, 'await 中はデッキ不変 (見ている間はデッキ扱い rules/26)').toEqual(['RD', 'WH', 'RD']);
  });
  it('human でも相手 owner なら AI 既定 (恒等) — __humanPlayerSide 不一致', () => {
    const s = base(); const ctx = ctxFor(s);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    s.players.self.deck = ['RD', 'WH'];
    bindWindow(ctx, ['RD']);
    runAtom(s, 'deckPlaceSplitBound' as never, { player: 'self', bindKey: '$revealed' }, ctx);
    expect(_drainPendingDeckPlaceSide()).toBeNull();
    expect(s.players.self.deck).toEqual(['RD', 'WH']);
  });
  it('bound 空 → no-op', () => {
    const s = base(); const ctx = ctxFor(s);
    s.players.self.deck = ['RD'];
    (ctx.bindings as Record<string, Candidate[]>)['$revealed'] = [];
    runAtom(s, 'deckPlaceSplitBound' as never, { player: 'self', bindKey: '$revealed' }, ctx);
    expect(s.players.self.deck).toEqual(['RD']);
    expect(_drainPendingDeckPlaceSide()).toBeNull();
  });
});
