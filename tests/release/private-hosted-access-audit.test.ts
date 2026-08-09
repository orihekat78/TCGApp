import { describe, expect, it, vi } from "vitest";
import {
  createCloudflareApiFetch,
  listCloudflareAccessApplications,
  type CloudflareFetch,
} from "../../scripts/private-hosted/cloudflare-api.js";
import {
  auditAccess,
  parseAccessAuditArgs,
} from "../../scripts/private-hosted/verify-access.js";

const config = {
  schemaVersion: 1 as const,
  accountId: "0123456789abcdef0123456789abcdef",
  projectName: "conan-private-a1b2c3d4",
  teamName: "conan-family",
  operatorEmail: "owner@example.com",
  approvedEmails: ["friend@example.com", "owner@example.com"],
};

const ids = {
  idp: "11111111-1111-4111-8111-111111111111",
  rootApp: "22222222-2222-4222-8222-222222222222",
  wildcardApp: "33333333-3333-4333-8333-333333333333",
  rootPolicy: "44444444-4444-4444-8444-444444444444",
  wildcardPolicy: "55555555-5555-4555-8555-555555555555",
};

type Fixture = {
  idps: Record<string, unknown>[];
  apps: Record<string, unknown>[];
  policies: Record<string, Record<string, unknown>[]>;
  redirectHost?: string;
  probeStatus?: number;
  apiStatus?: number;
};

function policy(id: string, emails: readonly string[]): Record<string, unknown> {
  return {
    id,
    name: "private named people",
    decision: "allow",
    include: emails.map((value) => ({ email: { email: value } })),
    exclude: [],
    require: [{ login_method: { id: ids.idp } }],
    mfa_config: { mfa_disabled: true },
  };
}

function blockPolicy(id: string): Record<string, unknown> {
  return {
    id,
    name: "contained block everyone",
    decision: "deny",
    include: [{ everyone: {} }],
    exclude: [],
    require: [],
  };
}

function goodFixture(emails: readonly string[] = [config.operatorEmail]): Fixture {
  const root = `${config.projectName}.pages.dev`;
  const wildcard = `*.${root}`;
  return {
    idps: [
      {
        id: ids.idp,
        name: "Cloudflare Access",
        type: "cloudflare",
        config: {
          restrict_to_account_members: false,
          client_secret: "must-never-enter-evidence",
        },
      },
    ],
    apps: [
      {
        id: ids.rootApp,
        name: "root",
        type: "self_hosted",
        domain: root,
        destinations: [{ type: "public", uri: root }],
        allowed_idps: [ids.idp],
        auto_redirect_to_identity: true,
        session_duration: "30m",
        allow_authenticate_via_warp: false,
        options_preflight_bypass: false,
        mfa_config: { mfa_disabled: true },
        raw_secret: "must-never-enter-evidence",
      },
      {
        id: ids.wildcardApp,
        name: "wildcard",
        type: "self_hosted",
        domain: wildcard,
        destinations: [{ type: "public", uri: wildcard }],
        allowed_idps: [ids.idp],
        auto_redirect_to_identity: true,
        session_duration: "29m",
        allow_authenticate_via_warp: false,
        options_preflight_bypass: false,
        mfa_config: { mfa_disabled: true },
      },
    ],
    policies: {
      [ids.rootApp]: [policy(ids.rootPolicy, emails)],
      [ids.wildcardApp]: [policy(ids.wildcardPolicy, emails)],
    },
  };
}

