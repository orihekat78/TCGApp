// S2 deck cluster (2026-07-10, B01093): deckPlaceSplitBound の選択者座標系是正。
//   印字「（自分が上か下かを選ぶ）」= 選択者は ability owner。対象デッキ所有者 (player) とは独立。
//   旧 gate (p === humanSide) は B01093 (owner=self, deck=opp) で modal 不発 / 逆方向 (CPU owner が
//   human deck 対象) で human に誤 modal の両方向誤り — ownerPlayer gate + side-channel 同梱に是正。
//   B05047 (player===owner) は挙動不変。
// rules: 15 / 17 / 26 (見ている間はデッキ扱い)。BUG-175 player/ownerPlayer 分離パターン踏襲。
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { _drainPendingDeckPlaceSide } from '@/engine/effect/atom-handlers/_shared';
import { _resetUidCounter } from '@/engine/mutate/scene';
import type { CardDef, GameState, EffectCtx, Candidate } from '@/engine/types';

const HOST: CardDef = { id: 'HOST', no: 'HOST', kind: 'character', names: ['主'], colors: ['黄'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const RD: CardDef = { id: 'RD', no: 'RD', kind: 'event', names: ['赤イベ'], colors: ['赤'], level: 2, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}
function ctxFor(s: GameState, owner: 'self' | 'opp'): EffectCtx {
  const c = mutate.scene.enter(s, owner, 'HOST', {});
  return { source: { player: owner, uid: c.uid, cardId: 'HOST' }, bindings: {}, dyn: {} } as unknown as EffectCtx;
}
function bindOppTop(s: GameState, ctx: EffectCtx, deckOwner: 'self' | 'opp'): void {
  runAtom(s, 'deckRevealUntil' as never, { player: deckOwner === ctx.source.player ? 'self' : 'opp', maxN: 1, bind: '$revealed' }, ctx);
}
beforeEach(() => {
  resetDefRegistry(); _resetUidCounter();
  registerCardDef(HOST); registerCardDef(RD);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  (globalThis as { __pendingDeckPlaceSide?: unknown }).__pendingDeckPlaceSide = null;
});

describe('deckPlaceSplitBound 選択者座標系 (S2 B01093)', () => {
  it('owner=human(self) × 対象=相手デッキ → side-channel が立つ (player=opp / ownerPlayer=self)', () => {
    const s = base(); const ctx = ctxFor(s, 'self');
    s.players.opp.deck = ['RD', 'RD'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    bindOppTop(s, ctx, 'opp');
    runAtom(s, 'deckPlaceSplitBound' as never, { player: 'opp', bindKey: '$revealed' }, ctx);
    const pend = _drainPendingDeckPlaceSide();
    expect(pend, 'B01093: 相手デッキ対象でも owner=human なら modal await').not.toBeNull();
    expect(pend!.player, '対象デッキは opp').toBe('opp');
    expect(pend!.ownerPlayer, '選択者は self').toBe('self');
    expect(s.players.opp.deck, 'await 中は未移動 (rules/26)').toEqual(['RD', 'RD']);
  });
  it('owner=CPU(opp) × 対象=human デッキ → modal を出さず恒等 (誤 modal 防止)', () => {
    const s = base(); const ctx = ctxFor(s, 'opp');
    s.players.self.deck = ['RD', 'RD'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    // opp 視点で相手 (=self) のデッキを公開
    runAtom(s, 'deckRevealUntil' as never, { player: 'opp', maxN: 1, bind: '$revealed' }, ctx);
    runAtom(s, 'deckPlaceSplitBound' as never, { player: 'opp', bindKey: '$revealed' }, ctx);
    expect(_drainPendingDeckPlaceSide(), 'CPU が選ぶ判断を human に出さない').toBeNull();
    expect(s.players.self.deck, '恒等 (元位置のまま = 上に置く choice)').toEqual(['RD', 'RD']);
  });
  it('B05047 回帰: owner=human=対象デッキ所有者 → 従来通り side-channel (ownerPlayer=player=self)', () => {
    const s = base(); const ctx = ctxFor(s, 'self');
    s.players.self.deck = ['RD', 'RD', 'RD'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    runAtom(s, 'deckRevealUntil' as never, { player: 'self', maxN: 2, bind: '$revealed' }, ctx);
    runAtom(s, 'deckPlaceSplitBound' as never, { player: 'self', bindKey: '$revealed' }, ctx);
    const pend = _drainPendingDeckPlaceSide();
    expect(pend).not.toBeNull();
    expect(pend!.player).toBe('self');
    expect(pend!.ownerPlayer).toBe('self');
  });
});
