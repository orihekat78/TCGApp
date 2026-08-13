// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleCloudDataRequest,
  type CloudDataApiEnv,
} from '../../src/cloud-data/api';
import { deriveEmailKey } from '../../src/cloud-data/identity';
import { acquireCloudSyncRuntime } from '../../meta-app/src/cloud/runtime';
import { readCloudSyncState } from '../../meta-app/src/cloud/storage';
import { useCloudSyncStatusStore } from '../../meta-app/src/cloud/statusStore';
import { SAMPLE_DECK } from '../../meta-app/src/data/sampleDeck';
import { useDecksStore } from '../../meta-app/src/state/decksStore';
import { useHistoryStore } from '../../meta-app/src/state/historyStore';
import { SqliteD1Database } from '../cloud-data/d1-test-adapter';

vi.mock('jose', () => ({
  base64url: {
    encode(value: Uint8Array) {
      let binary = '';
      for (const byte of value) binary += String.fromCharCode(byte);
      return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
    },
  },
  createRemoteJWKSet: vi.fn(),
  jwtVerify: vi.fn(async (assertion: string) => {
    if (assertion !== 'valid-access-token') throw new Error('invalid assertion');
    return {
      payload: {
        aud: 'preview-audience',
        email: 'family@example.com',
        sub: 'access-sub-family',
        type: 'app',
      },
    };
  }),
}));

const BASE_URL = 'https://preview.conan-private.pages.dev';
const NOW = 1_800_000_000_000;
const migration = readFileSync('migrations/0001_cloud_data.sql', 'utf8');

type FetchLog = { method: string; path: string; status: number };

const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await flush();
  }
  throw new Error('cloud runtime did not settle');
}

function createDatabase(): { sqlite: DatabaseSync; env: CloudDataApiEnv } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(migration);
  sqlite.prepare(
    `INSERT INTO app_meta
      (singleton, environment, database_id, initialized_at)
     VALUES (1, 'production', 'production-database', ?)`,
  ).run(NOW);
  return {
    sqlite,
    env: {
      DB: new SqliteD1Database(sqlite),
      ACCESS_TEAM_DOMAIN: 'https://family-team.cloudflareaccess.com',
      ACCESS_AUD: 'preview-audience',
      DEPLOYMENT_ENV: 'production',
      APP_HOST_KIND: 'suffix',
      APP_HOST_VALUE: '.conan-private.pages.dev',
      D1_DATABASE_ID: 'production-database',
      EMAIL_KEY_SECRET: 'preview-only-secret-with-at-least-32-bytes',
    },
  };
}

function createHandlerFetch(
  env: CloudDataApiEnv,
  options: { accessToken: string | null; log: FetchLog[] },
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), BASE_URL);
    const headers = new Headers(init?.headers);
    if (options.accessToken) {
      headers.set('Cf-Access-Jwt-Assertion', options.accessToken);
    }
    const method = init?.method ?? 'GET';
    if (method !== 'GET') headers.set('Origin', BASE_URL);
    const response = await handleCloudDataRequest(
      new Request(url, { ...init, method, headers }),
      env,
      {
        verificationKey: new Uint8Array([1]),
        now: () => NOW,
        createUserId: () => 'user-family',
        createLeaseToken: () => 'lease-token-family',
      },
    );
    options.log.push({ method, path: url.pathname, status: response.status });
    return response;
  }) as typeof fetch;
}

async function enroll(sqlite: DatabaseSync, env: CloudDataApiEnv): Promise<void> {
  const emailKey = await deriveEmailKey('family@example.com', env.EMAIL_KEY_SECRET);
  sqlite.prepare(
    `INSERT INTO sync_enrollments
      (email_key, enabled, created_at, updated_at)
     VALUES (?, 1, ?, ?)`,
  ).run(emailKey, NOW, NOW);
}

async function seedLegacyInvalidActiveDeck(
  sqlite: DatabaseSync,
  env: CloudDataApiEnv,
): Promise<void> {
  const emailKey = await deriveEmailKey('family@example.com', env.EMAIL_KEY_SECRET);
  sqlite.prepare(
    `INSERT INTO users
      (id, email_key, email, access_sub, status, created_at, last_seen_at, deleted_at)
     VALUES ('user-family', ?, 'family@example.com', 'access-sub-family',
             'active', ?, ?, NULL)`,
  ).run(emailKey, NOW, NOW);
  sqlite.prepare(
    `INSERT INTO decks
      (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
       revision, client_modified_at, server_updated_at)
     VALUES ('user-family', 'legacy-illegal', 'Legacy illegal', 'D08001', 'D08026',
             ?, 1, ?, ?)`,
  ).run(JSON.stringify([{ cardNum: 'D08002', count: 40 }]), NOW - 1, NOW);
  sqlite.prepare(
    `INSERT INTO user_preferences
      (user_id, active_deck_id, revision, server_updated_at)
     VALUES ('user-family', 'legacy-illegal', 1, ?)`,
  ).run(NOW);
}

