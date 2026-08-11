import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createQualifiedDeployStaticTestTransport,
  parseQualifiedDeployArgs,
  qualificationEnvironment,
  runQualifiedDeployForTest,
} from "../../scripts/private-hosted/deploy-qualified.mjs";

const roots: string[] = [];
const COMMIT = "1".repeat(40);
const ACCOUNT_ID = "8b2b1b63c5cf8d5c49dcc608b730dd10";
const TOKEN = "conan-qualified-deploy-test-token";
const PROJECT = "conan-private-7302df07";
const ACCESS = "https://steep-mouse-bb22.cloudflareaccess.com";
const TEAM = "steep-mouse-bb22";
const D1 = "4ee3b0b4-560a-46b9-9e9f-17dd394fc291";
const OPERATOR_CONFIG = {
  schemaVersion: 1,
  accountId: ACCOUNT_ID,
  projectName: PROJECT,
  teamName: TEAM,
  operatorEmail: "owner@example.com",
  approvedEmails: ["friend@example.com", "owner@example.com"],
} as const;
const ACCESS_IDS = {
  cloudflareIdp: "00000000-0000-4000-8000-000000000000",
  idp: "11111111-1111-4111-8111-111111111111",
  rootApp: "22222222-2222-4222-8222-222222222222",
  wildcardApp: "33333333-3333-4333-8333-333333333333",
  rootPolicy: "44444444-4444-4444-8444-444444444444",
  wildcardPolicy: "55555555-5555-4555-8555-555555555555",
};
const ASSET_HASH = createHash("sha256")
  .update("<!doctype html>\n")
  .digest("hex")
  .slice(0, 32);
const COMMANDS = [
  "npm-ci",
  "card-identities",
  "build",
  "dependency-audit",
  "bug-gate",
  "typecheck",
  "lint",
  "unit",
  "smoke",
  "dev-e2e",
  "docs",
  "docs-check",
  "advanced-boundary",
  "prepare-release",
  "secret-scan",
  "destination-scan",
  "prepared-private-e2e",
  "clean-tree-check",
];
const vars = {
  ACCESS_TEAM_DOMAIN: ACCESS,
  ACCESS_AUD:
    "804dd12e524e3dfd51dd950d3db03b610e415e7e5c71f0300f82a0ccd269c007",
  DEPLOYMENT_ENV: "production",
  APP_HOST_KIND: "exact",
  APP_HOST_VALUE: `${PROJECT}.pages.dev`,
  D1_DATABASE_ID: D1,
};

type Fixture = Awaited<ReturnType<typeof fixture>>;

function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

async function json(path: string, value: unknown) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, text);
  return text;
}

function accessPolicy(id: string) {
  return {
    id,
    decision: "allow",
    include: OPERATOR_CONFIG.approvedEmails.map((email) => ({
      email: { email },
    })),
    exclude: [],
    require: [],
    mfa_config: { mfa_disabled: true },
  };
}

function accessFixture() {
  const root = `${PROJECT}.pages.dev`;
  const wildcard = `*.${root}`;
  const apps = [
    {
      id: ACCESS_IDS.rootApp,
      type: "self_hosted",
      domain: root,
      destinations: [{ type: "public", uri: root }],
      allowed_idps: [ACCESS_IDS.idp],
      auto_redirect_to_identity: true,
      session_duration: "12h",
      allow_authenticate_via_warp: false,
      options_preflight_bypass: false,
      mfa_config: { mfa_disabled: true },
    },
    {
      id: ACCESS_IDS.wildcardApp,
      type: "self_hosted",
      domain: wildcard,
      destinations: [{ type: "public", uri: wildcard }],
      allowed_idps: [ACCESS_IDS.idp],
      auto_redirect_to_identity: true,
      session_duration: "12h",
      allow_authenticate_via_warp: false,
      options_preflight_bypass: false,
      mfa_config: { mfa_disabled: true },
    },
  ];
  return {
    idps: [
      { id: ACCESS_IDS.cloudflareIdp, type: "cloudflare" },
      { id: ACCESS_IDS.idp, type: "onetimepin" },
    ],
    apps,
    appDetails: {
      [ACCESS_IDS.rootApp]: apps[0]!,
      [ACCESS_IDS.wildcardApp]: apps[1]!,
    },
    organization: {
      allow_authenticate_via_warp: false,
    },
    policies: {
      [ACCESS_IDS.rootApp]: [accessPolicy(ACCESS_IDS.rootPolicy)],
      [ACCESS_IDS.wildcardApp]: [accessPolicy(ACCESS_IDS.wildcardPolicy)],
    } as Record<string, Record<string, unknown>[]>,
  };
}

