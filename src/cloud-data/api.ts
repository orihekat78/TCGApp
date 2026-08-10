import {
  authenticateAccessRequest,
  normalizeAccessTeamDomain,
  type AccessVerificationKey,
} from "./access-auth";
import {
  validateDeckInput,
  validateMatchInput,
  type DeckInput,
  type MatchInput,
} from "./contracts";
import type { D1DatabaseLike } from "./d1-types";
import { resolveCloudUser } from "./identity";
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
  createIdempotencyRequestHash,
  type IdempotencyExecuteClaim,
} from "./idempotency";
import { consumeRateLimit, type RateLimitClass } from "./rate-limit";
import {
  parseDatabaseSentinelRow,
  selectDeploymentPolicy,
  validateDatabaseSentinel,
  type DeploymentEnvironment,
  type DeploymentPolicy,
} from "./request-context";
import {
  appendMatch,
  deleteDeck,
  loadBootstrap,
  putDeck,
  setActiveDeck,
} from "./repository";

const MAX_BODY_BYTES = 65_536;
const RESOURCE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export type CloudDataApiEnv = {
  DB: D1DatabaseLike;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  DEPLOYMENT_ENV: string;
  APP_HOST_KIND: string;
  APP_HOST_VALUE: string;
  D1_DATABASE_ID: string;
  EMAIL_KEY_SECRET: string;
};

export type CloudDataApiDependencies = {
  verificationKey?: AccessVerificationKey;
  now?: () => number;
  createUserId?: () => string;
  createLeaseToken?: () => string;
};

type ApiResult = { status: number; body: unknown };

class ApiProblem extends Error {
  constructor(
    readonly status: number,
    readonly publicCode: string,
    options?: ErrorOptions,
  ) {
    super(publicCode, options);
  }
}

function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function errorBody(code: string): { error: { code: string } } {
  return { error: { code } };
}

function problemResponse(problem: ApiProblem): Response {
  return jsonResponse(problem.status, errorBody(problem.publicCode));
}

function requiredEnv(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiProblem(503, "SERVICE_UNAVAILABLE");
  }
  return value.trim();
}

function parsePolicy(env: CloudDataApiEnv, hostname: string): DeploymentPolicy {
  if (!env.DB || typeof env.DB.prepare !== "function") {
    throw new ApiProblem(503, "SERVICE_UNAVAILABLE");
  }
  const environment = requiredEnv(env.DEPLOYMENT_ENV);
  if (environment !== "production" && environment !== "preview") {
    throw new ApiProblem(503, "SERVICE_UNAVAILABLE");
  }
  const hostKind = requiredEnv(env.APP_HOST_KIND);
  if (hostKind !== "exact" && hostKind !== "suffix") {
    throw new ApiProblem(503, "SERVICE_UNAVAILABLE");
  }
  const teamDomain = requiredEnv(env.ACCESS_TEAM_DOMAIN);
  try {
    normalizeAccessTeamDomain(teamDomain);
  } catch (error) {
    throw new ApiProblem(503, "SERVICE_UNAVAILABLE", { cause: error });
  }
  requiredEnv(env.EMAIL_KEY_SECRET);

  const policy: DeploymentPolicy = {
    environment: environment as DeploymentEnvironment,
    host: { kind: hostKind, value: requiredEnv(env.APP_HOST_VALUE) },
    audience: requiredEnv(env.ACCESS_AUD),
    databaseId: requiredEnv(env.D1_DATABASE_ID),
  };
  try {
    return selectDeploymentPolicy(hostname, [policy]);
  } catch (error) {
    if (error instanceof Error && error.message === "HOST_NOT_ALLOWED") {
      throw new ApiProblem(404, "NOT_FOUND", { cause: error });
    }
    throw new ApiProblem(503, "SERVICE_UNAVAILABLE", { cause: error });
  }
}

async function requireSentinel(
  database: D1DatabaseLike,
  policy: DeploymentPolicy,
): Promise<void> {
  const row = await database
    .prepare(
      `SELECT singleton, environment, database_id AS databaseId
       FROM app_meta
       WHERE singleton = 1
       LIMIT 1`,
    )
    .first<unknown>();
  validateDatabaseSentinel(policy, parseDatabaseSentinelRow(row));
}

