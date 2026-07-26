import type { AbilityDef, EffectCtx, GameState } from '../types/index.js';
import { def as readDef } from '../read/def.js';
import { matchOneFilter } from '../target/candidates.js';
import { char as readChar } from '../read/char.js';

type Player = 'self' | 'opp';

/** Eligible continuous providers for replacing a declared ability's entire cost. */
export function alternativeCostProviders(state: GameState, ctx: EffectCtx, ability: AbilityDef): string[] {
  if (!ability.cost) return [];
  const player = ctx.source.player as Player;
  return state.players[player].scene.filter((char) => {
    if (readChar.originalAbilitiesDisabled(state, char.uid)) return false;
    const def = readDef.card(char.cardId);
    return (def?.abilities ?? []).some((provider) => {
      const spec = provider.continuousModifier?.alternativeCostProvider;
      return provider.type === 'continuous' && spec !== undefined
        && matchOneFilter(state, ctx.source.cardId ?? '', spec.targetFilter, state.players[player].scene.find((c) => c.uid === ctx.source.uid) ?? null, { kind: 'char', uid: ctx.source.uid ?? '', cardId: ctx.source.cardId ?? '', player });
    });
  }).map((char) => char.uid);
}

export function canPayDeclaredCostOrAlternative(state: GameState, ability: AbilityDef, ctx: EffectCtx, canPay: (state: GameState, cost: NonNullable<AbilityDef['cost']>, ctx: EffectCtx) => boolean): boolean {
  return !ability.cost || canPay(state, ability.cost, ctx) || alternativeCostProviders(state, ctx, ability).length > 0;
}