describe('cloud sync runtime through the cloud data handler', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.stubEnv('VITE_CLOUD_DATA_SYNC_ENABLED', 'true');
    window.localStorage.clear();
    window.location.hash = '';
    useDecksStore.setState({ decks: [], activeDeckId: '', _hasHydrated: true });
    useHistoryStore.setState({ history: [], _hasHydrated: true, _hasCanonicalLoaded: true });
    useCloudSyncStatusStore.getState().reset();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    await flush();
  });

  it('quarantines a legacy illegal active deck, then syncs a legal deck through the real PUT contract', async () => {
    const { sqlite, env } = createDatabase();
    const log: FetchLog[] = [];
    let release: (() => void) | null = null;
    try {
      await enroll(sqlite, env);
      await seedLegacyInvalidActiveDeck(sqlite, env);
      vi.stubGlobal('fetch', createHandlerFetch(env, {
        accessToken: 'valid-access-token',
        log,
      }));

      release = acquireCloudSyncRuntime();
      await waitFor(() => useCloudSyncStatusStore.getState().status.phase === 'online');

      expect(useDecksStore.getState()).toMatchObject({ decks: [], activeDeckId: '' });
      expect(sqlite.prepare(
        `SELECT active_deck_id, revision FROM user_preferences
         WHERE user_id = 'user-family'`,
      ).get()).toEqual({ active_deck_id: null, revision: 2 });
      expect(sqlite.prepare(
        `SELECT COUNT(*) AS count FROM decks
         WHERE user_id = 'user-family' AND deck_id = 'legacy-illegal'`,
      ).get()).toEqual({ count: 1 });

      useDecksStore.getState().add({
        ...structuredClone(SAMPLE_DECK),
        id: 'legal-local-deck',
        name: 'Legal local deck',
      });
      await waitFor(() => (
        log.filter(({ method }) => method === 'PUT').length === 2
        && useCloudSyncStatusStore.getState().status.phase === 'online'
      ));

      expect(log.map(({ method, path, status }) => `${status} ${method} ${path}`)).toEqual([
        '200 GET /api/v1/bootstrap',
        expect.stringMatching(/^201 PUT \/api\/v1\/decks\/[A-Za-z0-9_-]+$/u),
        '200 PUT /api/v1/active-deck',
      ]);
      expect(sqlite.prepare(
        `SELECT name, revision FROM decks
         WHERE user_id = 'user-family' AND name = 'Legal local deck'`,
      ).get()).toEqual({ name: 'Legal local deck', revision: 1 });
      expect(sqlite.prepare(
        `SELECT active_deck_id, revision FROM user_preferences
         WHERE user_id = 'user-family'`,
      ).get()).toEqual(expect.objectContaining({
        active_deck_id: expect.stringMatching(/^[A-Za-z0-9_-]+$/u),
        revision: 3,
      }));
      expect((await readCloudSyncState()).outbox).toEqual([]);
      expect(useCloudSyncStatusStore.getState().status).toMatchObject({
        phase: 'online',
        pendingCount: 0,
      });
    } finally {
      release?.();
      await flush();
      sqlite.close();
    }
  });

  it.each([
    { label: '401 Access rejection', token: null, status: 401, code: 'UNAUTHORIZED' },
    {
      label: '403 private-sync enrollment rejection',
      token: 'valid-access-token',
      status: 403,
      code: 'SYNC_NOT_AVAILABLE',
    },
  ])('keeps $label explicit without navigating away', async ({ token, status, code }) => {
    const { sqlite, env } = createDatabase();
    const log: FetchLog[] = [];
    let release: (() => void) | null = null;
    try {
      const local = { ...structuredClone(SAMPLE_DECK), id: 'local-preserved' };
      useDecksStore.setState({ decks: [local], activeDeckId: local.id, _hasHydrated: true });
      window.location.hash = '#deck';
      vi.stubGlobal('fetch', createHandlerFetch(env, { accessToken: token, log }));

      release = acquireCloudSyncRuntime();
      await waitFor(() => useCloudSyncStatusStore.getState().status.phase === 'error');

      expect(log).toEqual([{ method: 'GET', path: '/api/v1/bootstrap', status }]);
      expect(useCloudSyncStatusStore.getState().status).toMatchObject({
        phase: 'error',
        message: code,
      });
      expect(window.location.hash).toBe('#deck');
      expect(useDecksStore.getState().decks).toEqual([local]);
      expect((await readCloudSyncState()).outbox).toEqual([]);
    } finally {
      release?.();
      await flush();
      sqlite.close();
    }
  });
});