function requireSameOrigin(request: Request, requestUrl: URL): void {
  const rawOrigin = request.headers.get("Origin")?.trim();
  if (!rawOrigin) throw new ApiProblem(403, "ORIGIN_REJECTED");
  try {
    const originUrl = new URL(rawOrigin);
    if (
      originUrl.origin !== rawOrigin ||
      originUrl.origin !== requestUrl.origin
    ) {
      throw new ApiProblem(403, "ORIGIN_REJECTED");
    }
  } catch (error) {
    if (error instanceof ApiProblem) throw error;
    throw new ApiProblem(403, "ORIGIN_REJECTED", { cause: error });
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const mediaType = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new ApiProblem(415, "JSON_REQUIRED");
  }
  const declaredLength = request.headers.get("Content-Length");
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new ApiProblem(400, "INVALID_REQUEST");
    }
    if (bytes > MAX_BODY_BYTES) {
      throw new ApiProblem(413, "REQUEST_TOO_LARGE");
    }
  }
  if (!request.body) throw new ApiProblem(400, "INVALID_REQUEST");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    total += chunk.value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ApiProblem(413, "REQUEST_TOO_LARGE");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new ApiProblem(400, "INVALID_JSON", { cause: error });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ApiProblem(400, "INVALID_JSON", { cause: error });
  }
}

function strictRecord(
  input: unknown,
  fields: readonly string[],
): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ApiProblem(400, "INVALID_REQUEST");
  }
  const record = input as Record<string, unknown>;
  if (
    Object.keys(record).length !== fields.length ||
    fields.some((field) => !Object.hasOwn(record, field))
  ) {
    throw new ApiProblem(400, "INVALID_REQUEST");
  }
  return record;
}

function parseDeleteInput(input: unknown): number {
  const record = strictRecord(input, ["expectedRevision"]);
  if (
    !Number.isSafeInteger(record.expectedRevision) ||
    (record.expectedRevision as number) < 1
  ) {
    throw new ApiProblem(400, "INVALID_REQUEST");
  }
  return record.expectedRevision as number;
}

function parseActiveDeckInput(input: unknown): {
  activeDeckId: string | null;
  expectedRevision: number | null;
} {
  const record = strictRecord(input, ["activeDeckId", "expectedRevision"]);
  if (
    record.activeDeckId !== null &&
    (typeof record.activeDeckId !== "string" ||
      !RESOURCE_ID.test(record.activeDeckId))
  ) {
    throw new ApiProblem(400, "INVALID_REQUEST");
  }
  if (
    record.expectedRevision !== null &&
    (!Number.isSafeInteger(record.expectedRevision) ||
      (record.expectedRevision as number) < 1)
  ) {
    throw new ApiProblem(400, "INVALID_REQUEST");
  }
  return {
    activeDeckId: record.activeDeckId as string | null,
    expectedRevision: record.expectedRevision as number | null,
  };
}

function mapDataError(error: unknown): ApiProblem {
  if (error instanceof ApiProblem) return error;
  const code = error instanceof Error ? error.message : "";
  if (code === "DECK_NOT_FOUND") {
    return new ApiProblem(404, "NOT_FOUND", { cause: error });
  }
  if (code === "IDEMPOTENCY_KEY_REUSED") {
    return new ApiProblem(409, "IDEMPOTENCY_CONFLICT", { cause: error });
  }
  if (
    code === "DECK_REVISION_CONFLICT" ||
    code === "DECK_TOMBSTONED" ||
    code === "DECK_LIMIT_REACHED" ||
    code === "TOMBSTONE_LIMIT_REACHED" ||
    code === "ACTIVE_DECK_REVISION_CONFLICT" ||
    code === "ACTIVE_DECK_INVALID" ||
    code === "MATCH_ID_CONFLICT" ||
    code === "MATCH_LIMIT_REACHED"
  ) {
    return new ApiProblem(409, "CONFLICT", { cause: error });
  }
  if (
    code.startsWith("DECK_") ||
    code.startsWith("MATCH_") ||
    code.startsWith("ACTIVE_DECK_") ||
    code.startsWith("IDEMPOTENCY_")
  ) {
    return new ApiProblem(400, "INVALID_REQUEST", { cause: error });
  }
  return new ApiProblem(503, "SERVICE_UNAVAILABLE", { cause: error });
}

