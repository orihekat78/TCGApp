// @vitest-environment node

import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  handleCloudDataRequest,
  type CloudDataApiEnv,
} from "../../src/cloud-data/api";
import { deriveEmailKey } from "../../src/cloud-data/identity";
import { RATE_LIMITS } from "../../src/cloud-data/rate-limit";
import { SqliteD1Database } from "./d1-test-adapter";

const migration = readFileSync("migrations/0001_cloud_data.sql", "utf8");
const baseUrl = "https://preview.conan-private.pages.dev";
const teamDomain = "https://family-team.cloudflareaccess.com";
const audience = "preview-audience";
const emailKeySecret = "preview-only-secret-with-at-least-32-bytes";
const now = 1_800_000_000_000;

let publicKey: CryptoKey;
let privateKey: CryptoKey;
let sqlite: DatabaseSync;
let env: CloudDataApiEnv;
let userSequence: number;

beforeAll(async () => {
  ({ publicKey, privateKey } = await generateKeyPair("RS256"));
});

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  sqlite
    .prepare(
      `INSERT INTO app_meta
        (singleton, environment, database_id, initialized_at)
       VALUES (1, 'production', 'production-database', ?)`,
    )
    .run(now);
  env = {
    DB: new SqliteD1Database(sqlite),
    ACCESS_TEAM_DOMAIN: teamDomain,
    ACCESS_AUD: audience,
    DEPLOYMENT_ENV: "production",
    APP_HOST_KIND: "suffix",
    APP_HOST_VALUE: ".conan-private.pages.dev",
    D1_DATABASE_ID: "production-database",
    EMAIL_KEY_SECRET: emailKeySecret,
  };
  userSequence = 0;
});

afterEach(() => sqlite.close());

async function token(
  email = "one@example.com",
  subject = "access-sub-one",
): Promise<string> {
  return new SignJWT({ email, type: "app" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(teamDomain)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
}

async function enroll(email: string): Promise<void> {
  const emailKey = await deriveEmailKey(email, emailKeySecret);
  sqlite
    .prepare(
      `INSERT INTO sync_enrollments
        (email_key, enabled, created_at, updated_at)
       VALUES (?, 1, ?, ?)`,
    )
    .run(emailKey, now, now);
}

async function call(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Cf-Access-Jwt-Assertion", accessToken);
  return handleCloudDataRequest(
    new Request(`${baseUrl}${path}`, { ...init, headers }),
    env,
    {
      verificationKey: publicKey,
      now: () => now,
      createUserId: () => `user-${++userSequence}`,
      createLeaseToken: () => `lease-token-${crypto.randomUUID()}`,
    },
  );
}

async function jsonCall(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body: unknown,
  idempotencyKey: string,
  accessToken: string,
  origin = baseUrl,
): Promise<Response> {
  return call(
    path,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        Origin: origin,
      },
      body: JSON.stringify(body),
    },
    accessToken,
  );
}

function deckBody(overrides: Record<string, unknown> = {}) {
  return {
    deckId: "deck-one",
    name: "Blue Deck",
    partnerCardNum: "D08001",
    caseCardNum: "D08026",
    cards: [
      { cardNum: "D08005", count: 37 },
      { cardNum: "D08006", count: 3 },
    ],
    clientModifiedAt: now - 1_000,
    expectedRevision: null,
    ...overrides,
  };
}

