import { readFileSync } from "node:fs";
import { generateKeyPair, SignJWT } from "jose";
import { Miniflare } from "miniflare";
import { unstable_splitSqlQuery } from "wrangler";
import {
  handleCloudDataRequest,
  type CloudDataApiEnv,
} from "../../src/cloud-data/api";
import type {
  D1AllResultLike,
  D1DatabaseLike,
  D1PreparedStatementLike,
  D1RunResultLike,
} from "../../src/cloud-data/d1-types";
import { deriveEmailKey } from "../../src/cloud-data/identity";
import { DAILY_RATE_LIMITS } from "../../src/cloud-data/rate-limit";
import { CLOUD_DATA_LIMITS } from "../../src/cloud-data/repository";
import { MATCH_RETENTION_MS } from "../../src/cloud-data/retention";
import {
  FREE_TIER_LIMITS,
  PERSONAL_SYNC_STORAGE_BUDGET_BYTES,
  SYNC_QUOTA_PROOF,
  estimateWorstCaseDailySyncUsage,
} from "../../src/cloud-data/usage-budget";

type D1Meta = {
  changes?: number;
  rows_read?: number;
  rows_written?: number;
  size_after?: number;
};

type RawResult<T = Record<string, unknown>> = {
  success?: boolean;
  results?: T[];
  meta?: D1Meta;
};

type RawStatement = {
  bind(...values: unknown[]): RawStatement;
  all<T>(): Promise<RawResult<T>>;
  run(): Promise<RawResult>;
};

type RawDatabase = {
  batch(statements: RawStatement[]): Promise<RawResult[]>;
  prepare(sql: string): RawStatement;
};

type Measurement = {
  scenario: string;
  status: number;
  queries: number;
  rowsRead: number;
  rowsWritten: number;
  databaseBytes: number;
};

class D1Meter {
  queries = 0;
  rowsRead = 0;
  rowsWritten = 0;
  databaseBytes = 0;

  record(meta: D1Meta | undefined): void {
    this.queries += 1;
    this.rowsRead += meta?.rows_read ?? 0;
    this.rowsWritten += meta?.rows_written ?? 0;
    this.databaseBytes = Math.max(this.databaseBytes, meta?.size_after ?? 0);
  }

  reset(): void {
    this.queries = 0;
    this.rowsRead = 0;
    this.rowsWritten = 0;
    this.databaseBytes = 0;
  }
}

class MeteredStatement implements D1PreparedStatementLike {
  constructor(
    private readonly statement: RawStatement,
    private readonly meter: D1Meter,
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    return new MeteredStatement(this.statement.bind(...values), this.meter);
  }

  async first<T>(): Promise<T | null> {
    const result = await this.statement.all<T>();
    this.meter.record(result.meta);
    return result.results?.[0] ?? null;
  }

  async all<T>(): Promise<D1AllResultLike<T>> {
    const result = await this.statement.all<T>();
    this.meter.record(result.meta);
    return { success: result.success, results: result.results };
  }

  async run(): Promise<D1RunResultLike> {
    const result = await this.statement.run();
    this.meter.record(result.meta);
    return {
      success: result.success,
      meta: { changes: result.meta?.changes },
    };
  }
}

class MeteredDatabase implements D1DatabaseLike {
  constructor(
    private readonly database: RawDatabase,
    private readonly meter: D1Meter,
  ) {}

  prepare(sql: string): D1PreparedStatementLike {
    return new MeteredStatement(this.database.prepare(sql), this.meter);
  }
}

const migration = readFileSync("migrations/0001_cloud_data.sql", "utf8").replace(
  /\r\n/g,
  "\n",
);
const baseUrl = "https://preview.conan-private.pages.dev";
const teamDomain = "https://family-team.cloudflareaccess.com";
const audience = "budget-preview-audience";
const email = "budget@example.com";
const emailKeySecret = "budget-probe-secret-with-at-least-32-bytes";
const now = 1_800_000_000_000;
const dayMs = 24 * 60 * 60 * 1_000;
const currentDay = Math.floor(now / dayMs) * dayMs;
const { publicKey, privateKey } = await generateKeyPair("RS256");
const accessToken = await new SignJWT({ email, type: "app" })
  .setProtectedHeader({ alg: "RS256" })
  .setIssuer(teamDomain)
  .setAudience(audience)
  .setSubject("budget-access-sub")
  .setIssuedAt()
  .setExpirationTime("5m")
  .sign(privateKey);

