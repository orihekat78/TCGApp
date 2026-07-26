import type { Cost, EffectCtx, GameState, SceneCharacter } from '@/engine/types';
import { candidates, matchOneFilter } from '@/engine/target/candidates.js';

type RemoveSetCost = Extract<Cost, { kind: 'removeSetCard' }>;

export type EligibleSetCard = { host: SceneCharacter; entry: SceneCharacter['setCards'][number] };

function faceMatches(cost: RemoveSetCost, entry: EligibleSetCard['entry']): boolean {
  const face = cost.face ?? (cost.anyFace ? 'any' : 'down');
  return face === 'any' || (face === 'up' ? entry.faceUp : !entry.faceUp);
}

/** One authoritative eligible-set-card enumeration for evaluate, pay, UI, and AI.
 * Face is checked before filter evaluation so face-down card identity never leaks.
 */
export function eligibleRemoveSetCards(state: GameState, cost: RemoveSetCost, ctx: EffectCtx): EligibleSetCard[] {
  const player = ctx.source.player;
  const hostUids = cost.hostQuery
    ? new Set(candidates(state, { kind: 'pick', query: { ...cost.hostQuery, area: 'scene', side: 'self' }, n: { min: 0, max: 99 }, chooser: 'self' }, ctx)
      .filter((candidate): candidate is Extract<typeof candidate, { kind: 'char' }> => candidate.kind === 'char')
      .map(candidate => candidate.uid))
    : null;
  const out: EligibleSetCard[] = [];
  for (const host of state.players[player].scene) {
    if (cost.hostSelf && host.uid !== ctx.source.uid) continue;
    if (hostUids && !hostUids.has(host.uid)) continue;
    for (const entry of host.setCards) {
      if (!faceMatches(cost, entry)) continue;
      // An identity-dependent filter is intentionally never evaluated for hidden entries.
      if (cost.filter && !entry.faceUp) continue;
      if (cost.filter && !matchOneFilter(state, entry.cardId, cost.filter, null, {
        kind: 'card', cardId: entry.cardId, player, area: 'set-card', index: 0, hostUid: host.uid,
      })) continue;
      out.push({ host, entry });
    }
  }
  return out;
}
