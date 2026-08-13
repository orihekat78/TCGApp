import { describe, expect, it } from 'vitest';
import type { DeckRecord, MatchRecord } from '../../meta-app/src/data/types';
import { SAMPLE_DECK } from '../../meta-app/src/data/sampleDeck';
import {
  FIXED_CPU_POLICY_VERSION,
  projectDeckForCloud,
  projectMatchForCloud,
  stableCloudResourceId,
} from '../../meta-app/src/cloud/projection';

const cards = SAMPLE_DECK.cards;

function deckFixture(overrides: Partial<DeckRecord> = {}): DeckRecord {
  return {
    id: 'deck-123',
    name: '同期デッキ',
    partner: SAMPLE_DECK.partner,
    case: SAMPLE_DECK.case,
    cards,
    modified: 1_000,
    ...overrides,
  };
}

function matchFixture(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 'match-123',
    sessionId: 'match-123',
    recorded: 2_000,
    won: true,
    deckName: '同期デッキ',
    mode: 'solo',
    selfDeckSnapshot: {
      schemaVersion: 1,
      deckId: 'deck-123',
      name: '同期デッキ',
      partner: 'D08001',
      case: 'D08026',
      cards,
    },
    turns: 8,
    duration: 0,
    evidGot: 7,
    evidLost: 3,
    contacts: 1,
    hirameki: 1,
    misread: 0,
    p1Target: 7,
    p2Target: 6,
    replayRef: {
      storageSchemaVersion: 1,
      replaySchemaVersion: 3,
      artifactId: 'private-replay-ref',
      digest: `sha256-${'a'.repeat(64)}`,
      byteLength: 1234,
    },
    ...overrides,
  };
}

describe('cloud sync public projections', () => {
  it('projects only the public playable deck fields expected by the API', async () => {
    const result = await projectDeckForCloud(deckFixture(), 4);

    expect(result).toEqual({
      ok: true,
      payload: {
        deckId: 'deck-123',
        name: '同期デッキ',
        partnerCardNum: 'D08001',
        caseCardNum: 'D08026',
        cards: SAMPLE_DECK.cards.map(({ num, count }) => ({ cardNum: num, count })),
        clientModifiedAt: 1_000,
        expectedRevision: 4,
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/email|replay|jwt|authorization/i);
  });

  it('does not upload incomplete local deck drafts', async () => {
    await expect(projectDeckForCloud(deckFixture({ cards: [] }), null))
      .resolves.toEqual({ ok: false, reason: 'deck-not-playable' });
  });

  it.each([
    ['null cards', { cards: null }],
    ['a missing name', { name: undefined }],
    ['a null card entry', { cards: [null] }],
  ])('fails closed without throwing for hydrated decks with %s', async (_label, malformed) => {
    await expect(projectDeckForCloud({
      ...deckFixture(),
      ...malformed,
    } as unknown as DeckRecord, null)).resolves.toEqual({
      ok: false,
      reason: 'deck-not-playable',
    });
  });

  it.each([
    ['a partner placed in the main deck', [{ num: 'D08002', count: 40 }]],
    ['combined reprints over their official-ID copy limit', [
      { num: 'D08005', count: 3 },
      { num: 'D08006', count: 37 },
    ]],
  ])('does not upload %s', async (_label, illegalCards) => {
    await expect(projectDeckForCloud(deckFixture({ cards: illegalCards }), null))
      .resolves.toEqual({ ok: false, reason: 'deck-not-playable' });
  });

  it('uses stable API-safe IDs without changing already-safe IDs', async () => {
    await expect(stableCloudResourceId('deck', 'deck-123')).resolves.toBe('deck-123');
    const first = await stableCloudResourceId('deck', '旧 deck/家族');
    const second = await stableCloudResourceId('deck', '旧 deck/家族');
    expect(first).toBe(second);
    expect(first).toMatch(/^deck_[a-f0-9]{64}$/);
  });

  it('projects a human-vs-CPU result without replay or detailed action data', async () => {
    const result = await projectMatchForCloud(matchFixture(), {
      deckRevision: 3,
      appVersion: '1.0.0',
      now: 2_500,
    });

    expect(result).toEqual({
      ok: true,
      localDeckId: 'deck-123',
      payload: {
        matchId: 'match-123',
        playedAt: 2_000,
        deckId: 'deck-123',
        deckRevision: 3,
        deckName: '同期デッキ',
        cpuRequestedDifficulty: 'normal',
        cpuEffectiveDifficulty: 'normal',
        cpuPolicyVersion: FIXED_CPU_POLICY_VERSION,
        outcome: 'win',
        turnCount: 8,
        appVersion: '1.0.0',
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/replay|artifact|digest|contact|hirameki|misread/i);
  });

  it('keeps a new deck revision unresolved until its deck upload completes', async () => {
    const result = await projectMatchForCloud(matchFixture(), {
      deckRevision: null,
      appVersion: '1.0.0',
      now: 2_500,
    });
    expect(result.ok && result.payload.deckRevision).toBeNull();
  });

  it.each([
    ['CPU-vs-CPU', { mode: 'observe' as const }, 'not-human-vs-cpu', 2_500],
    ['missing deck snapshot', { selfDeckSnapshot: undefined }, 'deck-snapshot-missing', 2_500],
    ['expired result', { recorded: 1_000 }, 'match-expired', 30 * 24 * 60 * 60 * 1_000 + 1_000],
    ['invalid turns', { turns: 0 }, 'match-invalid', 2_500],
  ])('skips %s while retaining the local record', async (_label, override, reason, now) => {
    const result = await projectMatchForCloud(matchFixture(override), {
      deckRevision: 1,
      appVersion: '1.0.0',
      now,
    });
    expect(result).toEqual({ ok: false, reason });
  });
});
