import { def as readDef } from '../read/def.js';
import { evalCond } from '../cond/eval.js';
import type { AbilityDef, EffectCtx, GameState } from '../types/index.js';

type Player = 'self' | 'opp';
type InterceptTarget = { cardName?: string; excludeSelf?: boolean; requiresNonBlackSceneChar?: boolean };

export type ChooseInterceptResult =
  | { kind: 'none' }
  | { kind: 'cancel' }
  | { kind: 'discard-or-cancel'; responder: Player; protectorUid: string; protectorCardId: string; abilityId: string };

function findSceneChar(state: GameState, uid: string): { player: Player; char: GameState['players']['self']['scene'][number] } | undefined {
  return (['self', 'opp'] as const)
    .flatMap((player) => state.players[player].scene.map((char) => ({ player, char })))
    .find(({ char }) => char.uid === uid);
}

function consumeLimit(char: GameState['players']['self']['scene'][number], ability: AbilityDef): boolean {
  if (ability.limit?.kind !== 'turn') return false;
  if ((char.declaredUseCount[ability.id] ?? 0) >= ability.limit.n) return false;
  char.declaredUseCount[ability.id] = (char.declaredUseCount[ability.id] ?? 0) + 1;
  return true;
}

/** Finds and consumes one immediate selection reaction. Caller owns cancel/resume mechanics. */
export function findChooseIntercept(state: GameState, targetUid: string, ctx: EffectCtx): ChooseInterceptResult {
  if (readDef.card(ctx.source.cardId ?? '')?.kind !== 'character') return { kind: 'none' };
  const target = findSceneChar(state, targetUid);
  if (!target || target.player === ctx.source.player) return { kind: 'none' };

  for (const entry of target.char.setCards) {
    if (!entry.faceUp) continue;
    const card = readDef.card(entry.cardId);
    for (const ability of (card?.abilities ?? []) as AbilityDef[]) {
      if (
        ability.type === 'triggered'
        && ability.scope === 'on-set-host'
        && ability.trigger?.hook === ('effect:choose-intercept' as never)
        && consumeLimit(target.char, ability)
      ) {
        return { kind: 'cancel' };
      }
    }
  }

  for (const protector of state.players[target.player].scene) {
    const card = readDef.card(protector.cardId);
    for (const ability of (card?.abilities ?? []) as AbilityDef[]) {
      const trigger = ability.trigger as (AbilityDef['trigger'] & { interceptTarget?: InterceptTarget }) | undefined;
      const spec = trigger?.interceptTarget;
      if (
        ability.type !== 'triggered'
        || ability.scope !== 'on-scene'
        || trigger?.hook !== ('effect:choose-intercept-discard' as never)
        || !spec
      ) continue;
      const targetDef = readDef.card(target.char.cardId);
      if (spec.excludeSelf === true && protector.uid === targetUid) continue;
      if (spec.cardName !== undefined && !targetDef?.names.includes(spec.cardName)) continue;
      if (spec.requiresNonBlackSceneChar === true && !state.players[target.player].scene.some((char) => readDef.card(char.cardId)?.colors.some(color => color !== '黒'))) continue;
      const protectorCtx: EffectCtx = {
        source: { cardId: protector.cardId, uid: protector.uid, abilityId: ability.id, player: target.player, area: 'scene' },
        bindings: ctx.bindings,
      };
      if (ability.condition && !evalCond(state, ability.condition, protectorCtx)) continue;
      if (consumeLimit(protector, ability)) {
        return { kind: 'discard-or-cancel', responder: ctx.source.player, protectorUid: protector.uid, protectorCardId: protector.cardId, abilityId: ability.id };
      }
    }
  }
  return { kind: 'none' };
}

/** Immediate B02067-compatible boolean facade. */
export function consultChooseIntercept(state: GameState, targetUid: string, ctx: EffectCtx): boolean {
  return findChooseIntercept(state, targetUid, ctx).kind === 'cancel';
}
