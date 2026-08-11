import type { DeckRecord, MatchRecord } from '../data/types';
import type { CloudDeckPutPayload, CloudMatchDraft } from './types';

const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CARD_NUM = /^[A-Za-z0-9-]{1,24}$/;
const VERSION = /^[A-Za-z0-9._+-]{1,120}$/;
const MATCH_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const FUTURE_SKEW_MS = 5 * 60 * 1_000;
export const FIXED_CPU_POLICY_VERSION = 'normal-fixed-v1';

export type ProjectionFailureReason =
  | 'deck-not-playable'
  | 'not-human-vs-cpu'
  | 'deck-snapshot-missing'
  | 'match-expired'
  | 'match-invalid';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function stableCloudResourceId(
  namespace: 'deck' | 'match',
  localId: string,
): Promise<string> {
  if (RESOURCE_ID.test(localId)) return localId;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(localId));
  return `${namespace}_${bytesToHex(new Uint8Array(digest))}`;
}

function validDeck(deck: DeckRecord): boolean {
  if (
    !deck.name.trim()
    || deck.name.length > 80
    || !CARD_NUM.test(deck.partner)
    || !CARD_NUM.test(deck.case)
    || !Number.isSafeInteger(deck.modified)
    || deck.modified < 0
    || deck.cards.length < 1
    || deck.cards.length > 40
  ) return false;
  const seen = new Set<string>();
  let count = 0;
  for (const card of deck.cards) {
    if (
      !CARD_NUM.test(card.num)
      || seen.has(card.num)
      || !Number.isSafeInteger(card.count)
      || card.count < 1
    ) return false;
    seen.add(card.num);
    count += card.count;
  }
  return count === 40;
}

export async function projectDeckForCloud(
  deck: DeckRecord,
  expectedRevision: number | null,
): Promise<{ ok: true; payload: CloudDeckPutPayload } | { ok: false; reason: ProjectionFailureReason }> {
  if (!validDeck(deck)) return { ok: false, reason: 'deck-not-playable' };
  if (
    expectedRevision !== null
    && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
  ) return { ok: false, reason: 'deck-not-playable' };
  return {
    ok: true,
    payload: {
      deckId: await stableCloudResourceId('deck', deck.id),
      name: deck.name,
      partnerCardNum: deck.partner,
      caseCardNum: deck.case,
      cards: deck.cards.map(({ num, count }) => ({ cardNum: num, count })),
      clientModifiedAt: deck.modified,
      expectedRevision,
    },
  };
}

export async function projectMatchForCloud(
  match: MatchRecord,
  options: { deckRevision: number | null; appVersion: string; now: number },
): Promise<
  | { ok: true; localDeckId: string; payload: CloudMatchDraft }
  | { ok: false; reason: ProjectionFailureReason }
> {
  if (match.mode === 'observe') return { ok: false, reason: 'not-human-vs-cpu' };
  const snapshot = match.selfDeckSnapshot;
  if (!snapshot?.deckId) return { ok: false, reason: 'deck-snapshot-missing' };
  if (match.recorded <= options.now - MATCH_RETENTION_MS) {
    return { ok: false, reason: 'match-expired' };
  }
  if (
    !Number.isSafeInteger(match.recorded)
    || match.recorded < 0
    || match.recorded > options.now + FUTURE_SKEW_MS
    || !Number.isSafeInteger(match.turns)
    || match.turns < 1
    || match.turns > 1_000
    || !match.deckName.trim()
    || match.deckName.length > 80
    || !VERSION.test(options.appVersion)
    || (options.deckRevision !== null
      && (!Number.isSafeInteger(options.deckRevision) || options.deckRevision < 1))
  ) return { ok: false, reason: 'match-invalid' };

  return {
    ok: true,
    localDeckId: snapshot.deckId,
    payload: {
      matchId: await stableCloudResourceId('match', match.sessionId ?? match.id),
      playedAt: match.recorded,
      deckId: await stableCloudResourceId('deck', snapshot.deckId),
      deckRevision: options.deckRevision,
      deckName: match.deckName,
      cpuRequestedDifficulty: 'normal',
      cpuEffectiveDifficulty: 'normal',
      cpuPolicyVersion: FIXED_CPU_POLICY_VERSION,
      outcome: match.won ? 'win' : 'loss',
      turnCount: match.turns,
      appVersion: options.appVersion,
    },
  };
}