describe("cloud data HTTP API", () => {
  it("rejects missing and invalid Access assertions before touching D1", async () => {
    const missing = await call("/api/v1/bootstrap");
    const invalid = await call(
      "/api/v1/bootstrap",
      {},
      "not-a-valid-access-token",
    );

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
    expect(await invalid.text()).not.toContain("not-a-valid-access-token");
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual(
      {
        count: 0,
      },
    );
  });

  it("returns verified identity and owner-only bootstrap data", async () => {
    await enroll("one@example.com");
    const accessToken = await token();
    const response = await call("/api/v1/bootstrap", {}, accessToken);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        identity: { email: "one@example.com" },
        decks: [],
        deletedDecks: [],
        activeDeck: null,
        stats: { matches: 0, wins: 0, losses: 0, winRate: null },
      },
    });
  });

  it("rejects cross-origin writes and client-supplied identity fields", async () => {
    await enroll("one@example.com");
    const accessToken = await token();
    const crossOrigin = await jsonCall(
      "/api/v1/decks/deck-one",
      "PUT",
      deckBody(),
      "idempotency-deck-0001",
      accessToken,
      "https://evil.example",
    );
    const identitySpoof = await jsonCall(
      "/api/v1/decks/deck-one",
      "PUT",
      deckBody({ email: "attacker@example.com" }),
      "idempotency-deck-0002",
      accessToken,
    );

    expect(crossOrigin.status).toBe(403);
    expect(identitySpoof.status).toBe(400);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM decks").get()).toEqual(
      {
        count: 0,
      },
    );
  });

  it("stores a deck once and rejects idempotency-key payload reuse", async () => {
    await enroll("one@example.com");
    const accessToken = await token();
    const first = await jsonCall(
      "/api/v1/decks/deck-one",
      "PUT",
      deckBody(),
      "idempotency-deck-0001",
      accessToken,
    );
    const replay = await jsonCall(
      "/api/v1/decks/deck-one",
      "PUT",
      deckBody(),
      "idempotency-deck-0001",
      accessToken,
    );
    const changed = await jsonCall(
      "/api/v1/decks/deck-one",
      "PUT",
      deckBody({ name: "Changed" }),
      "idempotency-deck-0001",
      accessToken,
    );

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect(changed.status).toBe(409);
    expect(sqlite.prepare("SELECT revision FROM decks").get()).toEqual({
      revision: 1,
    });
  });

  it("rejects route/body ID mismatch and hides another owner's deck", async () => {
    await enroll("one@example.com");
    await enroll("two@example.com");
    const oneToken = await token();
    const twoToken = await token("two@example.com", "access-sub-two");
    const mismatch = await jsonCall(
      "/api/v1/decks/deck-two",
      "PUT",
      deckBody(),
      "idempotency-deck-0003",
      oneToken,
    );
    await jsonCall(
      "/api/v1/decks/deck-one",
      "PUT",
      deckBody(),
      "idempotency-deck-0004",
      oneToken,
    );
    const otherOwnerDelete = await jsonCall(
      "/api/v1/decks/deck-one",
      "DELETE",
      { expectedRevision: 1 },
      "idempotency-delete-0001",
      twoToken,
    );

    expect(mismatch.status).toBe(400);
    expect(otherOwnerDelete.status).toBe(404);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM decks").get()).toEqual(
      {
        count: 1,
      },
    );
  });

  it("stores match results idempotently and detects changed match replay", async () => {
    await enroll("one@example.com");
    const accessToken = await token();
    const body = {
      matchId: "match-one",
      playedAt: now - 5_000,
      deckId: "deck-one",
      deckRevision: 1,
      deckName: "Blue Deck",
      cpuRequestedDifficulty: "normal",
      cpuEffectiveDifficulty: "normal",
      cpuPolicyVersion: "meta-cpu-v1",
      outcome: "win",
      turnCount: 8,
      appVersion: "1.0.0+test",
    };
    const first = await jsonCall(
      "/api/v1/matches",
      "POST",
      body,
      "idempotency-match-0001",
      accessToken,
    );
    const changed = await jsonCall(
      "/api/v1/matches",
      "POST",
      { ...body, outcome: "loss" },
      "idempotency-match-0002",
      accessToken,
    );

    expect(first.status).toBe(201);
    expect(changed.status).toBe(409);
    expect(
      sqlite.prepare("SELECT COUNT(*) AS count FROM matches").get(),
    ).toEqual({
      count: 1,
    });
  });

  it("fails closed without deleting a deck when the tombstone budget is full", async () => {
    await enroll("one@example.com");
    const accessToken = await token();
    const created = await jsonCall(
      "/api/v1/decks/deck-one",
      "PUT",
      deckBody(),
      "idempotency-deck-tombstone-limit",
      accessToken,
    );
    expect(created.status).toBe(201);

    const insertTombstone = sqlite.prepare(
      `INSERT INTO deck_tombstones (user_id, deck_id, deleted_at)
       VALUES ('user-1', ?, ?)`,
    );
    for (let index = 0; index < 500; index += 1) {
      insertTombstone.run(`old-deck-${index}`, now - index);
    }

    const response = await jsonCall(
      "/api/v1/decks/deck-one",
      "DELETE",
      { expectedRevision: 1 },
      "idempotency-delete-tombstone-limit",
      accessToken,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: "CONFLICT" },
    });
    expect(
      sqlite
        .prepare(
          "SELECT COUNT(*) AS count FROM decks WHERE deck_id = 'deck-one'",
        )
        .get(),
    ).toEqual({ count: 1 });
  });

  it("returns 429 before resource mutation when the owner bucket is exhausted", async () => {
    await enroll("one@example.com");
    const accessToken = await token();
    await call("/api/v1/bootstrap", {}, accessToken);
    sqlite
      .prepare(
        `UPDATE rate_limit_buckets
         SET request_count = ?, minute_count = ?
         WHERE route_class = 'read'`,
      )
      .run(RATE_LIMITS.read, RATE_LIMITS.read);

    const response = await call("/api/v1/bootstrap", {}, accessToken);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("fails closed on a mismatched D1 sentinel", async () => {
    await enroll("one@example.com");
    env = { ...env, D1_DATABASE_ID: "different-database" };

    const response = await call("/api/v1/bootstrap", {}, await token());
    expect(response.status).toBe(503);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM users").get()).toEqual(
      {
        count: 0,
      },
    );
  });
});
