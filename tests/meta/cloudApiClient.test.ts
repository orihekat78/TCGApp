import { describe, expect, it, vi } from 'vitest';
import { CloudApiError, createCloudApiClient } from '../../meta-app/src/cloud/apiClient';
import type { CloudSyncOperation } from '../../meta-app/src/cloud/types';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function deckOperation(): CloudSyncOperation {
  return {
    kind: 'deck-put',
    operationId: 'operation-1',
    idempotencyKey: 'idempotency-key-0001',
    createdAt: 1_000,
    attempts: 1,
    nextAttemptAt: 1_000,
    localDeckId: 'deck-1',
    payload: {
      deckId: 'deck-1',
      name: '同期デッキ',
      partnerCardNum: 'D08001',
      caseCardNum: 'D08026',
      cards: [{ cardNum: 'D08002', count: 40 }],
      clientModifiedAt: 900,
      expectedRevision: null,
    },
  };
}

describe('same-origin cloud API client', () => {
  it('loads and validates the verified identity bootstrap without caching', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      data: {
        identity: { email: 'family@example.com' },
        decks: [],
        deletedDecks: [],
        activeDeck: null,
        stats: { matches: 0, wins: 0, losses: 0, winRate: null },
      },
    }));
    const client = createCloudApiClient(fetcher);

    await expect(client.bootstrap()).resolves.toMatchObject({
      identity: { email: 'family@example.com' },
    });
    expect(fetcher).toHaveBeenCalledWith('/api/v1/bootstrap', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
      headers: { Accept: 'application/json' },
    }));
  });

  it('rejects malformed success data instead of merging it into local state', async () => {
    const client = createCloudApiClient(async () => jsonResponse({
      data: {
        identity: { email: 'not-an-email' },
        decks: 'malformed',
      },
    }));

    await expect(client.bootstrap()).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      retryable: false,
    });
  });

  it('sends only the stored mutation payload and stable idempotency key', async () => {
    const operation = deckOperation();
    const fetcher = vi.fn(async () => jsonResponse({
      data: {
        deck: {
          deckId: operation.payload.deckId,
          name: operation.payload.name,
          partnerCardNum: operation.payload.partnerCardNum,
          caseCardNum: operation.payload.caseCardNum,
          cards: operation.payload.cards,
          clientModifiedAt: operation.payload.clientModifiedAt,
          revision: 1,
          serverUpdatedAt: 1_100,
        },
        replayed: false,
      },
    }, 201));
    const client = createCloudApiClient(fetcher);

    await expect(client.execute(operation)).resolves.toMatchObject({
      kind: 'deck-put',
      deck: { deckId: 'deck-1', revision: 1 },
    });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/decks/deck-1');
    expect(init).toMatchObject({
      method: 'PUT',
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': operation.idempotencyKey,
      },
    });
    expect(JSON.parse(String(init.body))).toEqual(operation.payload);
    expect(String(init.body)).not.toMatch(/email|jwt|authorization|replay/i);
  });

  it('classifies rate limits, conflicts, and transport failures for safe retry policy', async () => {
    const rateLimited = createCloudApiClient(async () => jsonResponse(
      { error: { code: 'RATE_LIMITED' } },
      429,
      { 'Retry-After': '7' },
    ));
    await expect(rateLimited.execute(deckOperation())).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryable: true,
      conflict: false,
      retryAfterMs: 7_000,
    });

    const conflict = createCloudApiClient(async () => jsonResponse(
      { error: { code: 'CONFLICT' } },
      409,
    ));
    await expect(conflict.execute(deckOperation())).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      retryable: false,
      conflict: true,
    });

    const offline = createCloudApiClient(async () => {
      throw new TypeError('network unavailable');
    });
    const error = await offline.execute(deckOperation()).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(CloudApiError);
    expect(error).toMatchObject({ code: 'NETWORK_UNAVAILABLE', retryable: true, offline: true });
  });
});
