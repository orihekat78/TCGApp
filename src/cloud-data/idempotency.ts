import type { D1DatabaseLike } from "./d1-types";

const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{16,128}$/;
const OPERATION = /^[a-z0-9.:-]{1,80}$/;
const REQUEST_HASH = /^[a-f0-9]{64}$/;
const LEASE_MS = 30_000;
const RECORD_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_RESPONSE_BYTES = 65_536;

type IdempotencyRow = {
  operation: string;
  request_hash: string;
  state: "pending" | "complete";
  lease_expires_at: number;
  response_status: number;
  response_json: string;
  expires_at: number;
};

export type IdempotencyExecuteClaim = {
  kind: "execute";
  leaseToken: string;
};

export type IdempotencyClaim =
  | IdempotencyExecuteClaim
  | { kind: "pending"; retryAfterSeconds: number }
  | { kind: "replay"; status: number; body: unknown };

export type ClaimIdempotencyOptions = {
  userId: string;
  key: string;
  operation: string;
  requestHash: string;
  now: number;
  leaseToken: string;
};

function validateClaim(options: ClaimIdempotencyOptions): void {
  if (!RESOURCE_ID.test(options.userId)) throw new Error("USER_ID_INVALID");
  if (!IDEMPOTENCY_KEY.test(options.key)) {
    throw new Error("IDEMPOTENCY_KEY_INVALID");
  }
  if (!OPERATION.test(options.operation)) {
    throw new Error("IDEMPOTENCY_OPERATION_INVALID");
  }
  if (!REQUEST_HASH.test(options.requestHash)) {
    throw new Error("IDEMPOTENCY_HASH_INVALID");
  }
  if (!Number.isSafeInteger(options.now) || options.now < 0) {
    throw new Error("REQUEST_TIME_INVALID");
  }
  if (!IDEMPOTENCY_KEY.test(options.leaseToken)) {
    throw new Error("IDEMPOTENCY_LEASE_INVALID");
  }
}

async function findRecord(
  database: D1DatabaseLike,
  userId: string,
  key: string,
): Promise<IdempotencyRow | null> {
  return database
    .prepare(
      `SELECT operation, request_hash, state, lease_expires_at,
              response_status, response_json, expires_at
       FROM idempotency_keys
       WHERE user_id = ? AND idempotency_key = ?
       LIMIT 1`,
    )
    .bind(userId, key)
    .first<IdempotencyRow>();
}

function replayFrom(row: IdempotencyRow): IdempotencyClaim {
  let body: unknown;
  try {
    body = JSON.parse(row.response_json);
  } catch (error) {
    throw new Error("IDEMPOTENCY_STORAGE_INVALID", { cause: error });
  }
  return { kind: "replay", status: row.response_status, body };
}

function pendingFrom(row: IdempotencyRow, now: number): IdempotencyClaim {
  return {
    kind: "pending",
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((row.lease_expires_at - now) / 1_000),
    ),
  };
}

export async function claimIdempotencyKey(
  database: D1DatabaseLike,
  options: ClaimIdempotencyOptions,
): Promise<IdempotencyClaim> {
  validateClaim(options);
  let existing = await findRecord(database, options.userId, options.key);
  if (existing && existing.expires_at <= options.now) {
    await database
      .prepare(
        `DELETE FROM idempotency_keys
         WHERE user_id = ? AND idempotency_key = ? AND expires_at <= ?`,
      )
      .bind(options.userId, options.key, options.now)
      .run();
    existing = await findRecord(database, options.userId, options.key);
  }

  if (!existing) {
    const result = await database
      .prepare(
        `INSERT INTO idempotency_keys
          (user_id, idempotency_key, operation, request_hash, state,
           lease_token, lease_expires_at, response_status, response_json,
           created_at, expires_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, 0, 'null', ?, ?)
         ON CONFLICT (user_id, idempotency_key) DO NOTHING`,
      )
      .bind(
        options.userId,
        options.key,
        options.operation,
        options.requestHash,
        options.leaseToken,
        options.now + LEASE_MS,
        options.now,
        options.now + RECORD_TTL_MS,
      )
      .run();
    if (result.meta?.changes === 1) {
      return { kind: "execute", leaseToken: options.leaseToken };
    }
    existing = await findRecord(database, options.userId, options.key);
  }

  if (!existing) throw new Error("IDEMPOTENCY_CLAIM_FAILED");
  if (
    existing.operation !== options.operation ||
    existing.request_hash !== options.requestHash
  ) {
    throw new Error("IDEMPOTENCY_KEY_REUSED");
  }
  if (existing.state === "complete") return replayFrom(existing);
  if (existing.lease_expires_at > options.now) {
    return pendingFrom(existing, options.now);
  }

  const takeover = await database
    .prepare(
      `UPDATE idempotency_keys
       SET lease_token = ?, lease_expires_at = ?
       WHERE user_id = ? AND idempotency_key = ?
         AND state = 'pending' AND lease_expires_at <= ? AND expires_at > ?`,
    )
    .bind(
      options.leaseToken,
      options.now + LEASE_MS,
      options.userId,
      options.key,
      options.now,
      options.now,
    )
    .run();
  if (takeover.meta?.changes === 1) {
    return { kind: "execute", leaseToken: options.leaseToken };
  }

  const raced = await findRecord(database, options.userId, options.key);
  if (!raced) throw new Error("IDEMPOTENCY_CLAIM_FAILED");
  if (raced.state === "complete") return replayFrom(raced);
  return pendingFrom(raced, options.now);
}

export async function completeIdempotencyKey(
  database: D1DatabaseLike,
  claim: IdempotencyExecuteClaim,
  result: {
    userId: string;
    key: string;
    status: number;
    body: unknown;
  },
): Promise<void> {
  if (!RESOURCE_ID.test(result.userId)) throw new Error("USER_ID_INVALID");
  if (!IDEMPOTENCY_KEY.test(result.key)) {
    throw new Error("IDEMPOTENCY_KEY_INVALID");
  }
  if (!Number.isSafeInteger(result.status) || result.status < 200 || result.status > 599) {
    throw new Error("IDEMPOTENCY_STATUS_INVALID");
  }
  const responseJson = JSON.stringify(result.body);
  if (new TextEncoder().encode(responseJson).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("IDEMPOTENCY_RESPONSE_TOO_LARGE");
  }

  const update = await database
    .prepare(
      `UPDATE idempotency_keys
       SET state = 'complete', response_status = ?, response_json = ?
       WHERE user_id = ? AND idempotency_key = ?
         AND state = 'pending' AND lease_token = ?`,
    )
    .bind(
      result.status,
      responseJson,
      result.userId,
      result.key,
      claim.leaseToken,
    )
    .run();
  if (update.meta?.changes === 1) return;

  const existing = await findRecord(database, result.userId, result.key);
  if (
    existing?.state === "complete" &&
    existing.response_status === result.status &&
    existing.response_json === responseJson
  ) {
    return;
  }
  throw new Error("IDEMPOTENCY_COMPLETE_FAILED");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("IDEMPOTENCY_INPUT_INVALID");
}

export async function createIdempotencyRequestHash(
  value: unknown,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