function jsonResponse(
  result: unknown,
  status = 200,
  pagination: { page: number; totalPages: number } = { page: 1, totalPages: 1 },
): Response {
  return new Response(
    JSON.stringify({
      success: status >= 200 && status < 300,
      result,
      errors: status >= 300 ? [{ message: "raw secret from API" }] : [],
      result_info: {
        page: pagination.page,
        per_page: 1000,
        total_pages: pagination.totalPages,
      },
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

function fullPage(...items: unknown[]): unknown[] {
  return [
    ...items,
    ...Array.from({ length: 1_000 - items.length }, (_, index) => ({
      id: `filler-${index}`,
    })),
  ];
}

function fixtureFetch(
  fixture: Fixture,
  observations: { probes: { url: string; init?: RequestInit }[] } = {
    probes: [],
  },
): CloudflareFetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.hostname === "api.cloudflare.com") {
      if (fixture.apiStatus) return jsonResponse([], fixture.apiStatus);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.at(-1) === "identity_providers") {
        return jsonResponse(fixture.idps);
      }
      if (parts.at(-1) === "apps") return jsonResponse(fixture.apps);
      if (parts.at(-1) === "policies") {
        const appId = parts.at(-2)!;
        return jsonResponse(fixture.policies[appId] ?? []);
      }
      return jsonResponse([], 404);
    }
    observations.probes.push({ url: url.toString(), init });
    const host = fixture.redirectHost ?? `${config.teamName}.cloudflareaccess.com`;
    const status = fixture.probeStatus ?? 302;
    return new Response(null, {
      status,
      headers:
        status >= 300 && status <= 399
          ? { location: `https://${host}/cdn-cgi/access/login` }
          : undefined,
    });
  }) as CloudflareFetch;
}

function findingCodes(result: Awaited<ReturnType<typeof auditAccess>>): string[] {
  return result.findings.map((finding) => finding.code);
}

