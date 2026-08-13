import { ensureIndexedZoneEpochs, indexedZoneEpoch } from '../state/indexed-zone-epoch.js';

type Player = 'self' | 'opp';

type WitnessArea = 'evidence' | 'remove';

const OCCURRENCE_WITNESS = /^occ:v1:(self|opp):(evidence|remove):(\d+)$/;

/**
 * Opaque serializable revision of an indexed physical zone at selection time.
 * The value intentionally contains no card identities or hidden-zone contents.
 */
export function cardOccurrenceWitness(
  state: { indexedZoneEpochs?: unknown },
  player: Player,
  area: WitnessArea,
): string {
  ensureIndexedZoneEpochs(state as { indexedZoneEpochs?: {
    self: { evidence: number; remove: number };
    opp: { evidence: number; remove: number };
  } });
  const epoch = indexedZoneEpoch(state as { indexedZoneEpochs?: {
    self: { evidence: number; remove: number };
    opp: { evidence: number; remove: number };
  } }, player, area)!;
  return `occ:v1:${player}:${area}:${epoch}`;
}

/** Strictly accept only a current opaque witness for this exact indexed zone. */
export function isLiveCardOccurrenceWitness(
  state: { indexedZoneEpochs?: unknown },
  player: Player,
  area: WitnessArea,
  witness: unknown,
): boolean {
  if (typeof witness !== 'string') return false;
  const match = OCCURRENCE_WITNESS.exec(witness);
  if (!match || match[1] !== player || match[2] !== area) return false;
  const epoch = Number(match[3]);
  if (!Number.isSafeInteger(epoch) || epoch < 0) return false;
  return indexedZoneEpoch(state as { indexedZoneEpochs?: never }, player, area) === epoch;
}

/** Reject legacy snapshots and malformed opaque witnesses before persistence. */
export function isCardOccurrenceWitness(witness: unknown): witness is string {
  if (typeof witness !== 'string') return false;
  const match = OCCURRENCE_WITNESS.exec(witness);
  if (!match) return false;
  const epoch = Number(match[3]);
  return Number.isSafeInteger(epoch) && epoch >= 0;
}

/** Accept a structurally valid witness only when it names this indexed zone. */
export function isCardOccurrenceWitnessFor(
  witness: unknown,
  player: Player,
  area: WitnessArea,
): witness is string {
  if (!isCardOccurrenceWitness(witness)) return false;
  const match = OCCURRENCE_WITNESS.exec(witness)!;
  return match[1] === player && match[2] === area;
}

/** Stable identity for one visible card occurrence in a player area. */
export function cardOccurrenceUid(
  player: Player,
  area: string,
  cardId: string,
  index: number,
): string {
  return `card:${player}:${area}:${cardId}#${index}`;
}

/** Opaque identity for one physical set-card occurrence without card identity. */
export function setCardOccurrenceUid(
  player: Player,
  hostUid: string,
  instanceId: string,
): string {
  return `set-card:${player}:${encodeURIComponent(hostUid)}:${encodeURIComponent(instanceId)}`;
}

/** Extract a card ID from either a stable occurrence UID or legacy `cardId#index`. */
export function cardIdFromOccurrenceUid(uid: string): string | undefined {
  const stable = /^card:(?:self|opp):[^:]+:(.+)#\d+$/.exec(uid);
  if (stable) return stable[1];
  const legacy = /^([^#]+)#\d+$/.exec(uid);
  return legacy?.[1];
}

/** Parse the old UI occurrence form without accepting a stable area-qualified UID. */
export function legacyCardOccurrence(uid: string): { cardId: string; index: number } | undefined {
  const match = /^([^#]+)#(\d+)$/.exec(uid);
  if (!match || uid.startsWith('card:')) return undefined;
  return { cardId: match[1], index: Number(match[2]) };
}
