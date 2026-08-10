import { base64url } from "jose";
import type { D1DatabaseLike } from "./d1-types";
import { normalizeVerifiedEmail } from "./request-context";

export type VerifiedIdentity = {
  accessSub: string;
  email: string;
};

export type CloudUser = VerifiedIdentity & {
  id: string;
  emailKey: string;
};

export type ResolveCloudUserOptions = {
  emailKeySecret: string;
  now: number;
  createUserId?: () => string;
};

type UserRow = {
  id: string;
  email_key: string;
  email: string | null;
  access_sub: string | null;
  status: "active" | "deleted";
};

type EnrollmentRow = { enabled: number };

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const LAST_SEEN_WRITE_INTERVAL_MS = 24 * 60 * 60 * 1_000;

export async function deriveEmailKey(
  email: string,
  secret: string,
): Promise<string> {
  const secretBytes = new TextEncoder().encode(secret);
  if (secretBytes.byteLength < 32 || secretBytes.byteLength > 1_024) {
    throw new Error("EMAIL_KEY_SECRET_INVALID");
  }
  const normalizedEmail = normalizeVerifiedEmail(email);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(normalizedEmail),
  );
  return `v1_${base64url.encode(new Uint8Array(digest))}`;
}

async function findByAccessSub(
  database: D1DatabaseLike,
  accessSub: string,
): Promise<UserRow | null> {
  return database
    .prepare(
      `SELECT id, email_key, email, access_sub, status
       FROM users
       WHERE access_sub = ?
       LIMIT 1`,
    )
    .bind(accessSub)
    .first<UserRow>();
}

async function findByEmailKey(
  database: D1DatabaseLike,
  emailKey: string,
): Promise<UserRow | null> {
  return database
    .prepare(
      `SELECT id, email_key, email, access_sub, status
       FROM users
       WHERE email_key = ?
       LIMIT 1`,
    )
    .bind(emailKey)
    .first<UserRow>();
}

async function requireEnrollment(
  database: D1DatabaseLike,
  emailKey: string,
): Promise<void> {
  const enrollment = await database
    .prepare(
      `SELECT enabled
       FROM sync_enrollments
       WHERE email_key = ?
       LIMIT 1`,
    )
    .bind(emailKey)
    .first<EnrollmentRow>();
  if (enrollment?.enabled !== 1) throw new Error("SYNC_NOT_ENROLLED");
}

function selectMatchingUser(
  byAccessSub: UserRow | null,
  byEmailKey: UserRow | null,
  identity: VerifiedIdentity,
  emailKey: string,
): UserRow | null {
  if (byAccessSub?.status === "deleted" || byEmailKey?.status === "deleted") {
    throw new Error("ACCOUNT_DELETED");
  }
  if (byAccessSub && byAccessSub.email_key !== emailKey) {
    throw new Error("IDENTITY_CONFLICT");
  }
  if (byEmailKey && byEmailKey.access_sub !== identity.accessSub) {
    throw new Error("IDENTITY_RELINK_REQUIRED");
  }
  if (byAccessSub && byEmailKey && byAccessSub.id !== byEmailKey.id) {
    throw new Error("IDENTITY_CONFLICT");
  }

  const user = byAccessSub ?? byEmailKey;
  if (!user) return null;
  if (
    user.status !== "active" ||
    user.email !== identity.email ||
    user.access_sub !== identity.accessSub
  ) {
    throw new Error("IDENTITY_CONFLICT");
  }
  return user;
}

async function findMatchingUser(
  database: D1DatabaseLike,
  identity: VerifiedIdentity,
  emailKey: string,
): Promise<UserRow | null> {
  const [byAccessSub, byEmailKey] = await Promise.all([
    findByAccessSub(database, identity.accessSub),
    findByEmailKey(database, emailKey),
  ]);
  return selectMatchingUser(byAccessSub, byEmailKey, identity, emailKey);
}

function defaultUserId(): string {
  return `usr_${crypto.randomUUID()}`;
}

export async function resolveCloudUser(
  database: D1DatabaseLike,
  rawIdentity: VerifiedIdentity,
  options: ResolveCloudUserOptions,
): Promise<CloudUser> {
  const accessSub = rawIdentity.accessSub.trim();
  if (accessSub.length === 0 || accessSub.length > 256) {
    throw new Error("IDENTITY_INVALID");
  }
  if (!Number.isSafeInteger(options.now) || options.now < 0) {
    throw new Error("REQUEST_TIME_INVALID");
  }
  const identity = {
    accessSub,
    email: normalizeVerifiedEmail(rawIdentity.email),
  };
  const emailKey = await deriveEmailKey(identity.email, options.emailKeySecret);

  let user = await findMatchingUser(database, identity, emailKey);
  if (!user) {
    await requireEnrollment(database, emailKey);
    const userId = (options.createUserId ?? defaultUserId)();
    if (!USER_ID.test(userId)) throw new Error("USER_ID_INVALID");

    try {
      await database
        .prepare(
          `INSERT INTO users
            (id, email_key, email, access_sub, status, created_at, last_seen_at)
           SELECT ?, ?, ?, ?, 'active', ?, ?
           WHERE EXISTS (
             SELECT 1 FROM sync_enrollments
             WHERE email_key = ? AND enabled = 1
           )`,
        )
        .bind(
          userId,
          emailKey,
          identity.email,
          identity.accessSub,
          options.now,
          options.now,
          emailKey,
        )
        .run();
    } catch {
      // A concurrent first request can win the insert. Re-read and validate it.
    }
    user = await findMatchingUser(database, identity, emailKey);
    if (!user) {
      await requireEnrollment(database, emailKey);
      throw new Error("IDENTITY_CREATE_FAILED");
    }
  }

  await requireEnrollment(database, emailKey);
  await database
    .prepare(
      `UPDATE users
       SET last_seen_at = ?
       WHERE id = ? AND status = 'active' AND last_seen_at <= ?`,
    )
    .bind(options.now, user.id, options.now - LAST_SEEN_WRITE_INTERVAL_MS)
    .run();

  return {
    id: user.id,
    accessSub: identity.accessSub,
    email: identity.email,
    emailKey,
  };
}