describe("private hosted Access audit", () => {
  it("accepts the operator-only preflight state and emits redacted stable evidence", async () => {
    const observations = { probes: [] as { url: string; init?: RequestInit }[] };
    const result = await auditAccess(
      config,
      "preflight",
      fixtureFetch(goodFixture(), observations),
    );

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.auditEvidence.ok).toBe(true);
    expect(result.auditEvidence.configSnapshotSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.auditEvidence.probes).toEqual([
      {
        target: "root",
        status: 302,
        redirectHost: `${config.teamName}.cloudflareaccess.com`,
      },
      {
        target: "wildcard",
        status: 302,
        redirectHost: `${config.teamName}.cloudflareaccess.com`,
      },
    ]);
    expect(observations.probes.map((item) => item.url)).toEqual([
      `https://${config.projectName}.pages.dev/`,
      `https://probe.${config.projectName}.pages.dev/`,
    ]);
    for (const { init } of observations.probes) {
      expect(init).toMatchObject({
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
      });
      const headers = new Headers(init?.headers);
      expect(headers.has("authorization")).toBe(false);
      expect(headers.has("cookie")).toBe(false);
    }
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("must-never-enter-evidence");
    expect(serialized).not.toContain("raw_secret");
    expect(result.configSnapshot).toMatchObject({
      idp: {
        id: ids.idp,
        type: "cloudflare",
        restrictToAccountMembers: false,
      },
      rootApp: { id: ids.rootApp, domain: `${config.projectName}.pages.dev` },
      wildcardApp: {
        id: ids.wildcardApp,
        domain: `*.${config.projectName}.pages.dev`,
      },
    });
  });

  it("keeps the redacted snapshot hash stable across API and policy rule order", async () => {
    const original = goodFixture(config.approvedEmails);
    const reordered = goodFixture([...config.approvedEmails].reverse());
    reordered.apps.reverse();
    for (const policies of Object.values(reordered.policies)) {
      for (const candidate of policies) {
        if (Array.isArray(candidate.include)) candidate.include.reverse();
        if (Array.isArray(candidate.require)) candidate.require.reverse();
      }
      policies.reverse();
    }

    const [first, second] = await Promise.all([
      auditAccess(config, "active", fixtureFetch(original)),
      auditAccess(config, "active", fixtureFetch(reordered)),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.auditEvidence.configSnapshotSha256).toBe(
      first.auditEvidence.configSnapshotSha256,
    );
  });

  it("requires the complete approved email set in active mode", async () => {
    const active = await auditAccess(
      config,
      "active",
      fixtureFetch(goodFixture(config.approvedEmails)),
    );
    expect(active.ok).toBe(true);

    const incomplete = goodFixture([config.operatorEmail]);
    const rejected = await auditAccess(config, "active", fixtureFetch(incomplete));
    expect(rejected.ok).toBe(false);
    expect(findingCodes(rejected)).toContain("policy.root.email-set");
    expect(findingCodes(rejected)).toContain("policy.wildcard.email-set");
  });

  it("requires exactly one Block Everyone policy in contained mode", async () => {
    const contained = goodFixture();
    contained.policies[ids.rootApp] = [blockPolicy(ids.rootPolicy)];
    contained.policies[ids.wildcardApp] = [blockPolicy(ids.wildcardPolicy)];
    expect(
      (await auditAccess(config, "contained", fixtureFetch(contained))).ok,
    ).toBe(true);

    contained.policies[ids.rootApp] = [policy(ids.rootPolicy, [config.operatorEmail])];
    const rejected = await auditAccess(config, "contained", fixtureFetch(contained));
    expect(findingCodes(rejected)).toContain("policy.root.decision");
  });

  it.each([401, 403])(
    "accepts a direct %s Forbidden response in contained mode",
    async (probeStatus) => {
      const contained = goodFixture();
      contained.policies[ids.rootApp] = [blockPolicy(ids.rootPolicy)];
      contained.policies[ids.wildcardApp] = [blockPolicy(ids.wildcardPolicy)];
      contained.probeStatus = probeStatus;

      const result = await auditAccess(
        config,
        "contained",
        fixtureFetch(contained),
      );

      expect(result.ok).toBe(true);
      expect(result.auditEvidence.probes).toEqual([
        { target: "root", status: probeStatus, redirectHost: null },
        { target: "wildcard", status: probeStatus, redirectHost: null },
      ]);
    },
  );

  it("rejects missing or broadened contained policies", async () => {
    const missing = goodFixture();
    missing.policies[ids.rootApp] = [];
    missing.policies[ids.wildcardApp] = [blockPolicy(ids.wildcardPolicy)];
    expect(
      findingCodes(await auditAccess(config, "contained", fixtureFetch(missing))),
    ).toContain("policy.root.count");

    const broadened = goodFixture();
    broadened.policies[ids.rootApp] = [blockPolicy(ids.rootPolicy)];
    broadened.policies[ids.wildcardApp] = [blockPolicy(ids.wildcardPolicy)];
    broadened.policies[ids.rootApp]![0]!.include = [
      { email_domain: { domain: "example.com" } },
    ];
    broadened.policies[ids.wildcardApp]![0]!.require = [
      { login_method: { id: ids.idp } },
    ];
    const result = await auditAccess(config, "contained", fixtureFetch(broadened));
    expect(findingCodes(result)).toEqual(
      expect.arrayContaining([
        "policy.root.include-rule",
        "policy.wildcard.require",
      ]),
    );
  });

  it("limits preflight sessions to 30 minutes but allows active sessions up to 12 hours", async () => {
    const preflight = goodFixture();
    preflight.apps[0]!.session_duration = "31m";
    preflight.policies[ids.rootApp]![0]!.session_duration = "31m";
    const rejected = await auditAccess(config, "preflight", fixtureFetch(preflight));
    expect(findingCodes(rejected)).toEqual(
      expect.arrayContaining([
        "application.root.session-duration",
        "policy.root.session-duration",
      ]),
    );

    const active = goodFixture(config.approvedEmails);
    active.apps[0]!.session_duration = "12h";
    active.apps[1]!.session_duration = "12h";
    active.policies[ids.rootApp]![0]!.session_duration = "12h";
    active.policies[ids.wildcardApp]![0]!.session_duration = "12h";
    expect((await auditAccess(config, "active", fixtureFetch(active))).ok).toBe(true);
  });

  it("fails closed for extra identity providers, applications, and unsafe app flags", async () => {
    const fixture = goodFixture();
    fixture.idps.push({
      id: "66666666-6666-4666-8666-666666666666",
      type: "onetimepin",
      config: {},
    });
    fixture.apps.push({
      id: "77777777-7777-4777-8777-777777777777",
      type: "self_hosted",
      domain: `public.${config.projectName}.pages.dev`,
    });
    fixture.apps[0]!.auto_redirect_to_identity = false;
    fixture.apps[0]!.allow_authenticate_via_warp = true;
    fixture.apps[0]!.session_duration = "12h1s";
    fixture.apps[0]!.options_preflight_bypass = true;
    fixture.apps[0]!.mfa_config = { mfa_disabled: false };
    fixture.apps[0]!.destinations = [
      { type: "public", uri: `${config.projectName}.pages.dev/public` },
    ];

    const result = await auditAccess(config, "preflight", fixtureFetch(fixture));
    expect(result.ok).toBe(false);
    expect(findingCodes(result)).toEqual(
      expect.arrayContaining([
        "idp.count",
        "application.count",
        "application.root.auto-redirect",
        "application.root.warp",
        "application.root.session-duration",
        "application.root.preflight-bypass",
        "application.root.mfa",
        "application.root.destination",
      ]),
    );
  });

  it.each([
    ["everyone", { everyone: {} }, "policy.root.include-rule"],
    ["domain", { email_domain: { domain: "example.com" } }, "policy.root.include-rule"],
    ["group", { group: { id: "group" } }, "policy.root.include-rule"],
    ["ip", { ip: { ip: "192.0.2.0/24" } }, "policy.root.include-rule"],
    ["country", { geo: { country_code: "JP" } }, "policy.root.include-rule"],
    ["certificate", { certificate: {} }, "policy.root.include-rule"],
  ])("rejects the %s selector", async (_name, rule, expectedCode) => {
    const fixture = goodFixture();
    fixture.policies[ids.rootApp]![0]!.include = [rule];
    const result = await auditAccess(config, "preflight", fixtureFetch(fixture));
    expect(findingCodes(result)).toContain(expectedCode);
  });

  it.each(["bypass", "non_identity", "service_auth", "deny"])(
    "rejects the %s policy decision",
    async (decision) => {
      const fixture = goodFixture();
      fixture.policies[ids.rootApp]![0]!.decision = decision;
      const result = await auditAccess(config, "preflight", fixtureFetch(fixture));
      expect(findingCodes(result)).toContain("policy.root.decision");
    },
  );

  it("rejects exclusions, alternate login methods, duplicates, and bad redirects", async () => {
    const fixture = goodFixture();
    fixture.policies[ids.rootApp]!.push(
      policy("88888888-8888-4888-8888-888888888888", [config.operatorEmail]),
    );
    fixture.policies[ids.wildcardApp]![0]!.exclude = [
      { email: { email: "blocked@example.com" } },
    ];
    fixture.policies[ids.wildcardApp]![0]!.require = [
      { login_method: { id: "99999999-9999-4999-8999-999999999999" } },
    ];
    fixture.redirectHost = "attacker.example";
    const result = await auditAccess(config, "preflight", fixtureFetch(fixture));
    expect(findingCodes(result)).toEqual(
      expect.arrayContaining([
        "policy.root.count",
        "policy.wildcard.exclude",
        "policy.wildcard.login-method",
        "probe.root.redirect",
        "probe.wildcard.redirect",
      ]),
    );
  });

  it("rejects policy session overrides above the mode limit and independent MFA", async () => {
    const fixture = goodFixture();
    fixture.policies[ids.rootApp]![0]!.session_duration = "12h1s";
    fixture.policies[ids.rootApp]![0]!.mfa_config = {
      mfa_disabled: false,
      allowed_authenticators: ["totp"],
    };
    const result = await auditAccess(config, "preflight", fixtureFetch(fixture));
    expect(findingCodes(result)).toEqual(
      expect.arrayContaining([
        "policy.root.session-duration",
        "policy.root.mfa",
      ]),
    );
  });

  it("rejects non-redirect probe responses", async () => {
    const fixture = goodFixture();
    fixture.probeStatus = 200;
    const result = await auditAccess(config, "preflight", fixtureFetch(fixture));
    expect(findingCodes(result)).toEqual(
      expect.arrayContaining(["probe.root.status", "probe.wildcard.status"]),
    );
  });

  it("does not expose Cloudflare API response bodies in failures", async () => {
    const fixture = goodFixture();
    fixture.apiStatus = 403;
    await expect(
      auditAccess(config, "preflight", fixtureFetch(fixture)),
    ).rejects.toThrow(/HTTP 403/);
    await expect(
      auditAccess(config, "preflight", fixtureFetch(fixture)),
    ).rejects.not.toThrow(/raw secret from API/);
  });

  it("does not preserve invalid raw API scalar values in audit output", async () => {
    const fixture = goodFixture();
    fixture.idps[0]!.type = "must-never-enter-evidence";
    fixture.apps[0]!.session_duration = "must-never-enter-evidence";
    fixture.policies[ids.rootApp]![0]!.id = "must-never-enter-evidence";
    fixture.policies[ids.rootApp]![0]!.decision = "must-never-enter-evidence";
    fixture.policies[ids.rootApp]![0]!.include = [
      { email: { email: "must-never-enter-evidence" } },
    ];
    const result = await auditAccess(config, "preflight", fixtureFetch(fixture));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("must-never-enter-evidence");
  });

  it("audits every API page and rejects an extra application found on page 2", async () => {
    const fixture = goodFixture();
    const extra = {
      id: "77777777-7777-4777-8777-777777777777",
      type: "self_hosted",
      domain: `public.${config.projectName}.pages.dev`,
    };
    const requests: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      if (url.hostname !== "api.cloudflare.com") {
        return new Response(null, {
          status: 302,
          headers: {
            location: `https://${config.teamName}.cloudflareaccess.com/cdn-cgi/access/login`,
          },
        });
      }
      requests.push(`${url.pathname}?${url.searchParams.toString()}`);
      expect(url.searchParams.get("per_page")).toBe("1000");
      const page = Number(url.searchParams.get("page"));
      if (url.pathname.endsWith("/identity_providers")) {
        return jsonResponse(fixture.idps, 200, { page, totalPages: 1 });
      }
      if (url.pathname.endsWith("/apps")) {
        return jsonResponse(
          page === 1 ? fullPage(fixture.apps[0]) : [fixture.apps[1], extra],
          200,
          { page, totalPages: 2 },
        );
      }
      if (url.pathname.endsWith("/policies")) {
        const appId = url.pathname.split("/").at(-2)!;
        return jsonResponse(fixture.policies[appId] ?? [], 200, {
          page,
          totalPages: 1,
        });
      }
      return jsonResponse([], 404, { page, totalPages: 1 });
    }) as CloudflareFetch;

    const result = await auditAccess(config, "preflight", fetchImpl);

    expect(findingCodes(result)).toContain("application.count");
    expect(requests.sort()).toEqual([
      `/client/v4/accounts/${config.accountId}/access/apps?page=1&per_page=1000`,
      `/client/v4/accounts/${config.accountId}/access/apps?page=2&per_page=1000`,
      `/client/v4/accounts/${config.accountId}/access/apps/${ids.rootApp}/policies?page=1&per_page=1000`,
      `/client/v4/accounts/${config.accountId}/access/apps/${ids.wildcardApp}/policies?page=1&per_page=1000`,
      `/client/v4/accounts/${config.accountId}/access/identity_providers?page=1&per_page=1000`,
    ].sort());
  });
});

