export type CloudflareFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const API_ORIGIN = "https://api.cloudflare.com";
const API_PREFIX = "/client/v4/";
const PAGE_SIZE = 1_000;
const MAX_PAGES = 100;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const MAX_REQUEST_TIMEOUT_MS = 120_000;
const ACCOUNT_ID = /^[0-9a-f]{32}$/;

function fail(message: string): never {
  throw new Error(`Cloudflare read-only API rejected: ${message}`);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("API response envelope is invalid");
  }
  return value as Record<string, unknown>;
}

function safeInteger(value: unknown, minimum: number): value is number {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum
  );
}

function hasAsciiWhitespaceOrControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f;
  });
}

function inputUrl(input: string | URL | Request): URL {
  if (input instanceof Request) return new URL(input.url);
  return new URL(input.toString());
}

/**
 * Adds the API token only to Cloudflare's versioned API origin. Public probes
 * are always cookie-free and authorization-free, even if ambient headers were
 * supplied by a caller.
 */
export function createCloudflareApiFetch(
  token: string,
  baseFetch: CloudflareFetch = fetch,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): CloudflareFetch {
  if (
    token.length === 0 ||
    token.length > 4_096 ||
    token !== token.trim() ||
    hasAsciiWhitespaceOrControl(token)
  ) {
    fail("API token is missing or malformed");
  }
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1 ||
    requestTimeoutMs > MAX_REQUEST_TIMEOUT_MS
  ) {
    fail("request timeout is invalid");
  }
  return async (input, init) => {
    const url = inputUrl(input);
    const inheritedMethod = input instanceof Request ? input.method : undefined;
    const method = (init?.method ?? inheritedMethod ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      fail("audit fetch permits only GET or HEAD requests");
    }
    if (init?.body !== undefined && init.body !== null) {
      fail("audit fetch body is forbidden");
    }
    const redirect = init?.redirect ?? "error";
    if (redirect !== "error" && redirect !== "manual") {
      fail("audit fetch redirect mode must be error or manual");
    }
    const isCloudflareApi =
      url.origin === API_ORIGIN && url.pathname.startsWith(API_PREFIX);
    const headers = new Headers();
    if (isCloudflareApi) {
      headers.set("authorization", `Bearer ${token}`);
      headers.set("accept", "application/json");
    } else {
      headers.set("accept", "text/html");
    }
    const controller = new AbortController();
    const callerSignal = init?.signal;
    let rejectGuard: ((reason: Error) => void) | undefined;
    const guard = new Promise<never>((_resolve, reject) => {
      rejectGuard = reject;
    });
    const abortFromCaller = () => {
      controller.abort();
      rejectGuard?.(
        new Error("Cloudflare read-only API rejected: request aborted"),
      );
    };
    if (callerSignal?.aborted) abortFromCaller();
    else
      callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      controller.abort();
      rejectGuard?.(
        new Error("Cloudflare read-only API rejected: request timed out"),
      );
    }, requestTimeoutMs);
    timeout.unref?.();
    try {
      return await Promise.race([
        baseFetch(url, {
          method,
          headers,
          credentials: "omit",
          redirect,
          cache: "no-store",
          signal: controller.signal,
        }),
        guard,
      ]);
    } finally {
      clearTimeout(timeout);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    }
  };
}

type ListEndpoint = {
  path: string;
  label: string;
};

async function parseObjectResponse(
  response: Response,
  label: string,
): Promise<unknown> {
  if (!response.ok) fail(`${label} returned HTTP ${response.status}`);
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_RESPONSE_BYTES)
  ) {
    fail(`${label} response size is invalid`);
  }
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    fail(`${label} response is too large`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return fail(`${label} returned invalid JSON`);
  }
  const envelope = record(parsed);
  if (envelope.success !== true || !record(envelope.result)) {
    fail(`${label} returned an unsuccessful or invalid envelope`);
  }
  return envelope.result;
}

async function getAccountResource(
  accountId: string,
  endpoint: ListEndpoint,
  fetchImpl: CloudflareFetch,
): Promise<unknown> {
  if (!ACCOUNT_ID.test(accountId)) fail("account ID is invalid");
  const url = new URL(
    `${API_ORIGIN}${API_PREFIX}accounts/${accountId}/${endpoint.path}`,
  );
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" },
    });
  } catch {
    return fail(`${endpoint.label} request failed`);
  }
  return parseObjectResponse(response, endpoint.label);
}

