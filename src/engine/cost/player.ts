import type { EffectCtx } from '@/engine/types';

type Player = EffectCtx['source']['player'];

/** Resolve cost DSL sides relative to the source card's controller. */
export function resolveCostPlayer(player: Player, ctx: EffectCtx): Player {
  if (player === 'self') return ctx.source.player;
  return ctx.source.player === 'self' ? 'opp' : 'self';
}
