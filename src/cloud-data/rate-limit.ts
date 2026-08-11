import type { D1DatabaseLike } from "./d1-types";

export const RATE_LIMITS = {
  read: 10,
  write: 5,
  match: 5,
} as const;

export const DAILY_RATE_LIMITS = {
  read: 25,
  write: 10,
  match: 8,
} as const;

export type RateLimitClass = keyof typeof RATE_LIMITS;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

type RateLimitRow = {
  request_count: number;
  minute_start: number;
  minute_count: number;
};

const BUCKET_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;

async function findBucket(
  database: D1DatabaseLike,
  userId: string,
  routeClass: RateLimitClass,
  dayStart: number,
): Promise<RateLimitRow | null> {
  return database
    .prepare(
      `SELECT request_count, minute_start, minute_count
       FROM rate_limit_buckets
       WHERE user_id = ? AND route_class = ? AND bucket_start = ?
       LIMIT 1`,
    )
    .bind(userId, routeClass, dayStart)
    .first<RateLimitRow>();
}

export async function consumeRateLimit(
  database: D1DatabaseLike,
  userId: string,
  routeClass: RateLimitClass,
  now: number,
): Promise<RateLimitResult> {
  if (!RESOURCE_ID.test(userId)) throw new Error("USER_ID_INVALID");
  if (!Object.hasOwn(RATE_LIMITS, routeClass)) {
    throw new Error("RATE_LIMIT_CLASS_INVALID");
  }
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error("REQUEST_TIME_INVALID");
  }

  const dailyLimit = DAILY_RATE_LIMITS[routeClass];
  const dayStart = Math.floor(now / DAY_MS) * DAY_MS;
  const minuteStart = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  const limit = RATE_LIMITS[routeClass];
  const row = await database
    .prepare(
      `INSERT INTO rate_limit_buckets
        (user_id, route_class, bucket_start, request_count,
         minute_start, minute_count)
       VALUES (?, ?, ?, 1, ?, 1)
       ON CONFLICT (user_id, route_class, bucket_start)
       DO UPDATE SET
         request_count = request_count + 1,
         minute_start = excluded.minute_start,
         minute_count = CASE
           WHEN minute_start = excluded.minute_start THEN minute_count + 1
           ELSE 1
         END
       WHERE request_count < ?
         AND (minute_start != excluded.minute_start OR minute_count < ?)
       RETURNING request_count, minute_start, minute_count`,
    )
    .bind(userId, routeClass, dayStart, minuteStart, dailyLimit, limit)
    .first<RateLimitRow>();
  if (!row) {
    const current = await findBucket(database, userId, routeClass, dayStart);
    if (!current) throw new Error("RATE_LIMIT_WRITE_FAILED");
    const dailyExceeded = current.request_count >= dailyLimit;
    return {
      allowed: false,
      limit: dailyExceeded ? dailyLimit : limit,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          ((dailyExceeded ? dayStart + DAY_MS : minuteStart + BUCKET_MS) -
            now) /
            1_000,
        ),
      ),
    };
  }
  if (
    !Number.isSafeInteger(row.request_count) ||
    !Number.isSafeInteger(row.minute_start) ||
    !Number.isSafeInteger(row.minute_count)
  ) {
    throw new Error("RATE_LIMIT_WRITE_FAILED");
  }

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - row.minute_count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((minuteStart + BUCKET_MS - now) / 1_000),
    ),
  };
}
