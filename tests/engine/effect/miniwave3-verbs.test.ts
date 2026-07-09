// engine mini-wave #3 (2026-07-10): handToDeckBottom verb + filePopToHand n/gate + draw n dyn。
// rules: 05 (FILE) / 14 / 15。解禁 consumer: B03110 (FILE 上2枚 all-or-nothing) / B05092 (手札N枚→デッキ下+同数draw)。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce, setAutoFreeze } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
setAutoFreeze(false);
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const CK: CardDef = { id: 'CK', no: 'CK', kind: 'character', names: ['子'], colors: ['青'], level: 2, ap: 2000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState): EffectCtx {
  const c = mutate.scene.enter(s, 'self', 'HOST', {});
  return { source: { player: 'self', uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}
beforeEach(() => { resetDefRegistry(); _resetUidCounter(); registerCardDef(HOST); registerCardDef(CK); });

describe('handToDeckBottom (miniwave3)', () => {
  it('解決済 target (cardId 配列) を手札→デッキ下へ、bind に記録', () => {
    const s = base();
    const ctx = ctxFor(s);
    s.players.self.hand = ['CK', 'CK', 'CK'];
    s.players.self.deck = ['D1', 'D2'];
    runAtom(s, 'handToDeckBottom' as never, { player: 'self', target: ['CK', 'CK'], bind: '$moved' }, ctx);
    expect(s.players.self.hand.length, '手札 -2').toBe(1);
    expect(s.players.self.deck.slice(-2), 'デッキ下に順で追加').toEqual(['CK', 'CK']);
    expect(((ctx.bindings as Record<string, unknown>)['$moved'] as unknown[]).length, 'bind 2 件').toBe(2);
  });
});

describe('filePopToHand n + gate (miniwave3)', () => {
  function fileN(s: GameState, n: number): void {
    s.players.self.file = Array.from({ length: n }, (_v, i) => ({ type: 'card-back', cardId: `F${i}` })) as never;
  }
  it('n:2 で FILE 上 2 枚を手札へ (LIFO = 最新が先)', () => {
    const s0 = base(); const ctx = ctxFor(s0);
    fileN(s0, 3);
    const s = produce(s0, (d) => { runAtom(d as GameState, 'filePopToHand' as never, { player: 'self', n: 2 }, ctx); });
    expect(s.players.self.hand).toEqual(['F2', 'F1']);
    expect(s.players.self.file.length).toBe(1);
  });
  it('gate:true + FILE 1 枚 < n:2 → all-or-nothing chain break (移動 0)', () => {
    const s0 = base(); const ctx = ctxFor(s0);
    fileN(s0, 1);
    const s = produce(s0, (d) => { runAtom(d as GameState, 'filePopToHand' as never, { player: 'self', n: 2, gate: true }, ctx); });
    expect(s.players.self.hand.length, '移動しない').toBe(0);
    expect(s.players.self.file.length).toBe(1);
    expect((ctx.dyn as Record<string, unknown>).chainStepNoApply, 'chain break 信号').toBe(true);
  });
  it('n 未指定は従来 1 枚 (byte 互換)', () => {
    const s0 = base(); const ctx = ctxFor(s0);
    fileN(s0, 2);
    const s = produce(s0, (d) => { runAtom(d as GameState, 'filePopToHand' as never, { player: 'self' }, ctx); });
    expect(s.players.self.hand).toEqual(['F1']);
  });
});

describe('draw n dyn (miniwave3)', () => {
  it('n:{dyn:$bound.$moved.count} で bound 件数分 draw', () => {
    const s = base(); const ctx = ctxFor(s);
    (ctx.bindings as Record<string, unknown>)['$moved'] = [{ cardId: 'CK' }, { cardId: 'CK' }];
    s.players.self.deck = ['D1', 'D2', 'D3'];
    runAtom(s, 'draw' as never, { player: 'self', n: { dyn: '$bound.$moved.count' } }, ctx);
    expect(s.players.self.hand.length, '2 枚 draw').toBe(2);
  });
});
