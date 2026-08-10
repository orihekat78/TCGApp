import { describe, expect, it } from 'vitest';
import type { DeckRecord, MatchRecord } from '../../meta-app/src/data/types';
import { planInitialCloudMigration } from '../../meta-app/src/cloud/migration';
import type { CloudBootstrap, CloudOperationIdentity } from '../../meta-app/src/cloud/types';

const DAY_MS = 24 * 60 * 60 * 1_000;
const NOW = 40 * DAY_MS;

function localDeck(overrides: Partial<DeckRecord> = {}): DeckRecord {
  return {
    id: 'deck-local',
    name: 'ローカルデッキ',
    partner: 'D08001',
    case: 'D08026',
    cards: [{ num: 'D08002', count: 40 }],
    modified: NOW - DAY_MS,
    ...overrides,
  };
}

function localMatch(overrides: Partial<MatchRecord> = {}): MatchRecord {
  return {
    id: 'match-local',
    sessionId: 'match-local',
    recorded: NOW - DAY_MS,
    won: true,
    deckName: 'ローカルデッキ',
    mode: 'solo',
    selfDeckSnapshot: {
      schemaVersion: 1,
      deckId: 'deck-local',
      name: 'ローカルデッキ',
      partner: 'D08001',
      case: 'D08026',
      cards: [{ num: 'D08002', count: 40 }],
    },
    turns: 8,
    duration: 0,
    evidGot: 7,
    evidLost: 3,
    contacts: 0,
    hirameki: 0,
    misread: 0,
    p1Target: 7,
    p2Target: 6,
    ...overrides,
  };
}

function bootstrap(overrides: Partial<CloudBootstrap> = {}): CloudBootstrap {
  return {
    identity: { email: 'family@example.com' },
    decks: [],
    deletedDecks: [],
    activeDeck: null,
    stats: { matches: 0, wins: 0, losses: 0, winRate: null },
    ...overrides,
  };
}

function identityFactory(): () => CloudOperationIdentity {
  let sequence = 0;
  return () => {
    sequence += 1;
    return {
      operationId: `operation-${sequence}`,
      idempotencyKey: `idempotency-key-${sequence.toString().padStart(4, '0')}`,
    };
  };
}

