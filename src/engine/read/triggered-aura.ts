import type { AbilityDef, EffectCtx, GameState, SceneCharacter } from '@/engine/types';
import { evalCond } from '@/engine/cond/eval';
import { matchOneFilter } from '@/engine/target/candidates';
import { def as readDef } from './def';
import { char as readChar } from './char';

type Player = 'self' | 'opp';

export type TriggeredAuraRecipient = {
  player: Player;
  uid: string;
  cardId: string;
  char: SceneCharacter;
};

/** Effective triggered abilities granted by friendly on-scene continuous auras. */
export function effectiveTriggeredAuraAbilities(state: GameState, target: TriggeredAuraRecipient): AbilityDef[] {
  const out: AbilityDef[] = [];
  for (const bearer of state.players[target.player].scene) {
    if (readChar.originalAbilitiesDisabled(state, bearer.uid)) continue;
    const bearerDef = readDef.card(bearer.cardId);
    if (!bearerDef) continue;
    for (const sourceAbility of bearerDef.abilities as AbilityDef[]) {
      const aura = sourceAbility.continuousModifier?.triggeredAbilityAura;
      if (sourceAbility.type !== 'continuous' || sourceAbility.scope !== 'on-scene' || !aura) continue;
      if (aura.excludeSelf === true && bearer.uid === target.uid) continue;
      const bearerCtx: EffectCtx = {
        source: { player: target.player, cardId: bearer.cardId, uid: bearer.uid, abilityId: sourceAbility.id, area: 'scene' },
        bindings: {},
      };
      if (sourceAbility.condition && !evalCond(state, sourceAbility.condition, bearerCtx)) continue;
      if (!matchOneFilter(state, target.cardId, aura.filter, target.char, { kind: 'char', uid: target.uid, cardId: target.cardId, player: target.player })) continue;
      out.push({ ...aura.ability, id: `triggered-aura:${bearer.uid}:${sourceAbility.id}:${aura.ability.id}` });
    }
  }
  return out;
}