async function executeIdempotently(
  request: Request,
  database: D1DatabaseLike,
  userId: string,
  operation: string,
  hashInput: unknown,
  now: number,
  createLeaseToken: () => string,
  execute: () => Promise<ApiResult>,
): Promise<Response> {
  const key = request.headers.get("Idempotency-Key")?.trim() ?? "";
  const requestHash = await createIdempotencyRequestHash(hashInput);
  const claim = await claimIdempotencyKey(database, {
    userId,
    key,
    operation,
    requestHash,
    now,
    leaseToken: createLeaseToken(),
  });
  if (claim.kind === "replay") {
    return jsonResponse(claim.status, claim.body);
  }
  if (claim.kind === "pending") {
    return jsonResponse(409, errorBody("REQUEST_IN_PROGRESS"), {
      "Retry-After": String(claim.retryAfterSeconds),
    });
  }

  let result: ApiResult;
  try {
    result = await execute();
  } catch (error) {
    const problem = mapDataError(error);
    if (problem.status >= 500) throw problem;
    result = { status: problem.status, body: errorBody(problem.publicCode) };
  }
  await completeIdempotencyKey(database, claim as IdempotencyExecuteClaim, {
    userId,
    key,
    status: result.status,
    body: result.body,
  });
  return jsonResponse(result.status, result.body);
}

function routeClass(request: Request, pathname: string): RateLimitClass {
  if (request.method === "POST" && pathname === "/api/v1/matches") {
    return "match";
  }
  return request.method === "GET" ? "read" : "write";
}

function decodeDeckId(pathname: string): string | null {
  const match = /^\/api\/v1\/decks\/([^/]+)$/.exec(pathname);
  if (!match) return null;
  try {
    const deckId = decodeURIComponent(match[1]);
    if (!RESOURCE_ID.test(deckId)) throw new ApiProblem(400, "INVALID_REQUEST");
    return deckId;
  } catch (error) {
    if (error instanceof ApiProblem) throw error;
    throw new ApiProblem(400, "INVALID_REQUEST", { cause: error });
  }
}