async function run(database: RawDatabase, sql: string): Promise<void> {
  const result = await database.prepare(sql).run();
  if (result.success === false) throw new Error("D1_BUDGET_SEED_FAILED");
}

async function seedBase(database: RawDatabase): Promise<void> {
  const migrationResults = await database.batch(
    unstable_splitSqlQuery(migration).map((sql) => database.prepare(sql)),
  );
  if (migrationResults.some((result) => result.success === false)) {
    throw new Error("D1_BUDGET_MIGRATION_FAILED");
  }
  const emailKey = await deriveEmailKey(email, emailKeySecret);
  await database
    .prepare(
      `INSERT INTO app_meta
        (singleton, environment, database_id, initialized_at)
       VALUES (1, 'preview', 'budget-preview-database', ?)`,
    )
    .bind(now)
    .run();
  await database
    .prepare(
      `INSERT INTO sync_enrollments
        (email_key, enabled, created_at, updated_at)
       VALUES (?, 1, ?, ?)`,
    )
    .bind(emailKey, now, now)
    .run();
}

function apiEnv(database: D1DatabaseLike): CloudDataApiEnv {
  return {
    DB: database,
    ACCESS_TEAM_DOMAIN: teamDomain,
    ACCESS_AUD: audience,
    DEPLOYMENT_ENV: "preview",
    APP_HOST_KIND: "suffix",
    APP_HOST_VALUE: ".conan-private.pages.dev",
    D1_DATABASE_ID: "budget-preview-database",
    EMAIL_KEY_SECRET: emailKeySecret,
  };
}

async function callApi(
  database: D1DatabaseLike,
  path: string,
  init: RequestInit = {},
  requestNow = now,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Cf-Access-Jwt-Assertion", accessToken);
  return handleCloudDataRequest(
    new Request(`${baseUrl}${path}`, { ...init, headers }),
    apiEnv(database),
    {
      verificationKey: publicKey,
      now: () => requestNow,
      createUserId: () => "budget-user",
      createLeaseToken: () => "budget-lease-token-000000000001",
    },
  );
}

async function warmUser(database: D1DatabaseLike): Promise<void> {
  const response = await callApi(database, "/api/v1/bootstrap");
  if (response.status !== 200) {
    throw new Error(`D1_BUDGET_WARMUP_FAILED_${response.status}`);
  }
}

async function seedDecks(database: RawDatabase, count: number): Promise<void> {
  if (count === 0) return;
  await database
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < ?
       )
       INSERT INTO decks
         (user_id, deck_id, name, partner_card_num, case_card_num, cards_json,
          revision, client_modified_at, server_updated_at)
       SELECT 'budget-user', printf('deck-%03d', value), 'Deck', 'D08001',
              'D08026', '[{"cardNum":"D08005","count":40}]', 1, ?, ?
       FROM sequence`,
    )
    .bind(count, now - 1_000, now - 1_000)
    .run();
}

async function seedTombstones(
  database: RawDatabase,
  count: number,
): Promise<void> {
  if (count === 0) return;
  await database
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < ?
       )
       INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       SELECT 'budget-user', printf('deleted-%03d', value), ? FROM sequence`,
    )
    .bind(count, now - 1_000)
    .run();
}

