// engine.read.hand-cutin — 手札 zone の継続 aura で付与される【カットイン】能力。
// rules: 09-cutin-disguise.md, 17-icons.md
import type { AbilityDef, EffectCtx, GameState } from '@/engine/types';
import { evalCond } from '@/engine/cond/eval';
import { matchOneFilter } from '@/engine/target/candidates';
import { def as readDef } from './def';
import { abilityIsCutin } from './keyword';

type Player = 'self' | 'opp';

/** 印字 cutin + 手札 aura 由来 cutin の有効集合。CardDef は変更しない。 */
export function effectiveCutinAbilities(state: GameState, player: Player, cardId: string): AbilityDef[] {
  const target = readDef.card(cardId);
  if (!target) return [];
  const result = (target.abilities as AbilityDef[]).filter(abilityIsCutin);
  const seenAura = new Set<string>();

  for (const sourceCardId of new Set(state.players[player].hand)) {
    const source = readDef.card(sourceCardId);
    if (!source) continue;
    for (const ability of source.abilities as AbilityDef[]) {
      const aura = ability.continuousModifier?.handCutinAura;
      if (ability.type !== 'continuous' || ability.scope !== 'on-hand' || !aura) continue;
      const ctx: EffectCtx = {
        source: { player, cardId: sourceCardId, uid: `hand:${player}:${sourceCardId}`, abilityId: ability.id, area: 'hand' },
        bindings: {},
      };
      if (ability.condition && !evalCond(state, ability.condition, ctx)) continue;
      if (!matchOneFilter(state, cardId, aura.filter, null, { kind: 'card', cardId, area: 'hand', player })) continue;

      const auraKey = JSON.stringify({ filter: aura.filter, apDelta: aura.apDelta });
      if (seenAura.has(auraKey)) continue;
      seenAura.add(auraKey);
      result.push({
        id: `hand-cutin:${sourceCardId}:${ability.id}`,
        type: 'triggered',
        scope: 'on-hand',
        trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
        effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: aura.apDelta, scope: 'contact' } },
        description: `【カットイン】AP＋${aura.apDelta}`,
        ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md'],
      });
    }
  }
  return result;
}
