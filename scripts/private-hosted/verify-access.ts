import { createHash } from "node:crypto";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCloudflareApiFetch,
  listCloudflareAccessApplications,
  listCloudflareAccessPolicies,
  listCloudflareIdentityProviders,
  type CloudflareFetch,
} from "./cloudflare-api.js";
import {
  defaultOperatorConfigPath,
  loadOperatorConfig,
  validateOperatorConfig,
  type HostedOperatorConfig,
} from "./operator-config.js";

export type AccessAuditMode = "preflight" | "active" | "contained";

export type AuditFinding = {
  code: string;
  message: string;
};

export type AccessConfigSnapshot = Readonly<{
  idp: unknown;
  rootApp: unknown;
  wildcardApp: unknown;
  policies: unknown;
}>;

export type AccessAuditEvidence = Readonly<{
  mode: AccessAuditMode;
  startedAt: string;
  completedAt: string;
  ok: boolean;
  findings: readonly AuditFinding[];
  probes: unknown;
  configSnapshotSha256: string;
}>;

type AuditResult = {
  ok: boolean;
  findings: AuditFinding[];
  configSnapshot: AccessConfigSnapshot;
  auditEvidence: AccessAuditEvidence;
};

type AppTarget = "root" | "wildcard";

type AppInspection = {
  raw: Record<string, unknown> | undefined;
  id: string | undefined;
  snapshot: unknown;
};

type ProbeEvidence = {
  target: AppTarget;
  status: number | null;
  redirectHost: string | null;
};

const MODULE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const ACCESS_MODES = new Set<AccessAuditMode>([
  "preflight",
  "active",
  "contained",
]);
const ID = /^[0-9a-f-]{1,64}$/;
const MAX_ACTIVE_SESSION_MILLISECONDS = 12 * 60 * 60 * 1_000;
const MAX_PREFLIGHT_SESSION_MILLISECONDS = 30 * 60 * 1_000;
const DURATION_UNITS: Readonly<Record<string, number>> = {
  ns: 0.000001,
  us: 0.001,
  "µs": 0.001,
  "μs": 0.001,
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
};
const KNOWN_POLICY_DECISIONS = new Set([
  "allow",
  "block",
  "bypass",
  "deny",
  "non_identity",
  "service_auth",
]);