describe("Cloudflare API pagination", () => {
  function pagesFetch(
    pages: Array<{ result: unknown[]; totalPages: number; status?: number }>,
    requests: string[] = [],
  ): CloudflareFetch {
    return vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      requests.push(url.toString());
      const page = Number(url.searchParams.get("page"));
      const response = pages[page - 1]!;
      return jsonResponse(response.result, response.status ?? 200, {
        page,
        totalPages: response.totalPages,
      });
    }) as CloudflareFetch;
  }

  it("rejects pagination metadata that changes after page 1", async () => {
    await expect(
      listCloudflareAccessApplications(
        config.accountId,
        pagesFetch([
          { result: fullPage({ id: ids.rootApp }), totalPages: 2 },
          { result: fullPage({ id: ids.wildcardApp }), totalPages: 3 },
        ]),
      ),
    ).rejects.toThrow(/pagination changed/);
  });

  it("rejects duplicate IDs across pages", async () => {
    await expect(
      listCloudflareAccessApplications(
        config.accountId,
        pagesFetch([
          { result: fullPage({ id: ids.rootApp }), totalPages: 2 },
          { result: [{ id: ids.rootApp }], totalPages: 2 },
        ]),
      ),
    ).rejects.toThrow(/duplicate IDs/);
  });

  it("fails closed without exposing a later-page API error body", async () => {
    const requests: string[] = [];
    const promise = listCloudflareAccessApplications(
      config.accountId,
      pagesFetch([
        { result: fullPage({ id: ids.rootApp }), totalPages: 2 },
        { result: [], totalPages: 2, status: 403 },
      ], requests),
    );
    await expect(promise).rejects.toThrow(/HTTP 403/);
    await expect(promise).rejects.not.toThrow(/raw secret from API/);
    expect(requests).toHaveLength(2);
  });

  it("rejects any page when pagination metadata is absent", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: [{ id: ids.rootApp }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as CloudflareFetch;

    await expect(
      listCloudflareAccessApplications(config.accountId, fetchImpl),
    ).rejects.toThrow(/omitted pagination metadata/);
  });

  it("rejects a server-selected page size or a truncated non-final page", async () => {
    const wrongPageSize = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: [],
          result_info: { page: 1, per_page: 100, total_pages: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as CloudflareFetch;
    await expect(
      listCloudflareAccessApplications(config.accountId, wrongPageSize),
    ).rejects.toThrow(/pagination metadata is invalid/);

    await expect(
      listCloudflareAccessApplications(
        config.accountId,
        pagesFetch([
          { result: [{ id: ids.rootApp }], totalPages: 2 },
          { result: [{ id: ids.wildcardApp }], totalPages: 2 },
        ]),
      ),
    ).rejects.toThrow(/truncated non-final page/);
  });

  it.each([
    [0, 1],
    [2, 2],
    [1, 0],
    [1, 101],
  ])("rejects malformed pagination page=%s total_pages=%s", async (page, totalPages) => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          result: [],
          result_info: { page, per_page: 1_000, total_pages: totalPages },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ) as CloudflareFetch;

    await expect(
      listCloudflareAccessApplications(config.accountId, fetchImpl),
    ).rejects.toThrow(/pagination metadata is invalid/);
  });
});

