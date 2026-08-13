import type {
  CloudBootstrap,
  CloudDeck,
  CloudOperationResult,
  CloudSyncOperation,
} from './types';
import { deckLegalityCatalogResolver } from '../../../src/shared/deck-legality-catalog.generated';
import { validateDeckLegality } from '../../../src/shared/deck-legality';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface CloudApiClient {
  bootstrap(): Promise<CloudBootstrap>;
  execute(operation: CloudSyncOperation): Promise<CloudOperationResult>;
}

export class CloudApiError extends Error {
  constructor(
    readonly code: string,
    readonly options: {
      status: number | null;
      retryable: boolean;
      conflict: boolean;
      offline: boolean;
      retryAfterMs: number | null;
    },
    cause?: unknown,
  ) {
    super(code, cause === undefined ? undefined : { cause });
    this.name = 'CloudApiError';
  }

  get status(): number | null { return this.options.status; }
  get retryable(): boolean { return this.options.retryable; }
  get conflict(): boolean { return this.options.conflict; }
  get offline(): boolean { return this.options.offline; }
  get retryAfterMs(): number | null { return this.options.retryAfterMs; }
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalidResponse();
  }
  return value as Record<string, unknown>;
}

function exactRecord(value: unknown, fields: readonly string[]): Record<string, unknown> {
  const result = record(value);
  if (
    Object.keys(result).length !== fields.length
    || fields.some((field) => !Object.hasOwn(result, field))
  ) throw invalidResponse();
  return result;
}

function safeInteger(value: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw invalidResponse();
  return value as number;
}

function requiredString(value: unknown, pattern: RegExp, maxLength: number): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength || !pattern.test(value)) {
    throw invalidResponse();
  }
  return value;
}

function invalidResponse(cause?: unknown): CloudApiError {
  return new CloudApiError('INVALID_RESPONSE', {
    status: null,
    retryable: false,
    conflict: false,
    offline: false,
    retryAfterMs: null,
  }, cause);
}

const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CARD_NUM = /^[A-Za-z0-9-]{1,24}$/;

function parseCloudDeck(value: unknown): CloudDeck {
  const deck = exactRecord(value, [
    'deckId', 'name', 'partnerCardNum', 'caseCardNum', 'cards',
    'clientModifiedAt', 'revision', 'serverUpdatedAt',
  ]);
  if (!Array.isArray(deck.cards) || deck.cards.length < 1 || deck.cards.length > 40) {
    throw invalidResponse();
  }
  const seen = new Set<string>();
  const cards = deck.cards.map((value) => {
    const card = exactRecord(value, ['cardNum', 'count']);
    const cardNum = requiredString(card.cardNum, CARD_NUM, 24);
    if (seen.has(cardNum)) throw invalidResponse();
    seen.add(cardNum);
    return { cardNum, count: safeInteger(card.count, 1) };
  });
  if (cards.reduce((total, card) => total + card.count, 0) !== 40) throw invalidResponse();
  const name = typeof deck.name === 'string' ? deck.name : '';
  if (!name.trim() || name.length > 80) throw invalidResponse();
  const parsed = {
    deckId: requiredString(deck.deckId, RESOURCE_ID, 128),
    name,
    partnerCardNum: requiredString(deck.partnerCardNum, CARD_NUM, 24),
    caseCardNum: requiredString(deck.caseCardNum, CARD_NUM, 24),
    cards,
    clientModifiedAt: safeInteger(deck.clientModifiedAt),
    revision: safeInteger(deck.revision, 1),
    serverUpdatedAt: safeInteger(deck.serverUpdatedAt),
  };
  if (!validateDeckLegality({
    partner: parsed.partnerCardNum,
    case: parsed.caseCardNum,
    main: parsed.cards.map(({ cardNum, count }) => ({ printingId: cardNum, count })),
  }, deckLegalityCatalogResolver).ok) throw invalidResponse();
  return parsed;
}

function parseBootstrap(value: unknown): CloudBootstrap {
  const data = exactRecord(value, ['identity', 'decks', 'deletedDecks', 'activeDeck', 'stats']);
  const identity = exactRecord(data.identity, ['email']);
  const email = requiredString(
    identity.email,
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    254,
  );
  if (!Array.isArray(data.decks) || !Array.isArray(data.deletedDecks)) throw invalidResponse();
  const decks = data.decks.map(parseCloudDeck);
  const deletedDecks = data.deletedDecks.map((value) => {
    const deleted = exactRecord(value, ['deckId', 'deletedAt']);
    return {
      deckId: requiredString(deleted.deckId, RESOURCE_ID, 128),
      deletedAt: safeInteger(deleted.deletedAt),
    };
  });
  let activeDeck: CloudBootstrap['activeDeck'] = null;
  if (data.activeDeck !== null) {
    const active = exactRecord(data.activeDeck, ['activeDeckId', 'revision', 'serverUpdatedAt']);
    activeDeck = {
      activeDeckId: active.activeDeckId === null
        ? null
        : requiredString(active.activeDeckId, RESOURCE_ID, 128),
      revision: safeInteger(active.revision, 1),
      serverUpdatedAt: safeInteger(active.serverUpdatedAt),
    };
  }
  const stats = exactRecord(data.stats, ['matches', 'wins', 'losses', 'winRate']);
  const matches = safeInteger(stats.matches);
  const wins = safeInteger(stats.wins);
  const losses = safeInteger(stats.losses);
  const winRate = stats.winRate === null
    ? null
    : typeof stats.winRate === 'number' && Number.isFinite(stats.winRate)
      && stats.winRate >= 0 && stats.winRate <= 1
      ? stats.winRate
      : (() => { throw invalidResponse(); })();
  if (wins + losses !== matches) throw invalidResponse();
  return { identity: { email }, decks, deletedDecks, activeDeck, stats: { matches, wins, losses, winRate } };
}