function fail(message: string): never {
  throw new Error(`private hosted Access audit rejected: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function safeId(value: unknown): string | undefined {
  return typeof value === "string" && ID.test(value) ? value : undefined;
}

function addFinding(
  findings: AuditFinding[],
  code: string,
  message: string,
): void {
  if (!findings.some((finding) => finding.code === code)) {
    findings.push({ code, message });
  }
}

function parseDuration(value: unknown): number | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const part = /(\d+(?:\.\d+)?)(ns|us|µs|μs|ms|s|m|h)/gy;
  let offset = 0;
  let total = 0;
  while (offset < value.length) {
    part.lastIndex = offset;
    const match = part.exec(value);
    if (!match || match.index !== offset) return undefined;
    const amount = Number(match[1]);
    const multiplier = DURATION_UNITS[match[2]!];
    if (!Number.isFinite(amount) || amount < 0 || multiplier === undefined) {
      return undefined;
    }
    total += amount * multiplier;
    offset = part.lastIndex;
  }
  return Number.isFinite(total) && total > 0 ? total : undefined;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalRule(value: unknown): unknown {
  if (!isRecord(value)) return { type: "invalid" };
  if (
    exactKeys(value, ["everyone"]) &&
    isRecord(value.everyone) &&
    exactKeys(value.everyone, [])
  ) {
    return { everyone: {} };
  }
  if (exactKeys(value, ["email"]) && isRecord(value.email)) {
    return {
      email: {
        email:
          exactKeys(value.email, ["email"]) && safeEmailLiteral(value.email.email)
            ? value.email.email
            : null,
      },
    };
  }
  if (exactKeys(value, ["login_method"]) && isRecord(value.login_method)) {
    return {
      login_method: {
        id:
          exactKeys(value.login_method, ["id"]) && safeId(value.login_method.id)
            ? value.login_method.id
            : null,
      },
    };
  }
  const keys = Object.keys(value).sort();
  return {
    type:
      keys.length === 1 && /^[a-z][a-z0-9_]{0,63}$/.test(keys[0]!)
        ? keys[0]
        : "unsupported",
  };
}

function canonicalPolicy(value: unknown): unknown {
  if (!isRecord(value)) {
    return {
      id: null,
      decision: null,
      include: [],
      require: [],
      exclude: [],
      sessionDuration: null,
      mfaDisabled: null,
    };
  }
  const mfa = isRecord(value.mfa_config) ? value.mfa_config : undefined;
  const rules = (candidate: unknown): unknown[] =>
    (Array.isArray(candidate)
      ? candidate.map(canonicalRule)
      : [{ type: "invalid" }]
    ).sort(compareCanonical);
  return {
    id: safeId(value.id) ?? null,
    decision:
      typeof value.decision === "string" &&
      KNOWN_POLICY_DECISIONS.has(value.decision)
        ? value.decision
        : null,
    include: rules(value.include),
    require: rules(value.require),
    exclude: rules(value.exclude),
    sessionDuration:
      parseDuration(value.session_duration) !== undefined
        ? value.session_duration
        : null,
    mfaDisabled:
      typeof mfa?.mfa_disabled === "boolean" ? mfa.mfa_disabled : null,
  };
}

function compareCanonical(left: unknown, right: unknown): number {
  const leftJson = canonicalJson(left);
  const rightJson = canonicalJson(right);
  return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
}

function canonicalPolicies(values: readonly unknown[]): unknown[] {
  return values.map(canonicalPolicy).sort(compareCanonical);
}

function inspectIdentityProvider(
  values: readonly unknown[],
  findings: AuditFinding[],
): { id: string | undefined; snapshot: unknown } {
  if (values.length !== 1 || !isRecord(values[0])) {
    addFinding(
      findings,
      "idp.count",
      "Exactly one Cloudflare identity provider is required.",
    );
  }
  const raw = values.find(isRecord);
  if (!raw) return { id: undefined, snapshot: null };
  const id = safeId(raw.id);
  if (!id) {
    addFinding(findings, "idp.id", "The Cloudflare identity provider ID is invalid.");
  }
  if (raw.type !== "cloudflare") {
    addFinding(
      findings,
      "idp.type",
      "The sole identity provider must be Cloudflare Access.",
    );
  }
  const providerConfig = isRecord(raw.config) ? raw.config : undefined;
  if (providerConfig?.restrict_to_account_members !== false) {
    addFinding(
      findings,
      "idp.account-members",
      "Cloudflare account-member restriction must be disabled.",
    );
  }
  return {
    id,
    snapshot: {
      id: id ?? null,
      type: raw.type === "cloudflare" ? "cloudflare" : "unsupported",
      restrictToAccountMembers:
        typeof providerConfig?.restrict_to_account_members === "boolean"
          ? providerConfig.restrict_to_account_members
          : null,
    },
  };
}

function destinationIsExact(value: unknown, domain: string): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, ["type", "uri"]) &&
    value.type === "public" &&
    value.uri === domain
  );
}

function inspectApplication(
  target: AppTarget,
  values: readonly unknown[],
  domain: string,
  identityProviderId: string | undefined,
  mode: AccessAuditMode,
  findings: AuditFinding[],
): AppInspection {
  const matches = values.filter(
    (value): value is Record<string, unknown> =>
      isRecord(value) && value.domain === domain,
  );
  if (matches.length !== 1) {
    addFinding(
      findings,
      `application.${target}.count`,
      `Exactly one ${target} Access application is required.`,
    );
  }
  const raw = matches[0];
  if (!raw) return { raw: undefined, id: undefined, snapshot: null };
  const id = safeId(raw.id);
  if (!id) {
    addFinding(
      findings,
      `application.${target}.id`,
      `The ${target} Access application ID is invalid.`,
    );
  }
  if (raw.type !== "self_hosted") {
    addFinding(
      findings,
      `application.${target}.type`,
      `The ${target} Access application must be self-hosted.`,
    );
  }
  const allowedIdps = Array.isArray(raw.allowed_idps)
    ? raw.allowed_idps.filter((value): value is string => safeId(value) !== undefined)
    : [];
  if (
    !identityProviderId ||
    !Array.isArray(raw.allowed_idps) ||
    raw.allowed_idps.length !== 1 ||
    allowedIdps.length !== 1 ||
    allowedIdps[0] !== identityProviderId
  ) {
    addFinding(
      findings,
      `application.${target}.allowed-idps`,
      `The ${target} application must allow only the Cloudflare identity provider.`,
    );
  }
  if (raw.auto_redirect_to_identity !== true) {
    addFinding(
      findings,
      `application.${target}.auto-redirect`,
      `The ${target} application must automatically redirect to its sole identity provider.`,
    );
  }
  if (raw.allow_authenticate_via_warp !== false) {
    addFinding(
      findings,
      `application.${target}.warp`,
      `The ${target} application must not authenticate via WARP.`,
    );
  }
  const duration = parseDuration(raw.session_duration);
  const maximumDuration =
    mode === "preflight"
      ? MAX_PREFLIGHT_SESSION_MILLISECONDS
      : MAX_ACTIVE_SESSION_MILLISECONDS;
  if (duration === undefined || duration > maximumDuration) {
    addFinding(
      findings,
      `application.${target}.session-duration`,
      `The ${target} application session must be positive and at most ${mode === "preflight" ? "30 minutes during preflight" : "12 hours"}.`,
    );
  }
  if (
    raw.options_preflight_bypass !== undefined &&
    raw.options_preflight_bypass !== false
  ) {
    addFinding(
      findings,
      `application.${target}.preflight-bypass`,
      `The ${target} application must not bypass OPTIONS requests.`,
    );
  }
  const mfa = isRecord(raw.mfa_config) ? raw.mfa_config : undefined;
  if (mfa?.mfa_disabled !== true) {
    addFinding(
      findings,
      `application.${target}.mfa`,
      `The ${target} application must explicitly disable independent MFA.`,
    );
  }
  if (
    raw.destinations !== undefined &&
    (!Array.isArray(raw.destinations) ||
      raw.destinations.length !== 1 ||
      !destinationIsExact(raw.destinations[0], domain))
  ) {
    addFinding(
      findings,
      `application.${target}.destination`,
      `The ${target} application destination must be the exact Pages domain without a public path.`,
    );
  }
  if (
    raw.self_hosted_domains !== undefined &&
    (!Array.isArray(raw.self_hosted_domains) ||
      raw.self_hosted_domains.length !== 1 ||
      raw.self_hosted_domains[0] !== domain)
  ) {
    addFinding(
      findings,
      `application.${target}.legacy-domain`,
      `The ${target} application legacy domain list must contain only the exact Pages domain.`,
    );
  }
  return {
    raw,
    id,
    snapshot: {
      id: id ?? null,
      domain,
      sessionDuration:
        parseDuration(raw.session_duration) !== undefined
          ? raw.session_duration
          : null,
      allowedIdps: [...allowedIdps].sort(),
      autoRedirectToIdentity:
        typeof raw.auto_redirect_to_identity === "boolean"
          ? raw.auto_redirect_to_identity
          : null,
      allowAuthenticateViaWarp:
        typeof raw.allow_authenticate_via_warp === "boolean"
          ? raw.allow_authenticate_via_warp
          : null,
      optionsPreflightBypass:
        typeof raw.options_preflight_bypass === "boolean"
          ? raw.options_preflight_bypass
          : false,
      mfaDisabled:
        typeof mfa?.mfa_disabled === "boolean" ? mfa.mfa_disabled : null,
    },
  };
}

function emailFromRule(value: unknown): string | undefined {
  if (!isRecord(value) || !exactKeys(value, ["email"]) || !isRecord(value.email)) {
    return undefined;
  }
  if (!exactKeys(value.email, ["email"]) || !safeEmailLiteral(value.email.email)) {
    return undefined;
  }
  return value.email.email;
}

function safeEmailLiteral(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 254 ||
    value !== value.trim() ||
    value !== value.toLowerCase()
  ) {
    return false;
  }
  if ([...value].some((character) => character.charCodeAt(0) <= 0x20)) {
    return false;
  }
  const separator = value.indexOf("@");
  return separator > 0 && separator === value.lastIndexOf("@") && separator < value.length - 1;
}

function isExactLoginMethodRule(value: unknown, identityProviderId: string): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, ["login_method"]) &&
    isRecord(value.login_method) &&
    exactKeys(value.login_method, ["id"]) &&
    value.login_method.id === identityProviderId
  );
}

function isExactEveryoneRule(value: unknown): boolean {
  return (
    isRecord(value) &&
    exactKeys(value, ["everyone"]) &&
    isRecord(value.everyone) &&
    exactKeys(value.everyone, [])
  );
}

function inspectPolicies(
  target: AppTarget,
  values: readonly unknown[],
  mode: AccessAuditMode,
  expectedEmails: readonly string[],
  identityProviderId: string | undefined,
  findings: AuditFinding[],
): void {
  const records = values.filter(isRecord);
  if (records.length !== values.length) {
    addFinding(
      findings,
      `policy.${target}.shape`,
      `The ${target} policy list contains an invalid record.`,
    );
  }
  if (mode === "contained") {
    if (values.length !== 1 || records.length !== 1) {
      addFinding(
        findings,
        `policy.${target}.count`,
        `The contained ${target} application must have exactly one Block Everyone policy.`,
      );
    }
    const policy = records[0];
    if (!policy) return;
    if (!safeId(policy.id)) {
      addFinding(findings, `policy.${target}.id`, `The ${target} policy ID is invalid.`);
    }
    if (policy.decision !== "deny") {
      addFinding(
        findings,
        `policy.${target}.decision`,
        `The contained ${target} policy must use the Block decision.`,
      );
    }
    if (
      !Array.isArray(policy.include) ||
      policy.include.length !== 1 ||
      !isExactEveryoneRule(policy.include[0])
    ) {
      addFinding(
        findings,
        `policy.${target}.include-rule`,
        `The contained ${target} policy must include Everyone only.`,
      );
    }
    if (!Array.isArray(policy.exclude) || policy.exclude.length !== 0) {
      addFinding(
        findings,
        `policy.${target}.exclude`,
        `The contained ${target} policy must not contain Exclude rules.`,
      );
    }
    if (!Array.isArray(policy.require) || policy.require.length !== 0) {
      addFinding(
        findings,
        `policy.${target}.require`,
        `The contained ${target} policy must not contain Require rules.`,
      );
    }
    return;
  }
  if (records.some((policy) => policy.decision !== "allow")) {
    addFinding(
      findings,
      `policy.${target}.decision`,
      `The ${target} application contains a non-Allow policy.`,
    );
  }
  if (values.length !== 1 || records.length !== 1) {
    addFinding(
      findings,
      `policy.${target}.count`,
      `The ${target} application must have exactly one Allow policy.`,
    );
  }
  const policy = records[0];
  if (!policy) return;
  if (!safeId(policy.id)) {
    addFinding(
      findings,
      `policy.${target}.id`,
      `The ${target} policy ID is invalid.`,
    );
  }
  if (policy.session_duration !== undefined) {
    const duration = parseDuration(policy.session_duration);
    const maximumDuration =
      mode === "preflight"
        ? MAX_PREFLIGHT_SESSION_MILLISECONDS
        : MAX_ACTIVE_SESSION_MILLISECONDS;
    if (duration === undefined || duration > maximumDuration) {
      addFinding(
        findings,
        `policy.${target}.session-duration`,
        `The ${target} policy session override must be positive and at most ${mode === "preflight" ? "30 minutes during preflight" : "12 hours"}.`,
      );
    }
  }
  if (
    policy.mfa_config !== undefined &&
    (!isRecord(policy.mfa_config) || policy.mfa_config.mfa_disabled !== true)
  ) {
    addFinding(
      findings,
      `policy.${target}.mfa`,
      `The ${target} policy must not enable independent MFA.`,
    );
  }
  const include = Array.isArray(policy.include) ? policy.include : [];
  const emails = include.map(emailFromRule);
  if (
    !Array.isArray(policy.include) ||
    include.length === 0 ||
    emails.some((value) => value === undefined)
  ) {
    addFinding(
      findings,
      `policy.${target}.include-rule`,
      `The ${target} policy Include rules must contain individual emails only.`,
    );
  }
  const actualEmails = emails.filter((value): value is string => value !== undefined);
  if (
    JSON.stringify([...actualEmails].sort()) !==
    JSON.stringify([...expectedEmails].sort())
  ) {
    addFinding(
      findings,
      `policy.${target}.email-set`,
      `The ${target} policy email set does not exactly match the selected audit mode.`,
    );
  }
  if (!Array.isArray(policy.exclude) || policy.exclude.length !== 0) {
    addFinding(
      findings,
      `policy.${target}.exclude`,
      `The ${target} policy must not contain Exclude rules.`,
    );
  }
  if (
    !identityProviderId ||
    !Array.isArray(policy.require) ||
    policy.require.length !== 1 ||
    !isExactLoginMethodRule(policy.require[0], identityProviderId)
  ) {
    addFinding(
      findings,
      `policy.${target}.login-method`,
      `The ${target} policy must require only the same Cloudflare login method.`,
    );
  }
}

async function inspectProbe(
  target: AppTarget,
  url: string,
  expectedHost: string,
  mode: AccessAuditMode,
  fetchImpl: CloudflareFetch,
  findings: AuditFinding[],
): Promise<ProbeEvidence> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "text/html" },
    });
  } catch {
    addFinding(
      findings,
      `probe.${target}.request`,
      `The anonymous ${target} probe request failed.`,
    );
    return { target, status: null, redirectHost: null };
  }
  const isRedirect = response.status >= 300 && response.status <= 399;
  const isContainedDenial =
    mode === "contained" &&
    (response.status === 401 || response.status === 403);
  if (!isRedirect && !isContainedDenial) {
    addFinding(
      findings,
      `probe.${target}.status`,
      mode === "contained"
        ? `The anonymous ${target} probe returned neither an Access denial nor an authentication redirect.`
        : `The anonymous ${target} probe did not return an authentication redirect.`,
    );
  }
  const location = response.headers.get("location");
  let redirectHost: string | null = null;
  let correctRedirect = false;
  if (location) {
    try {
      const parsed = new URL(location);
      redirectHost = parsed.hostname;
      correctRedirect =
        parsed.protocol === "https:" &&
        parsed.hostname === expectedHost &&
        parsed.port === "" &&
        parsed.username === "" &&
        parsed.password === "";
    } catch {
      correctRedirect = false;
    }
  }
  if (!isContainedDenial && !correctRedirect) {
    addFinding(
      findings,
      `probe.${target}.redirect`,
      `The anonymous ${target} probe did not redirect to the expected Access team host.`,
    );
  }
  return { target, status: response.status, redirectHost };
}

export async function auditAccess(
  inputConfig: HostedOperatorConfig,
  mode: AccessAuditMode,
  fetchImpl: CloudflareFetch = fetch,
): Promise<AuditResult> {
  if (!ACCESS_MODES.has(mode)) fail("audit mode is invalid");
  const config = validateOperatorConfig(inputConfig);
  const startedAt = new Date().toISOString();
  const findings: AuditFinding[] = [];
  const [identityProviders, applications] = await Promise.all([
    listCloudflareIdentityProviders(config.accountId, fetchImpl),
    listCloudflareAccessApplications(config.accountId, fetchImpl),
  ]);
  if (applications.length !== 2 || applications.some((item) => !isRecord(item))) {
    addFinding(
      findings,
      "application.count",
      "The dedicated account must contain exactly the root and wildcard Access applications.",
    );
  }
  const identityProvider = inspectIdentityProvider(identityProviders, findings);
  const rootDomain = `${config.projectName}.pages.dev`;
  const wildcardDomain = `*.${rootDomain}`;
  const root = inspectApplication(
    "root",
    applications,
    rootDomain,
    identityProvider.id,
    mode,
    findings,
  );
  const wildcard = inspectApplication(
    "wildcard",
    applications,
    wildcardDomain,
    identityProvider.id,
    mode,
    findings,
  );
  const [rootPolicies, wildcardPolicies] = await Promise.all([
    root.id
      ? listCloudflareAccessPolicies(config.accountId, root.id, fetchImpl)
      : Promise.resolve([]),
    wildcard.id
      ? listCloudflareAccessPolicies(config.accountId, wildcard.id, fetchImpl)
      : Promise.resolve([]),
  ]);
  const expectedEmails =
    mode === "preflight"
      ? [config.operatorEmail]
      : mode === "active"
        ? config.approvedEmails
        : [];
  inspectPolicies(
    "root",
    rootPolicies,
    mode,
    expectedEmails,
    identityProvider.id,
    findings,
  );
  inspectPolicies(
    "wildcard",
    wildcardPolicies,
    mode,
    expectedEmails,
    identityProvider.id,
    findings,
  );
  const probes = await Promise.all([
    inspectProbe(
      "root",
      `https://${rootDomain}/`,
      `${config.teamName}.cloudflareaccess.com`,
      mode,
      fetchImpl,
      findings,
    ),
    inspectProbe(
      "wildcard",
      `https://probe.${rootDomain}/`,
      `${config.teamName}.cloudflareaccess.com`,
      mode,
      fetchImpl,
      findings,
    ),
  ]);
  const configSnapshot: AccessConfigSnapshot = {
    idp: identityProvider.snapshot,
    rootApp: root.snapshot,
    wildcardApp: wildcard.snapshot,
    policies: {
      root: canonicalPolicies(rootPolicies),
      wildcard: canonicalPolicies(wildcardPolicies),
    },
  };
  findings.sort((left, right) =>
    left.code < right.code ? -1 : left.code > right.code ? 1 : 0,
  );
  const ok = findings.length === 0;
  const auditEvidence: AccessAuditEvidence = {
    mode,
    startedAt,
    completedAt: new Date().toISOString(),
    ok,
    findings: findings.map((finding) => ({ ...finding })),
    probes,
    configSnapshotSha256: sha256Canonical(configSnapshot),
  };
  return { ok, findings, configSnapshot, auditEvidence };
}