describe("Cloudflare API authorization boundary", () => {
  it("times out a fetch that never settles and aborts its transport", async () => {
    let transportSignal: AbortSignal | undefined;
    const baseFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      transportSignal = init?.signal ?? undefined;
      return await new Promise<Response>(() => undefined);
    }) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch, 10);

    await expect(
      safeFetch("https://api.cloudflare.com/client/v4/accounts/id/access/apps"),
    ).rejects.toThrow(/request timed out/);
    expect(transportSignal?.aborted).toBe(true);
  });

  it("composes caller cancellation with the audit timeout", async () => {
    const caller = new AbortController();
    const baseFetch = vi.fn(
      async () => await new Promise<Response>(() => undefined),
    ) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch, 1_000);
    const request = safeFetch(
      "https://api.cloudflare.com/client/v4/accounts/id/access/apps",
      { signal: caller.signal },
    );

    caller.abort();

    await expect(request).rejects.toThrow(/request aborted/);
  });

  it("adds the token only to Cloudflare API requests and strips ambient credentials", async () => {
    const seen: { url: string; headers: Headers; credentials?: RequestCredentials }[] = [];
    const baseFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: input instanceof Request ? input.url : input.toString(),
        headers: new Headers(init?.headers),
        credentials: init?.credentials,
      });
      return new Response("{}", { status: 200 });
    }) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch);

    await safeFetch("https://api.cloudflare.com/client/v4/accounts/id/access/apps", {
      headers: {
        Cookie: "ambient=bad",
        Authorization: "Bearer ambient",
        "CF-Access-Client-Id": "ambient-client",
        "CF-Access-Client-Secret": "ambient-secret",
        "X-API-Key": "ambient-api-key",
        "X-Amz-Security-Token": "ambient-session",
      },
      credentials: "include",
    });
    await safeFetch(`https://${config.projectName}.pages.dev/`, {
      headers: {
        Cookie: "ambient=bad",
        Authorization: "Bearer ambient",
        "CF-Access-Client-Id": "ambient-client",
        "CF-Access-Client-Secret": "ambient-secret",
        "X-API-Key": "ambient-api-key",
        "X-Amz-Security-Token": "ambient-session",
      },
      credentials: "include",
    });

    expect(seen[0]!.headers.get("authorization")).toBe("Bearer test-token");
    expect(seen[0]!.headers.has("cookie")).toBe(false);
    expect(seen[0]!.headers.has("cf-access-client-secret")).toBe(false);
    expect(seen[0]!.headers.has("x-api-key")).toBe(false);
    expect(seen[0]!.headers.has("x-amz-security-token")).toBe(false);
    expect([...seen[0]!.headers.keys()].sort()).toEqual(["accept", "authorization"]);
    expect(seen[0]!.credentials).toBe("omit");
    expect(seen[1]!.headers.has("authorization")).toBe(false);
    expect(seen[1]!.headers.has("cookie")).toBe(false);
    expect(seen[1]!.headers.has("cf-access-client-id")).toBe(false);
    expect(seen[1]!.headers.has("cf-access-client-secret")).toBe(false);
    expect(seen[1]!.headers.has("x-api-key")).toBe(false);
    expect(seen[1]!.headers.has("x-amz-security-token")).toBe(false);
    expect([...seen[1]!.headers.keys()]).toEqual(["accept"]);
    expect(seen[1]!.credentials).toBe("omit");
  });

  it("rebuilds Cloudflare API GET requests without Request credentials", async () => {
    const seen: { method?: string; headers: Headers; credentials?: RequestCredentials }[] = [];
    const baseFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        method: init?.method,
        headers: new Headers(init?.headers),
        credentials: init?.credentials,
      });
      return new Response("{}", { status: 200 });
    }) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch);
    const request = new Request(
      "https://api.cloudflare.com/client/v4/accounts/id/access/apps",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer ambient",
          Cookie: "ambient=bad",
          "X-API-Key": "ambient-api-key",
          "X-Amz-Security-Token": "ambient-session",
        },
        credentials: "include",
      },
    );

    await safeFetch(request);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe("GET");
    expect(seen[0]!.credentials).toBe("omit");
    expect([...seen[0]!.headers.entries()].sort()).toEqual([
      ["accept", "application/json"],
      ["authorization", "Bearer test-token"],
    ]);
  });

  it("rebuilds public HEAD probes without Request credentials", async () => {
    const seen: { method?: string; headers: Headers; credentials?: RequestCredentials }[] = [];
    const baseFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        method: init?.method,
        headers: new Headers(init?.headers),
        credentials: init?.credentials,
      });
      return new Response(null, { status: 302 });
    }) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch);
    const request = new Request(`https://${config.projectName}.pages.dev/`, {
      method: "HEAD",
      headers: {
        Authorization: "Bearer ambient",
        Cookie: "ambient=bad",
        "CF-Access-Client-Secret": "ambient-secret",
      },
      credentials: "include",
    });

    await safeFetch(request, { redirect: "manual" });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe("HEAD");
    expect(seen[0]!.credentials).toBe("omit");
    expect([...seen[0]!.headers.entries()]).toEqual([["accept", "text/html"]]);
  });

  it("rejects a POST Request before calling the network", async () => {
    const baseFetch = vi.fn(async () => new Response("{}")) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch);
    const request = new Request(
      "https://api.cloudflare.com/client/v4/accounts/id/access/apps",
      { method: "POST", body: "secret" },
    );

    await expect(safeFetch(request)).rejects.toThrow(/only GET or HEAD/);
    expect(baseFetch).not.toHaveBeenCalled();
  });

  it("rejects caller bodies and follow redirects before calling the network", async () => {
    const baseFetch = vi.fn(async () => new Response("{}")) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch);
    const url = "https://api.cloudflare.com/client/v4/accounts/id/access/apps";

    await expect(safeFetch(url, { method: "GET", body: "secret" })).rejects.toThrow(
      /body is forbidden/,
    );
    await expect(safeFetch(url, { redirect: "follow" })).rejects.toThrow(
      /redirect mode/,
    );
    expect(baseFetch).not.toHaveBeenCalled();
  });

  it.each(["POST", "DELETE"])(
    "rejects %s before calling the network",
    async (method) => {
      const baseFetch = vi.fn(async () => new Response("{}")) as CloudflareFetch;
      const safeFetch = createCloudflareApiFetch("test-token", baseFetch);

      await expect(
        safeFetch("https://api.cloudflare.com/client/v4/accounts/id/access/apps", {
          method,
        }),
      ).rejects.toThrow(/only GET or HEAD/);
      expect(baseFetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    "https://api.cloudflare.com.evil.example/client/v4/accounts/id/access/apps",
    "https://api.cloudflare.com/not-client/v4/accounts/id/access/apps",
  ])("does not send a bearer token to %s", async (url) => {
    const seen: Headers[] = [];
    const baseFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      return new Response("{}", { status: 200 });
    }) as CloudflareFetch;
    const safeFetch = createCloudflareApiFetch("test-token", baseFetch);

    await safeFetch(url, { headers: { Authorization: "Bearer ambient" } });

    expect(seen).toHaveLength(1);
    expect(seen[0]!.has("authorization")).toBe(false);
  });
});

describe("Access audit CLI arguments", () => {
  it("requires one mode and accepts an absolute external config path", () => {
    expect(parseAccessAuditArgs(["--mode", "preflight"], {
      LOCALAPPDATA: "C:\\Users\\owner\\AppData\\Local",
    })).toEqual({
      mode: "preflight",
      configPath:
        "C:\\Users\\owner\\AppData\\Local\\ConanPrivateHosted\\operator.json",
    });
    expect(
      parseAccessAuditArgs(
        ["--mode", "contained", "--config", "C:\\private\\operator.json"],
        {},
      ),
    ).toEqual({
      mode: "contained",
      configPath: "C:\\private\\operator.json",
    });
    expect(() => parseAccessAuditArgs([], {})).toThrow(/usage/);
    expect(() =>
      parseAccessAuditArgs(["--mode", "active", "--config", "relative.json"], {}),
    ).toThrow(/absolute/);
  });
});