async function seedMatches(
  database: RawDatabase,
  userId: string,
  count: number,
  expired: boolean,
): Promise<void> {
  if (count === 0) return;
  const playedAt = expired ? now - MATCH_RETENTION_MS - 1 : now - 1_000;
  await database
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < ?
       )
       INSERT INTO matches
         (user_id, match_id, played_at, expires_at, first_ingested_at,
          deck_id, deck_revision, deck_name_snapshot,
          cpu_requested_difficulty, cpu_effective_difficulty,
          cpu_policy_version, outcome, turn_count, app_version, request_hash)
       SELECT ?, printf('seed-match-%04d', value), ?, ?, ?, 'deck-seed', 1,
              'Seed Deck', 'normal', 'normal', 'budget-policy-v1',
              CASE WHEN value % 2 = 0 THEN 'win' ELSE 'loss' END,
              8, '1.0.0+budget', printf('hash-%04d', value)
       FROM sequence`,
    )
    .bind(
      count,
      userId,
      playedAt,
      playedAt + MATCH_RETENTION_MS,
      playedAt,
    )
    .run();
}

async function seedCleanupPressure(database: RawDatabase): Promise<void> {
  await seedMatches(database, "budget-user", CLOUD_DATA_LIMITS.matches, true);
  await run(
    database,
    `INSERT INTO users
      (id, email_key, email, access_sub, status, created_at, last_seen_at)
     VALUES ('cleanup-match-user', 'cleanup-match-key', 'cleanup@example.com',
             'cleanup-sub', 'active', ${now}, ${now})`,
  );
  await seedMatches(database, "cleanup-match-user", 20, true);
  await database
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < 20
       )
       INSERT INTO idempotency_keys
         (user_id, idempotency_key, operation, request_hash, response_status,
          response_json, created_at, expires_at)
       SELECT 'budget-user', printf('expired-idem-%04d', value), 'deck.put',
              printf('%064d', value), 200, '{}', ?, ? FROM sequence`,
    )
    .bind(now - 2_000, now - 1_000)
    .run();
  await database
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < 20
       )
       INSERT INTO users
         (id, email_key, email, access_sub, status, created_at, last_seen_at)
       SELECT printf('cleanup-user-%02d', value), printf('cleanup-key-%02d', value),
              printf('cleanup-%02d@example.com', value),
              printf('cleanup-sub-%02d', value), 'active', ?, ? FROM sequence`,
    )
    .bind(now, now)
    .run();
  await database
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < 20
       )
       INSERT INTO deletion_challenges
         (user_id, token_hash, created_at, expires_at)
       SELECT printf('cleanup-user-%02d', value), printf('token-%02d', value),
              ?, ? FROM sequence`,
    )
    .bind(now - 2_000, now - 1_000)
    .run();
  await database
    .prepare(
      `WITH RECURSIVE sequence(value) AS (
         SELECT 1 UNION ALL SELECT value + 1 FROM sequence WHERE value < 100
       )
       INSERT INTO rate_limit_buckets
         (user_id, route_class, bucket_start, request_count,
          minute_start, minute_count)
       SELECT 'budget-user', 'match', ? - ((value + 2) * ?), 1, 0, 1
       FROM sequence`,
    )
    .bind(currentDay, dayMs)
    .run();
}

function jsonInit(
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  idempotencyKey: string,
): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
      Origin: baseUrl,
    },
    body: JSON.stringify(body),
  };
}

const deckBody = {
  deckId: "budget-new-deck",
  name: "Budget Deck",
  partnerCardNum: "D08001",
  caseCardNum: "D08026",
  cards: [{ cardNum: "D08005", count: 40 }],
  clientModifiedAt: now - 1_000,
  expectedRevision: null,
};

const matchBody = {
  matchId: "budget-new-match",
  playedAt: now - 5_000,
  deckId: "deck-seed",
  deckRevision: 1,
  deckName: "Seed Deck",
  cpuRequestedDifficulty: "normal",
  cpuEffectiveDifficulty: "normal",
  cpuPolicyVersion: "budget-policy-v1",
  outcome: "win",
  turnCount: 8,
  appVersion: "1.0.0+budget",
};

async function measure(
  scenario: string,
  options: {
    warm?: boolean;
    seed?: (database: RawDatabase) => Promise<void>;
    request: (database: D1DatabaseLike) => Promise<Response>;
  },
): Promise<Measurement> {
  const miniflare = new Miniflare({
    modules: true,
    script: "",
    d1Databases: { DB: `conan-cloud-budget-${scenario}` },
  });
  try {
    const raw = (await miniflare.getD1Database("DB")) as unknown as RawDatabase;
    await seedBase(raw);
    const meter = new D1Meter();
    const database = new MeteredDatabase(raw, meter);
    if (options.warm !== false) await warmUser(database);
    await options.seed?.(raw);
    meter.reset();
    const response = await options.request(database);
    return {
      scenario,
      status: response.status,
      queries: meter.queries,
      rowsRead: meter.rowsRead,
      rowsWritten: meter.rowsWritten,
      databaseBytes: meter.databaseBytes,
    };
  } finally {
    await miniflare.dispose();
  }
}

