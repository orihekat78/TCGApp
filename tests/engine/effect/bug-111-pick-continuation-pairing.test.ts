// BUG-111: pick↔continuation の FIFO 対応が multi-step で desync しうる。
//
// pick は __pendingEffectPickQueue、continuation (中断 sequence/chain の残り step) は
// __pendingChainContinuation の **別 side-channel** FIFO に積まれ、applyPickAndContinuation は
// continuation を「FIFO 先頭 [0]」で peek して現 pick の対と仮定する。しかし resolver は
// remainder.length>0 のときだけ continuation を push するため、continuation を持たない pick
// (sequence 最終 step や standalone triggered pick) が continuation 付き pick と interleave すると
// 先頭の continuation を誤って消費する (off-by-one desync)。
//
// 不変条件: 「自身の continuation を持たない pick の解決は、他 pick の continuation を実行してはならない」。
// 修正は continuation を pick オブジェクト (PendingEffectPickSide.continuation) に同梱して 1:1 を保証する。
//
// rules: 15-abilities-effects.md (未解決効果の解決順)
import { describe, it, expect, beforeAll } from 'vitest';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { Effect, EffectCtx, GameState } from '@/engine/types';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { sceneChar } from '../../helpers/fixtures';


describe('BUG-111 — continuation を持たない pick は他 pick の continuation を実行しない', () => {
  beforeAll(() => registerAll());

  it('foreign continuation が FIFO に在っても、自身の continuation を持たない pick はそれを実行しない', () => {
    const s: GameState = createEmptyGameState();
    s.players.self.scene = [sceneChar('D08015', 'tgt')]; // pickB の対象 (sleep させるだけ)

    // 別 pick に属する継続 (remainder) が実行されたら検知するフラグ
    let foreignRemainderRan = false;
    const foreignRemainder: Effect[] = [
      { kind: 'custom', fn: () => { foreignRemainderRan = true; } } as Effect,
    ];
    const foreignCtx: EffectCtx = { source: { player: 'self' }, bindings: {} } as EffectCtx;
    // 旧実装が peek する別 pick 由来の continuation を FIFO に仕込む
    (globalThis as { __pendingChainContinuation?: { remainder: Effect[]; ctx: EffectCtx }[] })
      .__pendingChainContinuation = [{ remainder: foreignRemainder, ctx: foreignCtx }];

    // pickB: 自身は continuation を持たない (sequence 最終 step / standalone を模す)
    const pickB: PendingEffectPickSide = {
      player: 'self',
      candidates: [{ uid: 'tgt', cardId: 'D08015', player: 'self' }],
      atomVerb: 'sceneSetState',
      atomArgs: { uid: '$pick', state: 'sleep', player: 'self' },
      nMin: 1, nMax: 1,
      source: { cardId: 'D08015', abilityId: 'x' },
    };

    applyPickAndContinuation(s, pickB, 'tgt');

    // pickB は自身の continuation を持たない → foreign continuation を実行してはならない
    expect(foreignRemainderRan).toBe(false);
    // pickB 本体の効果 (tgt を sleep) は適用される
    expect(s.players.self.scene[0]!.state).toBe('sleep');

    // cleanup
    delete (globalThis as { __pendingChainContinuation?: unknown }).__pendingChainContinuation;
  });
});