async function parseListPage(
  response: Response,
  endpoint: ListEndpoint,
  requestedPage: number,
): Promise<{ result: unknown[]; totalPages: number }> {
  if (!response.ok) fail(`${endpoint.label} returned HTTP ${response.status}`);
  const declaredLength = response.headers.get("content-length");
  if (
    declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) ||
      Number(declaredLength) > MAX_RESPONSE_BYTES)
  ) {
    fail(`${endpoint.label} response size is invalid`);
  }
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
    fail(`${endpoint.label} response is too large`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return fail(`${endpoint.label} returned invalid JSON`);
  }
  const envelope = record(parsed);
  if (envelope.success !== true || !Array.isArray(envelope.result)) {
    fail(`${endpoint.label} returned an unsuccessful or invalid envelope`);
  }
  if (envelope.result_info === undefined) {
    fail(`${endpoint.label} omitted pagination metadata`);
  }
  const info = record(envelope.result_info);
  if (
    !safeInteger(info.page, 1) ||
    !safeInteger(info.per_page, 1) ||
    !safeInteger(info.total_pages, 1) ||
    info.page !== requestedPage ||
    info.per_page !== PAGE_SIZE ||
    info.total_pages > MAX_PAGES ||
    requestedPage > info.total_pages ||
    envelope.result.length > PAGE_SIZE
  ) {
    fail(`${endpoint.label} pagination metadata is invalid`);
  }
  if (
    requestedPage < info.total_pages &&
    envelope.result.length !== PAGE_SIZE
  ) {
    fail(`${endpoint.label} returned a truncated non-final page`);
  }
  return { result: envelope.result, totalPages: info.total_pages };
}

async function listAccountResource(
  accountId: string,
  endpoint: ListEndpoint,
  fetchImpl: CloudflareFetch,
): Promise<unknown[]> {
  if (!ACCOUNT_ID.test(accountId)) fail("account ID is invalid");
  const all: unknown[] = [];
  let expectedTotalPages: number | undefined;
  for (let page = 1; page <= (expectedTotalPages ?? 1); page += 1) {
    const url = new URL(
      `${API_ORIGIN}${API_PREFIX}accounts/${accountId}/${endpoint.path}`,
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(PAGE_SIZE));
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
        headers: { accept: "application/json" },
      });
    } catch {
      return fail(`${endpoint.label} request failed`);
    }
    const parsed = await parseListPage(response, endpoint, page);
    if (
      expectedTotalPages !== undefined &&
      parsed.totalPages !== expectedTotalPages
    ) {
      fail(`${endpoint.label} pagination changed during the audit`);
    }
    expectedTotalPages = parsed.totalPages;
    all.push(...parsed.result);
  }
  const ids = all
    .map((item) =>
      typeof item === "object" && item !== null && !Array.isArray(item)
        ? (item as Record<string, unknown>).id
        : undefined,
    )
    .filter((id): id is string => typeof id === "string");
  if (new Set(ids).size !== ids.length) {
    fail(`${endpoint.label} returned duplicate IDs`);
  }
  return all;
}

export function listCloudflareIdentityProviders(
  accountId: string,
  fetchImpl: CloudflareFetch,
): Promise<unknown[]> {
  return listAccountResource(
    accountId,
    { path: "access/identity_providers", label: "identity provider list" },
    fetchImpl,
  );
}

export function listCloudflareAccessApplications(
  accountId: string,
  fetchImpl: CloudflareFetch,
): Promise<unknown[]> {
  return listAccountResource(
    accountId,
    { path: "access/apps", label: "Access application list" },
    fetchImpl,
  );
}

export function getCloudflareAccessApplication(
  accountId: string,
  applicationId: string,
  fetchImpl: CloudflareFetch,
): Promise<unknown> {
  if (!/^[0-9a-f-]{1,64}$/.test(applicationId)) {
    fail("Access application ID is invalid");
  }
  return getAccountResource(
    accountId,
    {
      path: `access/apps/${encodeURIComponent(applicationId)}`,
      label: "Access application detail",
    },
    fetchImpl,
  );
}

export function getCloudflareAccessOrganization(
  accountId: string,
  fetchImpl: CloudflareFetch,
): Promise<unknown> {
  return getAccountResource(
    accountId,
    { path: "access/organizations", label: "Access organization" },
    fetchImpl,
  );
}

export function listCloudflareAccessPolicies(
  accountId: string,
  applicationId: string,
  fetchImpl: CloudflareFetch,
): Promise<unknown[]> {
  if (!/^[0-9a-f-]{1,64}$/.test(applicationId)) {
    fail("Access application ID is invalid");
  }
  return listAccountResource(
    accountId,
    {
      path: `access/apps/${encodeURIComponent(applicationId)}/policies`,
      label: "Access policy list",
    },
    fetchImpl,
  );
}
