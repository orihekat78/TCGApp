import type { ActionContext, GameState } from '@/engine/types';
import { declaredNameCandidates } from '@/engine/effect/declared-name-domain.js';
import { cutInDeclaredNameSpec } from '@/engine/flow/contact.js';
import { def as readDef } from '@/engine/read/def.js';
import { allCardNameComponentsForDef } from '@/engine/target/card-def-registry.js';

type Player = 'self' | 'opp';

/** Deterministic, public-information name supply for constrained cut-in text. */
export function chooseAiCutInDeclaredName(
  state: GameState,
  action: ActionContext,
  player: Player,
  cardId: string,
): string | undefined {
  const spec = cutInDeclaredNameSpec(state, action, player, cardId);
  if (!spec || spec.optional || spec.domain === 'unrestricted') return undefined;
  const candidates = declaredNameCandidates(spec.domain);
  const liveNames = state.players[player].scene.flatMap((card) => {
    const definition = readDef.card(card.cardId);
    return definition ? allCardNameComponentsForDef(definition) : [];
  });
  return liveNames.find(name => candidates.includes(name)) ?? candidates[0];
}