async function responseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) throw invalidResponse();
  try {
    return await response.json();
  } catch (error) {
    throw invalidResponse(error);
  }
}

function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get('Retry-After');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function throwHttpError(response: Response, body: unknown): Promise<never> {
  let code: string;
  try {
    const wrapper = exactRecord(body, ['error']);
    const error = exactRecord(wrapper.error, ['code']);
    code = requiredString(error.code, /^[A-Z0-9_]{1,80}$/, 80);
  } catch {
    code = 'REQUEST_FAILED';
  }
  throw new CloudApiError(code, {
    status: response.status,
    retryable: response.status === 429 || response.status >= 500,
    conflict: response.status === 409,
    offline: false,
    retryAfterMs: retryAfterMs(response),
  });
}

async function requestJson(fetcher: Fetcher, url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch (error) {
    if (error instanceof CloudApiError) throw error;
    throw new CloudApiError('NETWORK_UNAVAILABLE', {
      status: null,
      retryable: true,
      conflict: false,
      offline: true,
      retryAfterMs: null,
    }, error);
  }
  const body = await responseJson(response);
  if (!response.ok) await throwHttpError(response, body);
  return body;
}

const commonRequest: Pick<RequestInit, 'cache' | 'credentials' | 'redirect'> = {
  cache: 'no-store',
  credentials: 'same-origin',
  redirect: 'error',
};

function mutationRequest(operation: CloudSyncOperation): { url: string; method: string; body: unknown } {
  switch (operation.kind) {
    case 'deck-put':
      return { url: `/api/v1/decks/${encodeURIComponent(operation.payload.deckId)}`, method: 'PUT', body: operation.payload };
    case 'deck-delete':
      if (operation.payload.expectedRevision === null) throw new Error('CLOUD_SYNC_OPERATION_NOT_READY');
      return { url: `/api/v1/decks/${encodeURIComponent(operation.cloudDeckId)}`, method: 'DELETE', body: operation.payload };
    case 'active-deck-put':
      return { url: '/api/v1/active-deck', method: 'PUT', body: operation.payload };
    case 'match-post':
      if (operation.payload.deckRevision === null) throw new Error('CLOUD_SYNC_OPERATION_NOT_READY');
      return { url: '/api/v1/matches', method: 'POST', body: operation.payload };
  }
}

function parseOperationResult(operation: CloudSyncOperation, value: unknown): CloudOperationResult {
  const wrapper = exactRecord(value, ['data']);
  const data = record(wrapper.data);
  switch (operation.kind) {
    case 'deck-put': {
      const result = exactRecord(data, ['deck', 'replayed']);
      if (typeof result.replayed !== 'boolean') throw invalidResponse();
      return { kind: 'deck-put', deck: parseCloudDeck(result.deck), replayed: result.replayed };
    }
    case 'deck-delete': {
      const result = exactRecord(data, ['deckId', 'deletedAt', 'replayed']);
      if (typeof result.replayed !== 'boolean') throw invalidResponse();
      return {
        kind: 'deck-delete',
        deckId: requiredString(result.deckId, RESOURCE_ID, 128),
        deletedAt: safeInteger(result.deletedAt),
        replayed: result.replayed,
      };
    }
    case 'active-deck-put': {
      const result = exactRecord(data, ['activeDeck', 'replayed']);
      const active = exactRecord(result.activeDeck, ['activeDeckId', 'revision', 'serverUpdatedAt']);
      if (typeof result.replayed !== 'boolean') throw invalidResponse();
      return {
        kind: 'active-deck-put',
        activeDeck: {
          activeDeckId: active.activeDeckId === null
            ? null
            : requiredString(active.activeDeckId, RESOURCE_ID, 128),
          revision: safeInteger(active.revision, 1),
          serverUpdatedAt: safeInteger(active.serverUpdatedAt),
        },
        replayed: result.replayed,
      };
    }
    case 'match-post': {
      const result = exactRecord(data, ['matchId', 'replayed']);
      if (typeof result.replayed !== 'boolean') throw invalidResponse();
      return {
        kind: 'match-post',
        matchId: requiredString(result.matchId, RESOURCE_ID, 128),
        replayed: result.replayed,
      };
    }
  }
}

export function createCloudApiClient(fetcher: Fetcher = fetch): CloudApiClient {
  return {
    async bootstrap() {
      const body = await requestJson(fetcher, '/api/v1/bootstrap', {
        ...commonRequest,
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const wrapper = exactRecord(body, ['data']);
      return parseBootstrap(wrapper.data);
    },
    async execute(operation) {
      const request = mutationRequest(operation);
      const body = await requestJson(fetcher, request.url, {
        ...commonRequest,
        method: request.method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': operation.idempotencyKey,
        },
        body: JSON.stringify(request.body),
      });
      return parseOperationResult(operation, body);
    },
  };
}
