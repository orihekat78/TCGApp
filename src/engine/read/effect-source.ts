import type { CardId, EffectCtx } from '../types/index.js';

type Player = 'self' | 'opp';

/**
 * Return the source occurrence that is only represented in remove by the
 * engine's eager-move compatibility model, but is not there by official rule.
 */
export function removeExcludedSourceCardId(ctx: EffectCtx, player: Player): CardId | undefined {
  if (ctx.source.player !== player) return undefined;
  if (ctx.source.resolutionKind !== 'normal-event' && ctx.source.resolutionKind !== 'hirameki') {
    return undefined;
  }
  return ctx.source.cardId;
}