const measurements = [
  await measure("first-bootstrap", {
    warm: false,
    request: (database) => callApi(database, "/api/v1/bootstrap"),
  }),
  await measure("saturated-bootstrap", {
    seed: async (database) => {
      await seedDecks(database, 100);
      await seedTombstones(database, 500);
      await seedMatches(
        database,
        "budget-user",
        CLOUD_DATA_LIMITS.matches,
        false,
      );
    },
    request: (database) => callApi(database, "/api/v1/bootstrap"),
  }),
  await measure("deck-create", {
    request: (database) =>
      callApi(
        database,
        "/api/v1/decks/budget-new-deck",
        jsonInit("PUT", deckBody, "budget-idem-deck-create-0001"),
      ),
  }),
  await measure("deck-update", {
    seed: (database) => seedDecks(database, 1),
    request: (database) =>
      callApi(
        database,
        "/api/v1/decks/deck-001",
        jsonInit(
          "PUT",
          {
            ...deckBody,
            deckId: "deck-001",
            name: "Updated Budget Deck",
            expectedRevision: 1,
          },
          "budget-idem-deck-update-0001",
        ),
      ),
  }),
  await measure("deck-delete", {
    seed: async (database) => {
      await seedDecks(database, 1);
      await seedTombstones(database, 499);
    },
    request: (database) =>
      callApi(
        database,
        "/api/v1/decks/deck-001",
        jsonInit(
          "DELETE",
          { expectedRevision: 1 },
          "budget-idem-deck-delete-0001",
        ),
      ),
  }),
  await measure("active-deck", {
    seed: (database) => seedDecks(database, 1),
    request: (database) =>
      callApi(
        database,
        "/api/v1/active-deck",
        jsonInit(
          "PUT",
          { activeDeckId: "deck-001", expectedRevision: null },
          "budget-idem-active-deck-0001",
        ),
      ),
  }),
  await measure("match-near-cap", {
    seed: (database) =>
      seedMatches(database, "budget-user", CLOUD_DATA_LIMITS.matches - 1, false),
    request: (database) =>
      callApi(
        database,
        "/api/v1/matches",
        jsonInit("POST", matchBody, "budget-idem-match-near-cap-0001"),
      ),
  }),
  await measure("match-day-max-cleanup", {
    seed: seedCleanupPressure,
    request: async (database) => {
      let response = new Response(null, { status: 500 });
      for (let index = 0; index < DAILY_RATE_LIMITS.match; index += 1) {
        response = await callApi(
          database,
          "/api/v1/matches",
          jsonInit(
            "POST",
            { ...matchBody, matchId: `budget-cleanup-match-${index}` },
            `budget-idem-match-cleanup-${String(index).padStart(4, "0")}`,
          ),
          now + index * 60_000,
        );
        if (response.status >= 400) return response;
      }
      return response;
    },
  }),
];

if (measurements.some((measurement) => measurement.status >= 400)) {
  throw new Error(
    `D1_BUDGET_ROUTE_FAILED ${JSON.stringify(measurements, null, 2)}`,
  );
}

const envelopeByScenario = {
  "first-bootstrap": SYNC_QUOTA_PROOF.routeEnvelope.firstBootstrap,
  "saturated-bootstrap": SYNC_QUOTA_PROOF.routeEnvelope.read,
  "deck-create": SYNC_QUOTA_PROOF.routeEnvelope.write,
  "deck-update": SYNC_QUOTA_PROOF.routeEnvelope.write,
  "deck-delete": SYNC_QUOTA_PROOF.routeEnvelope.write,
  "active-deck": SYNC_QUOTA_PROOF.routeEnvelope.write,
  "match-near-cap": SYNC_QUOTA_PROOF.routeEnvelope.match,
  "match-day-max-cleanup":
    SYNC_QUOTA_PROOF.routeEnvelope.matchDayWithMaxCleanup,
} as const;
for (const measurement of measurements) {
  const envelope =
    envelopeByScenario[measurement.scenario as keyof typeof envelopeByScenario];
  if (
    !envelope ||
    measurement.rowsRead > envelope.rowsRead ||
    measurement.rowsWritten > envelope.rowsWritten
  ) {
    throw new Error(
      `D1_BUDGET_ENVELOPE_EXCEEDED ${JSON.stringify(measurement)}`,
    );
  }
}

const modeledDailyUsage = estimateWorstCaseDailySyncUsage();
const safety = SYNC_QUOTA_PROOF.safetyFactor;
if (
  modeledDailyUsage.workersRequests * safety >
    FREE_TIER_LIMITS.workersRequests * 0.25 ||
  modeledDailyUsage.d1RowsRead * safety >
    FREE_TIER_LIMITS.d1RowsRead * 0.25 ||
  modeledDailyUsage.d1RowsWritten * safety >
    FREE_TIER_LIMITS.d1RowsWritten * 0.25 ||
  PERSONAL_SYNC_STORAGE_BUDGET_BYTES * safety >
    FREE_TIER_LIMITS.d1DatabaseBytes * 0.25
) {
  throw new Error("D1_BUDGET_HEADROOM_EXCEEDED");
}

process.stdout.write(
  `${JSON.stringify({ measurements, modeledDailyUsage, safetyFactor: safety }, null, 2)}\n`,
);
