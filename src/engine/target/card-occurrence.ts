type Player = 'self' | 'opp';

/** Stable identity for one visible card occurrence in a player area. */
export function cardOccurrenceUid(
  player: Player,
  area: string,
  cardId: string,
  index: number,
): string {
  return `card:${player}:${area}:${cardId}#${index}`;
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
