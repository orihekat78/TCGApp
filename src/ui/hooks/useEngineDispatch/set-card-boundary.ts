import type {
  PendingSetCardChoiceSide,
  PendingSetCardReplacementSide,
} from '@/engine/effect/pending-state.js';
import type {
  PendingDecisionIdentity,
  PendingSetCardChoice,
  PendingSetCardReplacement,
} from '@/ui/state/store.js';

/** Strip presentation-only fields before comparing against resolver authority. */
export function toPendingSetCardChoiceSide(
  pending: PendingSetCardChoice & PendingDecisionIdentity,
): PendingSetCardChoiceSide {
  return {
    player: pending.player,
    hostUid: pending.hostUid,
    ...(pending.face !== undefined ? { face: pending.face } : {}),
    ...(pending.destination !== undefined ? { destination: pending.destination } : {}),
    entries: pending.entries.map((entry) => ({
      instanceId: entry.instanceId,
      ordinal: entry.ordinal,
      ...(entry.hidden !== undefined ? { hidden: entry.hidden } : {}),
      ...(entry.cardId !== undefined ? { cardId: entry.cardId } : {}),
    })),
    source: pending.source,
  };
}

/** Never accept decision identity or a serialized continuation from the UI. */
export function toPendingSetCardReplacementSide(
  pending: PendingSetCardReplacement & PendingDecisionIdentity,
): PendingSetCardReplacementSide {
  return {
    player: pending.player,
    fromUid: pending.fromUid,
    setCardInstanceId: pending.setCardInstanceId,
    candidates: pending.candidates.map((candidate) => ({ ...candidate })),
    source: pending.source,
  };
}