function uploadJwt(maxFileCount = 20_000) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({
    exp: Math.floor(Date.now() / 1000) + 3_600,
    max_file_count_allowed: maxFileCount,
  })}.signature`;
}

function qualificationArgv(id: string, repoRoot: string, runDir: string) {
  const npmCli = resolve(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
  const npm = (...args: string[]) => [process.execPath, npmCli, ...args];
  const scripts: Record<string, string> = {
    "card-identities": "check:meta-card-identities",
    build: "build:meta",
    "bug-gate": "private-hosted:bug-gate",
    typecheck: "typecheck",
    lint: "lint",
    unit: "test",
    smoke: "smoke:1000",
    "dev-e2e": "test:e2e",
    docs: "docs",
    "docs-check": "docs:check",
    "advanced-boundary": "private-hosted:boundary:advanced",
    "secret-scan": "private-hosted:scan-secrets",
    "destination-scan": "private-hosted:scan-destinations",
    "prepared-private-e2e": "test:e2e:private-hosted:prepared",
  };
  if (id === "npm-ci") return npm("ci");
  if (id === "dependency-audit") return npm("audit", "--audit-level=high");
  if (id === "prepare-release") {
    return [
      process.platform === "win32"
        ? "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
        : "/usr/bin/pwsh",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      resolve(repoRoot, "scripts/private-hosted/prepare.ps1"),
      "--staging",
      resolve(runDir, "staging"),
      "--evidence",
      resolve(runDir, "evidence"),
    ];
  }
  if (id === "clean-tree-check") {
    return [
      process.platform === "win32"
        ? resolve(dirname(process.execPath), "..", "Git", "cmd", "git.exe")
        : "/usr/bin/git",
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ];
  }
  return npm("run", "--silent", scripts[id]!);
}

function project(overrides: Record<string, unknown> = {}) {
  const env_vars = Object.fromEntries(
    Object.entries(vars).map(([name, value]) => [
      name,
      { type: "plain_text", value },
    ]),
  );
  return {
    name: PROJECT,
    subdomain: `${PROJECT}.pages.dev`,
    domains: [],
    source: null,
    build_config: {
      web_analytics_tag: null,
      web_analytics_token: null,
      build_command: null,
      destination_dir: null,
      root_dir: null,
      build_caching: false,
    },
    production_branch: "main",
    uses_functions: true,
    deployment_configs: {
      production: {
        always_use_latest_compatibility_date: false,
        build_image_major_version: 3,
        compatibility_date: "2026-08-10",
        compatibility_flags: [],
        fail_open: false,
        usage_model: "standard",
        wrangler_config_hash: hash("wrangler\n"),
        env_vars,
        d1_databases: { DB: { id: D1 } },
      },
    },
    ...overrides,
  };
}

function deployment(overrides: Record<string, unknown> = {}) {
  return {
    id: "deploy-12345",
    url: `https://deploy-12345.${PROJECT}.pages.dev/`,
    project_name: PROJECT,
    environment: "production",
    uses_functions: true,
    deployment_trigger: {
      type: "ad_hoc",
      metadata: {
        branch: "main",
        commit_hash: COMMIT,
        commit_dirty: false,
        commit_message: `qualified ${COMMIT}`,
      },
    },
    ...overrides,
  };
}

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), "conan-direct-pages-test-"));
  roots.push(parent);
  const repoRoot = resolve(parent, "repo");
  const runDir = resolve(parent, "qualified-run");
  const stagingDir = resolve(runDir, "staging");
  const evidenceDir = resolve(runDir, "evidence");
  const logsDir = resolve(runDir, "logs");
  await mkdir(repoRoot, { recursive: true });
  await mkdir(stagingDir, { recursive: true });
  await mkdir(evidenceDir);
  await mkdir(logsDir);
  const lockText = await json(resolve(repoRoot, "package-lock.json"), {
    lockfileVersion: 3,
  });
  const files = new Map([
    ["/_headers", "/*\n"],
    ["/_routes.json", '{"version":1,"include":["/api/v1/*"],"exclude":[]}\n'],
    ["/_worker.js", "export default { fetch() {} };\n"],
    ["/index.html", "<!doctype html>\n"],
  ]);
  for (const [path, content] of files)
    await writeFile(resolve(stagingDir, path.slice(1)), content);
  const upload = [...files].map(([path, content]) => ({
    path,
    bytes: Buffer.byteLength(content),
    sha256: hash(content),
  }));
  const response = upload.filter(({ path }) => path === "/index.html");
  const uploadText = await json(resolve(evidenceDir, "upload-manifest.json"), {
    schemaVersion: 1,
    files: upload,
  });
  const responseText = await json(
    resolve(evidenceDir, "response-manifest.json"),
    { schemaVersion: 1, files: response },
  );
  const deployment = {
    schemaVersion: 1,
    projectName: PROJECT,
    productionBranch: "main",
    pagesBuildOutputDir: "dist",
    headersPath: "/_headers",
    routesPath: "/_routes.json",
    wranglerConfigSha256: hash("wrangler\n"),
    assets: [
      {
        ...response[0],
        pagesHash: response[0]!.sha256.slice(0, 32),
        contentType: "text/html",
      },
    ],
    worker: {
      path: "/_worker.js",
      bytes: Buffer.byteLength(files.get("/_worker.js")!),
      sha256: hash(files.get("/_worker.js")!),
      contentType: "application/javascript+module",
      mainModule: "_worker.js",
      compatibilityDate: "2026-08-10",
      compatibilityFlags: [],
      bindings: [
        ...Object.entries(vars).map(([name, text]) => ({
          name,
          type: "plain_text",
          text,
        })),
        { name: "DB", type: "d1", id: D1 },
      ],
    },
  };
  const deploymentText = await json(
    resolve(evidenceDir, "pages-deployment.json"),
    deployment,
  );
  const records = [];
  for (const [index, id] of COMMANDS.entries()) {
    const path = `logs/${String(index + 1).padStart(2, "0")}-${id}.log`;
    const text = `${id}\n`;
    await writeFile(resolve(runDir, path), text);
    records.push({
      id,
      argv: qualificationArgv(id, repoRoot, runDir),
      exitCode: 0,
      startedAt: "2026-08-11T00:00:00.000Z",
      completedAt: "2026-08-11T00:00:01.000Z",
      log: { path, bytes: Buffer.byteLength(text), sha256: hash(text) },
      ...(id === "prepared-private-e2e"
        ? {
            preparedInputs: {
              mode: "prepared",
              stagingRealpath: stagingDir,
              uploadManifestSha256: hash(uploadText),
              responseManifestSha256: hash(responseText),
              pagesDeploymentSha256: hash(deploymentText),
              postStopStagingMatch: true,
            },
          }
        : {}),
    });
  }
  const reportPath = resolve(runDir, "qualification-report.json");
  await json(reportPath, {
    schemaVersion: 3,
    releaseCommit: COMMIT,
    packageLockSha256: hash(lockText),
    uploadManifestSha256: hash(uploadText),
    responseManifestSha256: hash(responseText),
    pagesDeploymentSha256: hash(deploymentText),
    startedAt: "2026-08-11T00:00:00.000Z",
    completedAt: "2026-08-11T00:01:00.000Z",
    commands: records,
    secretFindings: [],
    destinationFindings: [],
    bugGateSha256: records[4]!.log.sha256,
  });
  return { repoRoot, runDir, stagingDir, reportPath, evidenceDir, logsDir };
}