describe('initial local data cloud migration plan', () => {
  it('orders deck creation before active selection and deferred match upload', async () => {
    const decks = [localDeck()];
    const history = [localMatch()];
    const plan = await planInitialCloudMigration({
      decks,
      activeDeckId: 'deck-local',
      history,
      bootstrap: bootstrap(),
      appVersion: '1.0.0',
      now: NOW,
      createIdentity: identityFactory(),
    });

    expect(plan.operations.map((operation) => operation.kind))
      .toEqual(['deck-put', 'active-deck-put', 'match-post']);
    expect(plan.operations[0]).toMatchObject({
      kind: 'deck-put',
      localDeckId: 'deck-local',
      payload: { expectedRevision: null },
    });
    expect(plan.operations[1]).toMatchObject({
      kind: 'active-deck-put',
      localDeckId: 'deck-local',
      payload: { activeDeckId: 'deck-local', expectedRevision: null },
    });
    expect(plan.operations[2]).toMatchObject({
      kind: 'match-post',
      localMatchId: 'match-local',
      localDeckId: 'deck-local',
      payload: { deckRevision: null },
    });
    expect(plan.remoteDecksToAdd).toEqual([]);
    expect(plan.conflicts).toEqual([]);
    expect(decks).toEqual([localDeck()]);
    expect(history).toEqual([localMatch()]);
  });

  it('adopts an equivalent server revision without overwriting a newer local timestamp', async () => {
    const deck = localDeck({ modified: NOW });
    const plan = await planInitialCloudMigration({
      decks: [deck],
      activeDeckId: deck.id,
      history: [localMatch()],
      bootstrap: bootstrap({
        decks: [{
          deckId: deck.id,
          name: deck.name,
          partnerCardNum: deck.partner,
          caseCardNum: deck.case,
          cards: [{ cardNum: 'D08002', count: 40 }],
          clientModifiedAt: NOW - 10_000,
          revision: 7,
          serverUpdatedAt: NOW - 5_000,
        }],
        activeDeck: { activeDeckId: deck.id, revision: 3, serverUpdatedAt: NOW },
      }),
      appVersion: '1.0.0',
      now: NOW,
      createIdentity: identityFactory(),
    });

    expect(plan.operations.map((operation) => operation.kind)).toEqual(['match-post']);
    expect(plan.operations[0]).toMatchObject({ payload: { deckRevision: 7 } });
    expect(plan.deckMetadata[deck.id]).toEqual({
      cloudDeckId: deck.id,
      revision: 7,
      lastSyncedModified: deck.modified,
      serverUpdatedAt: NOW - 5_000,
    });
    expect(plan.activeDeckRevision).toBe(3);
    expect(plan.remoteDecksToAdd).toEqual([]);
  });

  it('imports server-only decks but never deletes a tombstoned local deck', async () => {
    const tombstoned = localDeck();
    const plan = await planInitialCloudMigration({
      decks: [tombstoned],
      activeDeckId: tombstoned.id,
      history: [],
      bootstrap: bootstrap({
        decks: [{
          deckId: 'remote-only',
          name: '別端末デッキ',
          partnerCardNum: 'D11001',
          caseCardNum: 'D11026',
          cards: [{ cardNum: 'D11002', count: 40 }],
          clientModifiedAt: NOW - 2_000,
          revision: 2,
          serverUpdatedAt: NOW - 1_000,
        }],
        deletedDecks: [{ deckId: tombstoned.id, deletedAt: NOW - 500 }],
      }),
      appVersion: '1.0.0',
      now: NOW,
      createIdentity: identityFactory(),
    });

    expect(plan.remoteDecksToAdd).toEqual([{
      id: 'remote-only',
      name: '別端末デッキ',
      partner: 'D11001',
      case: 'D11026',
      cards: [{ num: 'D11002', count: 40 }],
      modified: NOW - 2_000,
    }]);
    expect(plan.operations).toEqual([]);
    expect(plan.conflicts).toContainEqual({
      kind: 'deck',
      resourceId: tombstoned.id,
      detectedAt: NOW,
      code: 'DECK_TOMBSTONED',
    });
  });

  it('surfaces divergent two-device deck content and preserves both sides unchanged', async () => {
    const deck = localDeck();
    const remote = {
      deckId: deck.id,
      name: '別端末で変更',
      partnerCardNum: deck.partner,
      caseCardNum: deck.case,
      cards: [{ cardNum: 'D08002', count: 40 }],
      clientModifiedAt: NOW,
      revision: 4,
      serverUpdatedAt: NOW,
    };
    const plan = await planInitialCloudMigration({
      decks: [deck],
      activeDeckId: deck.id,
      history: [localMatch()],
      bootstrap: bootstrap({ decks: [remote] }),
      appVersion: '1.0.0',
      now: NOW,
      createIdentity: identityFactory(),
    });

    expect(plan.operations).toEqual([]);
    expect(plan.remoteDecksToAdd).toEqual([]);
    expect(plan.conflicts).toContainEqual({
      kind: 'deck',
      resourceId: deck.id,
      detectedAt: NOW,
      code: 'DECK_CONTENT_CONFLICT',
    });
    expect(deck.name).toBe('ローカルデッキ');
    expect(remote.name).toBe('別端末で変更');
    expect(plan.skippedMatches).toContainEqual({
      localMatchId: 'match-local',
      reason: 'deck-conflict',
    });
  });

  it('records non-uploadable history reasons without changing local history', async () => {
    const history = [
      localMatch({ id: 'observe', sessionId: 'observe', mode: 'observe' }),
      localMatch({ id: 'legacy', sessionId: 'legacy', selfDeckSnapshot: undefined }),
      localMatch({ id: 'expired', sessionId: 'expired', recorded: NOW - 30 * DAY_MS }),
    ];
    const plan = await planInitialCloudMigration({
      decks: [localDeck()],
      activeDeckId: 'deck-local',
      history,
      bootstrap: bootstrap(),
      appVersion: '1.0.0',
      now: NOW,
      createIdentity: identityFactory(),
    });

    expect(plan.operations.filter((operation) => operation.kind === 'match-post')).toEqual([]);
    expect(plan.skippedMatches).toEqual([
      { localMatchId: 'observe', reason: 'not-human-vs-cpu' },
      { localMatchId: 'legacy', reason: 'deck-snapshot-missing' },
      { localMatchId: 'expired', reason: 'match-expired' },
    ]);
    expect(history).toHaveLength(3);
  });
});
