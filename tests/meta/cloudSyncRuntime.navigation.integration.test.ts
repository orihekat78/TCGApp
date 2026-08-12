import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquireCloudSyncRuntime } from '../../meta-app/src/cloud/runtime';
import { useCloudSyncStatusStore } from '../../meta-app/src/cloud/statusStore';
import { SAMPLE_DECK } from '../../meta-app/src/data/sampleDeck';
import { useDecksStore } from '../../meta-app/src/state/decksStore';

type RequestLog = { url: string; method: string; body: Record<string, unknown> | null };

const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await flush();
  }
  throw new Error('cloud runtime did not finish its queued requests');
}

describe('cloud sync runtime navigation lease', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubEnv('VITE_CLOUD_DATA_SYNC_ENABLED', 'true');
    useDecksStore.setState({ decks: [], activeDeckId: '', _hasHydrated: true });
    useCloudSyncStatusStore.getState().reset();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await flush();
  });

  it('keeps one runtime through HOME-to-DECK navigation and syncs a new valid active deck in order', async () => {
    const requests: RequestLog[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null;
      requests.push({ url, method, body });

      if (url === '/api/v1/bootstrap') {
        return Response.json({ data: {
          identity: { email: 'family@example.com' },
          decks: [],
          deletedDecks: [],
          activeDeck: null,
          stats: { matches: 0, wins: 0, losses: 0, winRate: null },
        } });
      }
      if (url.startsWith('/api/v1/decks/')) {
        return Response.json({ data: {
          deck: {
            deckId: body?.deckId,
            name: body?.name,
            partnerCardNum: body?.partnerCardNum,
            caseCardNum: body?.caseCardNum,
            cards: body?.cards,
            clientModifiedAt: body?.clientModifiedAt,
            revision: 1,
            serverUpdatedAt: 2_000_000,
          },
          replayed: false,
        } });
      }
      return Response.json({ data: {
        activeDeck: { activeDeckId: body?.activeDeckId, revision: 1, serverUpdatedAt: 2_000_000 },
        replayed: false,
      } });
    }));

    const leaveHome = acquireCloudSyncRuntime();
    await waitFor(() => (
      requests.length === 1 && useCloudSyncStatusStore.getState().status.phase === 'online'
    ));
    leaveHome();
    const leaveDeck = acquireCloudSyncRuntime();

    try {
      useDecksStore.getState().add({
        ...structuredClone(SAMPLE_DECK),
        id: 'navigation-deck',
        name: 'Navigation deck',
      });
      await waitFor(() => requests.length === 3);

      expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
        'GET /api/v1/bootstrap',
        expect.stringMatching(/^PUT \/api\/v1\/decks\//),
        'PUT /api/v1/active-deck',
      ]);
      expect(requests[2]?.body?.activeDeckId).toBe(requests[1]?.body?.deckId);
      expect(useCloudSyncStatusStore.getState().status.phase).not.toBe('error');
    } finally {
      leaveDeck();
    }
  });
});