export function parseAccessAuditArgs(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): { mode: AccessAuditMode; configPath: string } {
  let mode: AccessAuditMode | undefined;
  let configPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || !flag || !["--mode", "--config"].includes(flag)) {
      fail("usage: private-hosted:audit -- --mode <preflight|active|contained> [--config <absolute-path>]");
    }
    if (flag === "--mode") {
      if (mode || !ACCESS_MODES.has(value as AccessAuditMode)) {
        fail("usage: private-hosted:audit -- --mode <preflight|active|contained> [--config <absolute-path>]");
      }
      mode = value as AccessAuditMode;
    } else {
      if (configPath) fail("config path may be supplied only once");
      if (!isAbsolute(value)) fail("config path must be absolute");
      configPath = resolve(value);
    }
    index += 1;
  }
  if (!mode) {
    fail("usage: private-hosted:audit -- --mode <preflight|active|contained> [--config <absolute-path>]");
  }
  return {
    mode,
    configPath: configPath ?? defaultOperatorConfigPath(environment),
  };
}

export async function runAccessAuditCli(
  args: readonly string[] = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const parsed = parseAccessAuditArgs(args, environment);
  const token = environment.CLOUDFLARE_API_TOKEN;
  if (!token) fail("CLOUDFLARE_API_TOKEN is required");
  const config = await loadOperatorConfig(parsed.configPath, {
    repoRoot: MODULE_REPOSITORY_ROOT,
  });
  const result = await auditAccess(
    config,
    parsed.mode,
    createCloudflareApiFetch(token),
  );
  process.stdout.write(`${JSON.stringify(result.auditEvidence, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runAccessAuditCli();
}
