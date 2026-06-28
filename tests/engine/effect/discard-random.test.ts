// engine.effect.atom discardRandom — 手札からランダムに n 枚リムーブする verb (B01077「相手は手札を
// 1枚ランダムにリムーブする」)。公式 QA: 「相手が選べず確率が均等」な方法。zone = hand → remove。
// 決定的 RNG (ctx.rng) で再現性を担保。pick を持たない (ランダム = プレイヤー選択不要)。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { run as runEffect } from '@/engine/effect/resolver';
import { createEmptyGameState } from '@/engine/state-factory';
import type { EffectCtx, GameState } from '@/engine/types';

beforeEach(() => {
  event._resetRegistry();
});

/** 決定的 rng: 与えた数列を順に返し、尽きたら 0。 */
function seqRng(seq: number[]): () => number {
  let i = 0;
  return () => (i < seq.length ? seq[i++] : 0);
}

function runDiscardRandom(hand: string[], n: number, rng?: () => number, player: 'self' | 'opp' = 'opp'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as never;
  s.players.opp.hand = [...hand];
  return produce(s, (d) => {
    const ctx = { source: { player: 'self', cardId: 'B01077', uid: 'ev#1', abilityId: 'a1', area: 'hand' }, bindings: {}, rng } as unknown as EffectCtx;
    runEffect(d, { kind: 'atom', verb: 'discardRandom', args: { player, n } } as never, ctx);
  });
}

describe('engine discardRandom verb', () => {
  it('removes exactly n cards from the target hand into the remove area', () => {
    const s = runDiscardRandom(['A', 'B', 'C'], 1, seqRng([0.5, 0.5]));
    expect(s.players.opp.hand.length, '1枚減る').toBe(2);
    expect(s.players.opp.remove.length, 'remove へ1枚').toBe(1);
    // 除去されたカードは元の手札に含まれていた
    expect(['A', 'B', 'C']).toContain(s.players.opp.remove[0]);
  });

  it('removes all cards when n exceeds hand size (rules/15 可能な限り)', () => {
    const s = runDiscardRandom(['A', 'B'], 5, seqRng([0.1, 0.9]));
    expect(s.players.opp.hand.length, '全部除去').toBe(0);
    expect(s.players.opp.remove.length).toBe(2);
  });

  it('is a no-op on an empty hand (no throw)', () => {
    const s = runDiscardRandom([], 1, seqRng([0.5]));
    expect(s.players.opp.hand.length).toBe(0);
    expect(s.players.opp.remove.length).toBe(0);
  });

  it('is deterministic for a given rng (same seed → same card removed)', () => {
    const rng1 = seqRng([0.73, 0.21, 0.55]);
    const rng2 = seqRng([0.73, 0.21, 0.55]);
    const a = runDiscardRandom(['A', 'B', 'C', 'D'], 2, rng1);
    const b = runDiscardRandom(['A', 'B', 'C', 'D'], 2, rng2);
    expect([...a.players.opp.remove].sort(), '同 rng → 同除去').toEqual([...b.players.opp.remove].sort());
    expect(a.players.opp.remove.length).toBe(2);
  });

  it('uniformly reachable: a duplicate cardId in hand removes exactly one instance', () => {
    const s = runDiscardRandom(['A', 'A', 'B'], 1, seqRng([0]));
    // 1枚だけ除去 (重複 cardId でも count は 1)
    expect(s.players.opp.hand.length + s.players.opp.remove.length).toBe(3);
    expect(s.players.opp.remove.length).toBe(1);
  });

  it('player:self targets the source-owner hand', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as never;
    s.players.self.hand = ['X', 'Y'];
    const out = produce(s, (d) => {
      const ctx = { source: { player: 'self', cardId: 'T', uid: 't#1', abilityId: 'a1', area: 'scene' }, bindings: {}, rng: seqRng([0.4]) } as unknown as EffectCtx;
      runEffect(d, { kind: 'atom', verb: 'discardRandom', args: { player: 'self', n: 1 } } as never, ctx);
    });
    expect(out.players.self.hand.length).toBe(1);
    expect(out.players.self.remove.length).toBe(1);
  });
});