async function routeAuthenticatedRequest(
  request: Request,
  requestUrl: URL,
  env: CloudDataApiEnv,
  user: { id: string; email: string },
  now: number,
  createLeaseToken: () => string,
): Promise<Response> {
  const pathname = requestUrl.pathname;
  if (request.method !== "GET") requireSameOrigin(request, requestUrl);

  const rateLimit = await consumeRateLimit(
    env.DB,
    user.id,
    routeClass(request, pathname),
    now,
  );
  if (!rateLimit.allowed) {
    return jsonResponse(429, errorBody("RATE_LIMITED"), {
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  if (pathname === "/api/v1/bootstrap") {
    if (request.method !== "GET") {
      return jsonResponse(405, errorBody("METHOD_NOT_ALLOWED"), {
        Allow: "GET",
      });
    }
    const bootstrap = await loadBootstrap(env.DB, user.id, now);
    return jsonResponse(200, {
      data: { identity: { email: user.email }, ...bootstrap },
    });
  }

  const deckId = decodeDeckId(pathname);
  if (deckId !== null) {
    if (request.method !== "PUT" && request.method !== "DELETE") {
      return jsonResponse(405, errorBody("METHOD_NOT_ALLOWED"), {
        Allow: "PUT, DELETE",
      });
    }
    const body = await readJsonBody(request);
    if (request.method === "PUT") {
      let input: DeckInput;
      try {
        input = validateDeckInput(body);
      } catch (error) {
        throw new ApiProblem(400, "INVALID_REQUEST", { cause: error });
      }
      if (input.deckId !== deckId) {
        throw new ApiProblem(400, "INVALID_REQUEST");
      }
      return executeIdempotently(
        request,
        env.DB,
        user.id,
        "deck.put",
        { deckId, body: input },
        now,
        createLeaseToken,
        async () => {
          const result = await putDeck(env.DB, user.id, input, now);
          return {
            status:
              result.replayed || input.expectedRevision !== null ? 200 : 201,
            body: { data: result },
          };
        },
      );
    }

    const expectedRevision = parseDeleteInput(body);
    return executeIdempotently(
      request,
      env.DB,
      user.id,
      "deck.delete",
      { deckId, expectedRevision },
      now,
      createLeaseToken,
      async () => ({
        status: 200,
        body: {
          data: await deleteDeck(
            env.DB,
            user.id,
            deckId,
            expectedRevision,
            now,
          ),
        },
      }),
    );
  }

  if (pathname === "/api/v1/active-deck") {
    if (request.method !== "PUT") {
      return jsonResponse(405, errorBody("METHOD_NOT_ALLOWED"), {
        Allow: "PUT",
      });
    }
    const input = parseActiveDeckInput(await readJsonBody(request));
    return executeIdempotently(
      request,
      env.DB,
      user.id,
      "active-deck.put",
      input,
      now,
      createLeaseToken,
      async () => ({
        status: 200,
        body: {
          data: await setActiveDeck(
            env.DB,
            user.id,
            input.activeDeckId,
            input.expectedRevision,
            now,
          ),
        },
      }),
    );
  }

  if (pathname === "/api/v1/matches") {
    if (request.method !== "POST") {
      return jsonResponse(405, errorBody("METHOD_NOT_ALLOWED"), {
        Allow: "POST",
      });
    }
    let input: MatchInput;
    try {
      input = validateMatchInput(await readJsonBody(request), now);
    } catch (error) {
      if (error instanceof ApiProblem) throw error;
      throw new ApiProblem(400, "INVALID_REQUEST", { cause: error });
    }
    return executeIdempotently(
      request,
      env.DB,
      user.id,
      "match.post",
      input,
      now,
      createLeaseToken,
      async () => {
        const result = await appendMatch(env.DB, user.id, input, now);
        return {
          status: result.replayed ? 200 : 201,
          body: { data: result },
        };
      },
    );
  }

  return jsonResponse(404, errorBody("NOT_FOUND"));
}

export async function handleCloudDataRequest(
  request: Request,
  env: CloudDataApiEnv,
  dependencies: CloudDataApiDependencies = {},
): Promise<Response> {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch (error) {
    return problemResponse(
      new ApiProblem(400, "INVALID_REQUEST", { cause: error }),
    );
  }

  let policy: DeploymentPolicy;
  try {
    policy = parsePolicy(env, requestUrl.hostname);
  } catch (error) {
    return problemResponse(mapDataError(error));
  }

  let identity: { accessSub: string; email: string };
  try {
    identity = await authenticateAccessRequest(
      request,
      { teamDomain: env.ACCESS_TEAM_DOMAIN, policy },
      dependencies.verificationKey,
    );
  } catch {
    return jsonResponse(401, errorBody("UNAUTHORIZED"));
  }

  try {
    await requireSentinel(env.DB, policy);
  } catch {
    return jsonResponse(503, errorBody("SERVICE_UNAVAILABLE"));
  }

  const now = (dependencies.now ?? Date.now)();
  let user: { id: string; email: string };
  try {
    user = await resolveCloudUser(env.DB, identity, {
      emailKeySecret: env.EMAIL_KEY_SECRET,
      now,
      createUserId: dependencies.createUserId,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (
      code === "SYNC_NOT_ENROLLED" ||
      code === "ACCOUNT_DELETED" ||
      code === "IDENTITY_CONFLICT" ||
      code === "IDENTITY_RELINK_REQUIRED"
    ) {
      return jsonResponse(403, errorBody("SYNC_NOT_AVAILABLE"));
    }
    return jsonResponse(503, errorBody("SERVICE_UNAVAILABLE"));
  }

  try {
    return await routeAuthenticatedRequest(
      request,
      requestUrl,
      env,
      user,
      now,
      dependencies.createLeaseToken ?? (() => `lease_${crypto.randomUUID()}`),
    );
  } catch (error) {
    return problemResponse(mapDataError(error));
  }
}