function scenario(f: Fixture, overrides: Record<string, unknown> = {}) {
  const created = deployment();
  const activeProject = project({
    canonical_deployment: created,
    latest_deployment: created,
  });
  return {
    access: accessFixture(),
    accessProtected: true,
    accessRedirectHost: null,
    accessRedirectMode: "valid",
    createdDeployment: created,
    deployedProject: activeProject,
    deploymentStatuses: [deployment({ latest_stage: { status: "success" } })],
    gitHead: COMMIT,
    gitStatus: "",
    missingHashes: [ASSET_HASH],
    mutationAllowed: true,
    project: activeProject,
    runDir: f.runDir,
    uploadToken: uploadJwt(),
    ...overrides,
  };
}

async function run(f: Fixture, overrides: Record<string, unknown> = {}) {
  return runQualifiedDeployForTest(
    {
      repoRoot: f.repoRoot,
      accountId: ACCOUNT_ID,
      operatorConfig: OPERATOR_CONFIG,
    },
    scenario(f, overrides),
  );
}

async function rewriteDeploymentEvidence(
  f: Fixture,
  mutate: (value: any) => void,
) {
  const evidencePath = resolve(f.evidenceDir, "pages-deployment.json");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  mutate(evidence);
  const evidenceText = await json(evidencePath, evidence);
  const report = JSON.parse(await readFile(f.reportPath, "utf8"));
  report.pagesDeploymentSha256 = hash(evidenceText);
  report.commands.find(
    (command: any) => command.id === "prepared-private-e2e",
  ).preparedInputs.pagesDeploymentSha256 = hash(evidenceText);
  await json(f.reportPath, report);
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("qualified private Pages direct deployment", () => {
  it("accepts no command line arguments and removes secrets from qualification environment", () => {
    expect(parseQualifiedDeployArgs([])).toEqual({});
    expect(() => parseQualifiedDeployArgs(["--run-dir", "C:\\x"])).toThrow(
      /no command-line/,
    );
    const env = qualificationEnvironment({
      PATH: "safe",
      CLOUDFLARE_API_TOKEN: TOKEN,
      CF_API_TOKEN: TOKEN,
      MY_TOKEN: TOKEN,
      NODE_OPTIONS: "--require evil",
      KEEP: "no",
    });
    expect(env).toEqual({ CI: "1", PATH: "safe" });
  });

  it("preflights production config, uploads missing bytes from memory, creates exact Pages deployment, then checks Access", async () => {
    const f = await fixture();
    const globalFetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("global fetch must remain unused"));
    const { result, requests } = await run(f);
    expect(result).toMatchObject({ id: "deploy-12345", releaseCommit: COMMIT });
    expect(globalFetch).not.toHaveBeenCalled();
    expect(requests.map(({ url }) => url)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("check-missing"),
        expect.stringContaining("assets/upload"),
        expect.stringContaining("upsert-hashes"),
        expect.stringContaining("/deployments"),
      ]),
    );
    const upload = requests.find(({ url }) => url.endsWith("/assets/upload"))!;
    expect(JSON.parse(String(upload.body))).toEqual([
      {
        key: ASSET_HASH,
        value: Buffer.from("<!doctype html>\n").toString("base64"),
        metadata: { contentType: "text/html" },
        base64: true,
      },
    ]);
    const deploymentCall = requests.find(({ url }) =>
      url.endsWith(`/pages/projects/${PROJECT}/deployments`),
    )!;
    const form = deploymentCall.body as FormData;
    expect(JSON.parse(String(form.get("manifest")))).toEqual({
      "/index.html": ASSET_HASH,
    });
    expect(form.get("branch")).toBe("main");
    expect(form.get("commit_hash")).toBe(COMMIT);
    expect(form.get("pages_build_output_dir")).toBe("dist");
    expect(await (form.get("_headers") as Blob).text()).toBe("/*\n");
    expect(await (form.get("_routes.json") as Blob).text()).toContain(
      "/api/v1/*",
    );
    expect(await (form.get("_worker.bundle") as Blob).text()).toContain(
      '"main_module":"_worker.js"',
    );
    const source = await readFile(
      resolve(process.cwd(), "scripts/private-hosted/deploy-qualified.mjs"),
      "utf8",
    );
    expect(source).not.toMatch(
      /wrangler\/bin|pages", "deploy|node_modules\\wrangler/,
    );
  });

  it("rejects an Access login path bound to another host before asset APIs", async () => {
    const f = await fixture();
    await expect(
      run(f, {
        accessRedirectHost: "other.example",
        mutationAllowed: false,
      }),
    ).rejects.toThrow(/Access redirect differs/);
  });

  it.each(["missing", "wrong"] as const)(
    "rejects %s Access login query evidence before asset APIs",
    async (accessRedirectMode) => {
      const f = await fixture();
      await expect(
        run(f, { accessRedirectMode, mutationAllowed: false }),
      ).rejects.toThrow(/Access redirect differs/);
    },
  );

  it.each(["report", "evidence", "log", "staging"] as const)(
    "rejects tampered %s before any Cloudflare call",
    async (target) => {
      const f = await fixture();
      if (target === "report") await writeFile(f.reportPath, "{}\n");
      if (target === "evidence")
        await writeFile(
          resolve(f.evidenceDir, "pages-deployment.json"),
          "{}\n",
        );
      if (target === "log")
        await writeFile(resolve(f.logsDir, "01-npm-ci.log"), "changed\n");
      if (target === "staging")
        await writeFile(resolve(f.stagingDir, "index.html"), "changed\n");
      await expect(run(f, { mutationAllowed: false })).rejects.toThrow(
        /qualified|Pages|staged/i,
      );
    },
  );

  it("rejects a forged qualification argv before any Cloudflare call", async () => {
    const f = await fixture();
    const report = JSON.parse(await readFile(f.reportPath, "utf8"));
    report.commands[0].argv = ["node", "not-npm-ci"];
    await json(f.reportPath, report);
    await expect(run(f, { mutationAllowed: false })).rejects.toThrow(
      /argv differs/,
    );
  });

  it("recomputes each Pages hash from the qualified in-memory bytes", async () => {
    const f = await fixture();
    await rewriteDeploymentEvidence(f, (value) => {
      value.assets[0].pagesHash = "f".repeat(32);
    });
    await expect(run(f, { mutationAllowed: false })).rejects.toThrow(
      /hash differs/,
    );
  });

  it("rejects a different account and missing Access before asset APIs", async () => {
    const wrongAccount = await fixture();
    await expect(
      runQualifiedDeployForTest(
        {
          repoRoot: wrongAccount.repoRoot,
          accountId: "2".repeat(32),
          operatorConfig: OPERATOR_CONFIG,
        },
        scenario(wrongAccount, { mutationAllowed: false }),
      ),
    ).rejects.toThrow(/fixed operator account/);

    const unprotected = await fixture();
    await expect(
      run(unprotected, { accessProtected: false, mutationAllowed: false }),
    ).rejects.toThrow(/not protected/);
  });

  it("uses app details and permits inherited MFA only for a disabled organization", async () => {
    const f = await fixture();
    const access = accessFixture();
    access.apps = access.apps.map(({ id, domain, type }) => ({
      id,
      domain,
      type,
    }));
    delete access.appDetails[ACCESS_IDS.rootApp]!.mfa_config;
    delete access.appDetails[ACCESS_IDS.wildcardApp]!.mfa_config;
    access.organization.mfa_required_for_all_apps = false;
    access.organization.mfa_config = { allowed_authenticators: ["totp"] };

    await expect(run(f, { access })).resolves.toMatchObject({
      result: { id: expect.any(String) },
    });

    const blocked = await fixture();
    access.organization.mfa_required_for_all_apps = true;
    await expect(
      run(blocked, { access, mutationAllowed: false }),
    ).rejects.toThrow(/organization MFA|independent MFA/i);
  });

  it("rejects malformed app MFA detail before Pages mutation", async () => {
    const f = await fixture();
    const access = accessFixture();
    access.appDetails[ACCESS_IDS.rootApp]!.mfa_config = "malformed";

    await expect(run(f, { access, mutationAllowed: false })).rejects.toThrow(
      /mfa_config|MFA/i,
    );
  });

  it.each([
    [
      "extra identity provider",
      (value: ReturnType<typeof accessFixture>) => {
        value.idps.push({
          id: "66666666-6666-4666-8666-666666666666",
          type: "github",
        });
      },
    ],
    [
      "second one-time PIN identity provider",
      (value: ReturnType<typeof accessFixture>) => {
        value.idps.push({
          id: "77777777-7777-4777-8777-777777777777",
          type: "onetimepin",
        });
      },
    ],
    [
      "second built-in Cloudflare identity provider",
      (value: ReturnType<typeof accessFixture>) => {
        value.idps.push({
          id: "88888888-8888-4888-8888-888888888888",
          type: "cloudflare",
        });
      },
    ],
    [
      "broadened application",
      (value: ReturnType<typeof accessFixture>) => {
        value.apps[0]!.allowed_idps.push(
          "66666666-6666-4666-8666-666666666666",
        );
      },
    ],
    [
      "broadened policy",
      (value: ReturnType<typeof accessFixture>) => {
        value.policies[ACCESS_IDS.rootApp]![0]!.include = [
          ...OPERATOR_CONFIG.approvedEmails.map((email) => ({
            email: { email },
          })),
          { everyone: {} },
        ];
      },
    ],
  ])("rejects %s before any Pages mutation", async (_label, mutate) => {
    const f = await fixture();
    const access = accessFixture();
    mutate(access);
    await expect(run(f, { access, mutationAllowed: false })).rejects.toThrow(
      /Access/i,
    );
  });

  it("rejects an operator config that does not pin the deployed account", async () => {
    const f = await fixture();
    await expect(
      runQualifiedDeployForTest(
        {
          repoRoot: f.repoRoot,
          accountId: ACCOUNT_ID,
          operatorConfig: { ...OPERATOR_CONFIG, accountId: "2".repeat(32) },
        },
        scenario(f, { mutationAllowed: false }),
      ),
    ).rejects.toThrow(/operator config/i);
  });

  it("keeps the exported test seam data-only and incapable of accepting a token", async () => {
    const f = await fixture();
    const globalFetch = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("global fetch must remain unused"));
    await expect(
      runQualifiedDeployForTest(
        {
          repoRoot: f.repoRoot,
          token: "production-looking-token-value",
          accountId: ACCOUNT_ID,
          operatorConfig: OPERATOR_CONFIG,
        },
        scenario(f),
      ),
    ).rejects.toThrow(/fields must match/);
    expect(globalFetch).not.toHaveBeenCalled();

    await expect(
      runQualifiedDeployForTest(
        {
          repoRoot: f.repoRoot,
          accountId: ACCOUNT_ID,
          operatorConfig: OPERATOR_CONFIG,
        },
        { ...scenario(f), project: () => project() },
      ),
    ).rejects.toThrow(/plain cloneable data/);
    expect(globalFetch).not.toHaveBeenCalled();

    const transport = createQualifiedDeployStaticTestTransport(scenario(f));
    await expect(
      transport.fetch("https://unexpected.example.test/", { method: "GET" }),
    ).rejects.toThrow(/exact protocol|unexpected test request/);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", "not-a-jwt"],
    [
      "expired",
      (() => {
        const encode = (value: unknown) =>
          Buffer.from(JSON.stringify(value)).toString("base64url");
        return `${encode({ alg: "none" })}.${encode({ exp: 1, max_file_count_allowed: 20_000 })}.signature`;
      })(),
    ],
    ["claim below asset count", uploadJwt(0)],
  ])("rejects %s upload token before asset mutation", async (_label, jwt) => {
    const f = await fixture();
    await expect(
      run(f, { uploadToken: jwt, mutationAllowed: false }),
    ).rejects.toThrow(/upload token/i);
  });

  it.each([
    ["branch", () => project({ production_branch: "preview" })],
    ["custom domain", () => project({ domains: ["public.example.com"] })],
    [
      "Git source",
      () =>
        project({
          source: { type: "github", config: { production_branch: "main" } },
        }),
    ],
    [
      "Web Analytics",
      () =>
        project({
          build_config: {
            web_analytics_tag: "beacon-tag",
            web_analytics_token: "beacon-token",
          },
        }),
    ],
    [
      "build command",
      () =>
        project({
          build_config: {
            build_command: "npm run build",
            destination_dir: "dist",
          },
        }),
    ],
    [
      "environment",
      () => {
        const value = project();
        value.deployment_configs.production.env_vars.DEPLOYMENT_ENV.value =
          "preview";
        return value;
      },
    ],
    [
      "D1",
      () => {
        const value = project();
        value.deployment_configs.production.d1_databases.DB.id = "0".repeat(36);
        return value;
      },
    ],
    [
      "Browser Rendering",
      () => {
        const value = project();
        value.deployment_configs.production.browsers = { BROWSER: {} };
        return value;
      },
    ],
    [
      "Hyperdrive",
      () => {
        const value = project();
        value.deployment_configs.production.hyperdrive_bindings = {
          DATABASE: { id: "x" },
        };
        return value;
      },
    ],
    [
      "fail open",
      () => {
        const value = project();
        value.deployment_configs.production.fail_open = true;
        return value;
      },
    ],
    [
      "missing fail open",
      () => {
        const value = project();
        delete value.deployment_configs.production.fail_open;
        return value;
      },
    ],
    [
      "null fail open",
      () => {
        const value = project();
        value.deployment_configs.production.fail_open = null;
        return value;
      },
    ],
    [
      "limits",
      () => {
        const value = project();
        value.deployment_configs.production.limits = { cpu_ms: 50 };
        return value;
      },
    ],
    [
      "placement",
      () => {
        const value = project();
        value.deployment_configs.production.placement = { mode: "smart" };
        return value;
      },
    ],
    [
      "latest compatibility",
      () => {
        const value = project();
        value.deployment_configs.production.always_use_latest_compatibility_date = true;
        return value;
      },
    ],
    [
      "missing latest compatibility",
      () => {
        const value = project();
        delete value.deployment_configs.production
          .always_use_latest_compatibility_date;
        return value;
      },
    ],
    [
      "null latest compatibility",
      () => {
        const value = project();
        value.deployment_configs.production.always_use_latest_compatibility_date =
          null;
        return value;
      },
    ],
    [
      "build image",
      () => {
        const value = project();
        value.deployment_configs.production.build_image_major_version = 2;
        return value;
      },
    ],
    [
      "usage model",
      () => {
        const value = project();
        value.deployment_configs.production.usage_model = "bundled";
        return value;
      },
    ],
    [
      "extra binding",
      () => {
        const value = project();
        value.deployment_configs.production.kv_namespaces = {
          EXTRA: { namespace_id: "x" },
        };
        return value;
      },
    ],
  ])("rejects wrong remote %s before asset APIs", async (_label, remote) => {
    const f = await fixture();
    await expect(
      run(f, { project: remote(), mutationAllowed: false }),
    ).rejects.toThrow(/remote Pages/i);
  });
});
