import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_NAME = "conan-private-7302df07";
const ACCOUNT_ID = "8b2b1b63c5cf8d5c49dcc608b730dd10";
const ACCESS_TEAM_NAME = "steep-mouse-bb22";
const PRODUCTION_BRANCH = "main";
const STABLE_URL = `https://${PROJECT_NAME}.pages.dev/`;
const WILDCARD_PROBE_URL = `https://access-preflight.${PROJECT_NAME}.pages.dev/`;
const ACCESS_ORIGIN = "https://steep-mouse-bb22.cloudflareaccess.com";
const API_BASE = "https://api.cloudflare.com/client/v4";
const DATABASE_ID = "4ee3b0b4-560a-46b9-9e9f-17dd394fc291";
const COMPATIBILITY_DATE = "2026-08-10";
const MODULE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SHA256 = /^[0-9a-f]{64}$/;
const PAGES_HASH = /^[0-9a-f]{32}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SAFE_PATH = /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;
const MAX_ASSET_COUNT = 20_000;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BUCKET_BYTES = 40 * 1024 * 1024;
const MAX_UPLOAD_BUCKET_FILES = process.platform === "win32" ? 1_000 : 2_000;
const MAX_API_RESPONSE_BYTES = 1024 * 1024;
const API_TIMEOUT_MS = 20_000;
const MAX_APPROVED_EMAILS = 12;
const MAX_ACCESS_SESSION_MS = 12 * 60 * 60 * 1_000;
const TEST_DEPLOY_TOKEN = "conan-qualified-deploy-test-token";
const ACCESS_ID = /^[0-9a-f-]{1,64}$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const OPERATOR_CONFIG_KEYS = [
  "accountId",
  "approvedEmails",
  "operatorEmail",
  "projectName",
  "schemaVersion",
  "teamName",
];
const CONTENT_TYPES = new Map([
  ["css", "text/css"],
  ["html", "text/html"],
  ["ico", "image/vnd.microsoft.icon"],
  ["js", "application/javascript"],
  ["json", "application/json"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["webp", "image/webp"],
]);
const QUALIFICATION_COMMAND_IDS = [
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
const REPORT_KEYS = [
  "bugGateSha256",
  "commands",
  "completedAt",
  "destinationFindings",
  "packageLockSha256",
  "pagesDeploymentSha256",
  "releaseCommit",
  "responseManifestSha256",
  "schemaVersion",
  "secretFindings",
  "startedAt",
  "uploadManifestSha256",
];
const EXPECTED_VARS = {
  ACCESS_TEAM_DOMAIN: ACCESS_ORIGIN,
  ACCESS_AUD:
    "804dd12e524e3dfd51dd950d3db03b610e415e7e5c71f0300f82a0ccd269c007",
  DEPLOYMENT_ENV: "production",
  APP_HOST_KIND: "exact",
  APP_HOST_VALUE: `${PROJECT_NAME}.pages.dev`,
  D1_DATABASE_ID: DATABASE_ID,
};
const REQUIRED_SECRET_VAR = "EMAIL_KEY_SECRET";

function fail(message) {
  throw new Error(`qualified private hosted deploy rejected: ${message}`);
}

function record(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, expected, label) {
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify([...expected].sort())
  ) {
    fail(`${label} fields must match the exact schema`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function within(root, candidate) {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

function samePath(left, right) {
  return process.platform === "win32"
    ? resolve(left).toLowerCase() === resolve(right).toLowerCase()
    : resolve(left) === resolve(right);
}

function fixedGitPath() {
  return process.platform === "win32"
    ? resolve(dirname(process.execPath), "..", "Git", "cmd", "git.exe")
    : "/usr/bin/git";
}

function fixedPowerShellPath() {
  return process.platform === "win32"
    ? "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    : "/usr/bin/pwsh";
}

function npmCliPath() {
  return resolve(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  );
}

function qualificationArgvContract(repoRoot, runDir) {
  const npm = (...args) => [process.execPath, npmCliPath(), ...args];
  const run = (script) => npm("run", "--silent", script);
  return new Map([
    ["npm-ci", npm("ci")],
    ["card-identities", run("check:meta-card-identities")],
    ["build", run("build:meta")],
    ["dependency-audit", npm("audit", "--audit-level=high")],
    ["bug-gate", run("private-hosted:bug-gate")],
    ["typecheck", run("typecheck")],
    ["lint", run("lint")],
    ["unit", run("test")],
    ["smoke", run("smoke:1000")],
    ["dev-e2e", run("test:e2e")],
    ["docs", run("docs")],
    ["docs-check", run("docs:check")],
    ["advanced-boundary", run("private-hosted:boundary:advanced")],
    [
      "prepare-release",
      [
        fixedPowerShellPath(),
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
      ],
    ],
    ["secret-scan", run("private-hosted:scan-secrets")],
    ["destination-scan", run("private-hosted:scan-destinations")],
    ["prepared-private-e2e", run("test:e2e:private-hosted:prepared")],
    [
      "clean-tree-check",
      [fixedGitPath(), "status", "--porcelain=v1", "--untracked-files=all"],
    ],
  ]);
}

function assertQualificationArgv(report, repoRoot, runDir) {
  const contract = qualificationArgvContract(repoRoot, runDir);
  for (const command of report.commands) {
    const expected = contract.get(command.id);
    if (
      !expected ||
      JSON.stringify(command.argv) !== JSON.stringify(expected)
    ) {
      fail(`qualification command ${command.id} argv differs from contract`);
    }
  }
}

function checkedHash(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    fail(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function checkedTime(value, label) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    fail(`${label} must be a UTC timestamp`);
  }
  return value;
}

function checkedEmail(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 254 ||
    value !== value.trim() ||
    value !== value.toLowerCase() ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 0x20 || code === 0x7f;
    })
  ) {
    fail(`${label} must be a lowercase exact email`);
  }
  const separator = value.indexOf("@");
  if (separator <= 0 || separator !== value.lastIndexOf("@")) {
    fail(`${label} must be a lowercase exact email`);
  }
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  if (
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.length > 253 ||
    !domain.includes(".") ||
    domain.split(".").some((part) => !DNS_LABEL.test(part))
  ) {
    fail(`${label} must be a lowercase exact email`);
  }
  return value;
}

function validateDeployOperatorConfig(candidate) {
  const config = record(candidate, "operator config");
  exactKeys(config, OPERATOR_CONFIG_KEYS, "operator config");
  if (
    config.schemaVersion !== 1 ||
    config.accountId !== ACCOUNT_ID ||
    config.projectName !== PROJECT_NAME ||
    config.teamName !== ACCESS_TEAM_NAME
  ) {
    fail("operator config differs from the fixed deployment identity");
  }
  const operatorEmail = checkedEmail(
    config.operatorEmail,
    "operator config operatorEmail",
  );
  if (
    !Array.isArray(config.approvedEmails) ||
    config.approvedEmails.length === 0 ||
    config.approvedEmails.length > MAX_APPROVED_EMAILS
  ) {
    fail("operator config approvedEmails is invalid");
  }
  const approvedEmails = config.approvedEmails.map((email, index) =>
    checkedEmail(email, `operator config approvedEmails[${index}]`),
  );
  if (
    new Set(approvedEmails).size !== approvedEmails.length ||
    !approvedEmails.includes(operatorEmail)
  ) {
    fail("operator config approvedEmails is invalid");
  }
  return {
    schemaVersion: 1,
    accountId: ACCOUNT_ID,
    projectName: PROJECT_NAME,
    teamName: ACCESS_TEAM_NAME,
    operatorEmail,
    approvedEmails: [...approvedEmails].sort(),
  };
}

async function loadDeployOperatorConfig(environment = process.env) {
  const localAppData = environment.LOCALAPPDATA;
  if (typeof localAppData !== "string" || !isAbsolute(localAppData)) {
    fail("operator config directory is unavailable");
  }
  const path = resolve(localAppData, "ConanPrivateHosted", "operator.json");
  const bytes = await readRegular(path, "operator config");
  return validateDeployOperatorConfig(parseJson(bytes, "operator config"));
}

function accessDuration(value) {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const units = {
    ns: 0.000001,
    us: 0.001,
    μs: 0.001,
    µs: 0.001,
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
  };
  const part = /(\d+(?:\.\d+)?)(ns|us|μs|µs|ms|s|m|h)/gy;
  let offset = 0;
  let total = 0;
  while (offset < value.length) {
    part.lastIndex = offset;
    const match = part.exec(value);
    if (!match || match.index !== offset) return undefined;
    const amount = Number(match[1]);
    const multiplier = units[match[2]];
    if (!Number.isFinite(amount) || amount < 0 || multiplier === undefined) {
      return undefined;
    }
    total += amount * multiplier;
    offset = part.lastIndex;
  }
  return Number.isFinite(total) && total > 0 ? total : undefined;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : bytes);
  } catch {
    return fail(`${label} must be valid JSON`);
  }
}

async function readRegular(path, label) {
  const stat = await lstat(path).catch(() => fail(`${label} does not exist`));
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${label} must be a regular file`);
  }
  const canonical = await realpath(path);
  if (!samePath(canonical, path)) fail(`${label} path is not canonical`);
  return readFile(path);
}

async function regularDirectory(path, label) {
  const stat = await lstat(path).catch(() => fail(`${label} does not exist`));
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`${label} must be a regular directory`);
  }
  const canonical = await realpath(path);
  if (!samePath(canonical, path)) fail(`${label} path is not canonical`);
  return canonical;
}

function checkedEntry(candidate, label) {
  const value = record(candidate, label);
  exactKeys(value, ["bytes", "path", "sha256"], label);
  if (typeof value.path !== "string" || !SAFE_PATH.test(value.path)) {
    fail(`${label}.path is invalid`);
  }
  if (!Number.isSafeInteger(value.bytes) || value.bytes < 0) {
    fail(`${label}.bytes is invalid`);
  }
  return {
    path: value.path,
    bytes: value.bytes,
    sha256: checkedHash(value.sha256, `${label}.sha256`),
  };
}

function parseManifest(candidate, label) {
  const value = record(candidate, label);
  exactKeys(value, ["files", "schemaVersion"], label);
  if (value.schemaVersion !== 1 || !Array.isArray(value.files)) {
    fail(`${label} schema is invalid`);
  }
  let previous = "";
  return value.files.map((entry, index) => {
    const parsed = checkedEntry(entry, `${label}.files[${index}]`);
    if (parsed.path <= previous) fail(`${label} must be sorted and unique`);
    previous = parsed.path;
    return parsed;
  });
}

function validateReport(candidate) {
  const report = record(candidate, "qualification report");
  exactKeys(report, REPORT_KEYS, "qualification report");
  if (report.schemaVersion !== 3)
    fail("qualification report schema is invalid");
  if (
    typeof report.releaseCommit !== "string" ||
    !COMMIT.test(report.releaseCommit)
  ) {
    fail("qualification release commit is invalid");
  }
  for (const key of [
    "packageLockSha256",
    "uploadManifestSha256",
    "responseManifestSha256",
    "pagesDeploymentSha256",
    "bugGateSha256",
  ]) {
    checkedHash(report[key], `qualification ${key}`);
  }
  checkedTime(report.startedAt, "qualification startedAt");
  checkedTime(report.completedAt, "qualification completedAt");
  if (
    !Array.isArray(report.secretFindings) ||
    report.secretFindings.length !== 0 ||
    !Array.isArray(report.destinationFindings) ||
    report.destinationFindings.length !== 0
  ) {
    fail("qualification findings must be empty");
  }
  if (
    !Array.isArray(report.commands) ||
    report.commands.length !== QUALIFICATION_COMMAND_IDS.length
  ) {
    fail("qualification command order is invalid");
  }
  for (const [index, candidateCommand] of report.commands.entries()) {
    const command = record(candidateCommand, `qualification command ${index}`);
    const id = QUALIFICATION_COMMAND_IDS[index];
    const expected = [
      "argv",
      "completedAt",
      "exitCode",
      "id",
      "log",
      "startedAt",
    ];
    if (id === "prepared-private-e2e") expected.push("preparedInputs");
    exactKeys(command, expected, `qualification command ${id}`);
    if (
      command.id !== id ||
      command.exitCode !== 0 ||
      !Array.isArray(command.argv) ||
      command.argv.length === 0 ||
      command.argv.some((item) => typeof item !== "string" || item.length === 0)
    ) {
      fail(`qualification command ${id} is invalid`);
    }
    checkedTime(command.startedAt, `${id} startedAt`);
    checkedTime(command.completedAt, `${id} completedAt`);
    const log = record(command.log, `${id} log`);
    exactKeys(log, ["bytes", "path", "sha256"], `${id} log`);
    if (
      typeof log.path !== "string" ||
      !/^logs\/\d{2}-[a-z0-9-]+\.log$/.test(log.path) ||
      !Number.isSafeInteger(log.bytes) ||
      log.bytes <= 0
    ) {
      fail(`${id} log is invalid`);
    }
    checkedHash(log.sha256, `${id} log hash`);
    if (id === "prepared-private-e2e") {
      const prepared = record(command.preparedInputs, "prepared inputs");
      exactKeys(
        prepared,
        [
          "mode",
          "pagesDeploymentSha256",
          "postStopStagingMatch",
          "responseManifestSha256",
          "stagingRealpath",
          "uploadManifestSha256",
        ],
        "prepared inputs",
      );
      if (
        prepared.mode !== "prepared" ||
        prepared.postStopStagingMatch !== true ||
        !isAbsolute(prepared.stagingRealpath) ||
        prepared.uploadManifestSha256 !== report.uploadManifestSha256 ||
        prepared.responseManifestSha256 !== report.responseManifestSha256 ||
        prepared.pagesDeploymentSha256 !== report.pagesDeploymentSha256
      ) {
        fail("prepared inputs differ from qualification evidence");
      }
    }
  }
  return report;
}

function validateDeploymentEvidence(candidate) {
  const evidence = record(candidate, "Pages deployment evidence");
  exactKeys(
    evidence,
    [
      "assets",
      "headersPath",
      "pagesBuildOutputDir",
      "productionBranch",
      "projectName",
      "routesPath",
      "schemaVersion",
      "worker",
      "wranglerConfigSha256",
    ],
    "Pages deployment evidence",
  );
  if (
    evidence.schemaVersion !== 1 ||
    evidence.projectName !== PROJECT_NAME ||
    evidence.productionBranch !== PRODUCTION_BRANCH ||
    evidence.pagesBuildOutputDir !== "dist" ||
    evidence.headersPath !== "/_headers" ||
    evidence.routesPath !== "/_routes.json"
  ) {
    fail("Pages deployment identity is invalid");
  }
  checkedHash(evidence.wranglerConfigSha256, "wrangler config hash");
  if (!Array.isArray(evidence.assets)) fail("Pages assets are invalid");
  let previous = "";
  const assets = evidence.assets.map((candidateAsset, index) => {
    const asset = record(candidateAsset, `Pages asset ${index}`);
    exactKeys(
      asset,
      ["bytes", "contentType", "pagesHash", "path", "sha256"],
      `Pages asset ${index}`,
    );
    const entry = checkedEntry(
      { path: asset.path, bytes: asset.bytes, sha256: asset.sha256 },
      `Pages asset ${index}`,
    );
    if (entry.path <= previous || entry.path.startsWith("/_")) {
      fail("Pages assets must be sorted, unique, and static");
    }
    previous = entry.path;
    if (
      typeof asset.pagesHash !== "string" ||
      !PAGES_HASH.test(asset.pagesHash) ||
      typeof asset.contentType !== "string" ||
      !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(asset.contentType)
    ) {
      fail(`Pages asset ${index} metadata is invalid`);
    }
    return {
      ...entry,
      pagesHash: asset.pagesHash,
      contentType: asset.contentType,
    };
  });
  const worker = record(evidence.worker, "Pages worker");
  exactKeys(
    worker,
    [
      "bindings",
      "bytes",
      "compatibilityDate",
      "compatibilityFlags",
      "contentType",
      "mainModule",
      "path",
      "sha256",
    ],
    "Pages worker",
  );
  const workerEntry = checkedEntry(
    { path: worker.path, bytes: worker.bytes, sha256: worker.sha256 },
    "Pages worker",
  );
  const expectedBindings = [
    ...Object.entries(EXPECTED_VARS).map(([name, text]) => ({
      name,
      type: "plain_text",
      text,
    })),
    { name: "DB", type: "d1", id: DATABASE_ID },
  ];
  if (
    workerEntry.path !== "/_worker.js" ||
    worker.mainModule !== "_worker.js" ||
    worker.contentType !== "application/javascript+module" ||
    worker.compatibilityDate !== COMPATIBILITY_DATE ||
    !Array.isArray(worker.compatibilityFlags) ||
    worker.compatibilityFlags.length !== 0 ||
    JSON.stringify(worker.bindings) !== JSON.stringify(expectedBindings)
  ) {
    fail("Pages worker metadata differs from production contract");
  }
  return {
    ...evidence,
    assets,
    worker: { ...workerEntry, ...worker },
  };
}

async function listFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const absolute = resolve(current, entry.name);
    if (entry.isSymbolicLink()) fail("staging must not contain symbolic links");
    if (entry.isDirectory()) result.push(...(await listFiles(root, absolute)));
    else if (entry.isFile())
      result.push(`/${relative(root, absolute).split(sep).join("/")}`);
    else fail("staging contains a non-regular entry");
  }
  return result.sort();
}

async function loadQualifiedSnapshot(repoRoot, runDir) {
  const repo = await regularDirectory(repoRoot, "repository root");
  const run = await regularDirectory(runDir, "qualification run directory");
  if (within(repo, run))
    fail("qualification run must remain outside repository");
  const paths = {
    report: resolve(run, "qualification-report.json"),
    upload: resolve(run, "evidence/upload-manifest.json"),
    response: resolve(run, "evidence/response-manifest.json"),
    deployment: resolve(run, "evidence/pages-deployment.json"),
    staging: resolve(run, "staging"),
    logs: resolve(run, "logs"),
    packageLock: resolve(repo, "package-lock.json"),
  };
  const staging = await regularDirectory(paths.staging, "qualified staging");
  const logs = await regularDirectory(paths.logs, "qualification logs");
  const [reportBytes, uploadBytes, responseBytes, deploymentBytes, lockBytes] =
    await Promise.all([
      readRegular(paths.report, "qualification report"),
      readRegular(paths.upload, "upload manifest"),
      readRegular(paths.response, "response manifest"),
      readRegular(paths.deployment, "Pages deployment evidence"),
      readRegular(paths.packageLock, "package-lock.json"),
    ]);
  const report = validateReport(parseJson(reportBytes, "qualification report"));
  assertQualificationArgv(report, repo, run);
  if (
    sha256(uploadBytes) !== report.uploadManifestSha256 ||
    sha256(responseBytes) !== report.responseManifestSha256 ||
    sha256(deploymentBytes) !== report.pagesDeploymentSha256 ||
    sha256(lockBytes) !== report.packageLockSha256
  ) {
    fail("qualified evidence bytes differ from report");
  }
  const upload = parseManifest(
    parseJson(uploadBytes, "upload manifest"),
    "upload manifest",
  );
  const response = parseManifest(
    parseJson(responseBytes, "response manifest"),
    "response manifest",
  );
  const expectedResponse = upload.filter(
    ({ path }) => !["/_headers", "/_routes.json", "/_worker.js"].includes(path),
  );
  if (JSON.stringify(response) !== JSON.stringify(expectedResponse)) {
    fail("response manifest differs from upload manifest");
  }
  const deployment = validateDeploymentEvidence(
    parseJson(deploymentBytes, "Pages deployment evidence"),
  );
  if (
    JSON.stringify(
      deployment.assets.map(({ path, bytes, sha256: hash }) => ({
        path,
        bytes,
        sha256: hash,
      })),
    ) !== JSON.stringify(response) ||
    JSON.stringify(upload.find(({ path }) => path === "/_worker.js")) !==
      JSON.stringify({
        path: deployment.worker.path,
        bytes: deployment.worker.bytes,
        sha256: deployment.worker.sha256,
      })
  ) {
    fail("Pages deployment evidence differs from qualified manifests");
  }
  const prepared = report.commands.find(
    ({ id }) => id === "prepared-private-e2e",
  ).preparedInputs;
  if (!samePath(prepared.stagingRealpath, staging)) {
    fail("report staging path differs from qualification run");
  }
  for (const command of report.commands) {
    const path = resolve(run, command.log.path);
    if (!within(logs, path)) fail("qualification log escapes logs directory");
    const bytes = await readRegular(path, `${command.id} log`);
    if (
      bytes.byteLength !== command.log.bytes ||
      sha256(bytes) !== command.log.sha256
    ) {
      fail(`${command.id} log differs from qualification report`);
    }
    if (
      command.id === "bug-gate" &&
      command.log.sha256 !== report.bugGateSha256
    ) {
      fail("bug-gate evidence differs from qualification report");
    }
  }
  const actualFiles = await listFiles(staging);
  if (
    JSON.stringify(actualFiles) !==
    JSON.stringify(upload.map(({ path }) => path))
  ) {
    fail("staging file set differs from upload manifest");
  }
  const files = new Map();
  for (const entry of upload) {
    const path = resolve(staging, entry.path.slice(1));
    if (!within(staging, path)) fail(`staging path escapes: ${entry.path}`);
    const bytes = await readRegular(path, `staged ${entry.path}`);
    if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.sha256) {
      fail(`staged bytes differ from manifest: ${entry.path}`);
    }
    files.set(entry.path, Buffer.from(bytes));
  }
  if (deployment.assets.length > MAX_ASSET_COUNT) {
    fail("Pages asset count exceeds the qualified limit");
  }
  const hashOwners = new Map();
  for (const asset of deployment.assets) {
    const bytes = files.get(asset.path);
    if (!bytes || bytes.byteLength > MAX_ASSET_BYTES) {
      fail(`Pages asset exceeds the per-file limit: ${asset.path}`);
    }
    const expectedPagesHash = sha256(bytes).slice(0, 32);
    if (asset.pagesHash !== expectedPagesHash) {
      fail(`Pages asset hash differs from qualified bytes: ${asset.path}`);
    }
    const extension = asset.path.includes(".")
      ? asset.path.slice(asset.path.lastIndexOf(".") + 1).toLowerCase()
      : "";
    const expectedContentType =
      CONTENT_TYPES.get(extension) ?? "application/octet-stream";
    if (asset.contentType !== expectedContentType) {
      fail(`Pages asset content type differs: ${asset.path}`);
    }
    const owner = hashOwners.get(asset.pagesHash);
    if (
      owner &&
      (owner.sha256 !== asset.sha256 || owner.contentType !== asset.contentType)
    ) {
      fail(`Pages asset hash has conflicting owners: ${asset.pagesHash}`);
    }
    hashOwners.set(asset.pagesHash, asset);
  }
  return { repo, run, report, upload, response, deployment, files };
}

export function qualificationEnvironment(source = process.env) {
  const allowed = [
    "APPDATA",
    "ComSpec",
    "HOME",
    "LOCALAPPDATA",
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "SystemRoot",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "WINDIR",
  ];
  const result = { CI: "1" };
  for (const key of allowed)
    if (source[key] !== undefined) result[key] = source[key];
  return result;
}

async function spawnCaptured(file, args, options) {
  const child = spawn(file, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
  child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
  const exitCode = await new Promise((done, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) reject(new Error(`child exited by signal ${signal}`));
      else done(code ?? 1);
    });
  });
  return {
    exitCode,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}

async function qualify(repoRoot) {
  const result = await spawnCaptured(
    process.execPath,
    [
      resolve(repoRoot, "node_modules/tsx/dist/cli.mjs"),
      resolve(repoRoot, "scripts/private-hosted/run-final-qualification.ts"),
    ],
    { cwd: repoRoot, env: qualificationEnvironment() },
  );
  if (result.exitCode !== 0 || result.stderr !== "") {
    fail("final qualification failed");
  }
  const lines = result.stdout.trim().split(/\r?\n/);
  if (lines.length !== 1 || !isAbsolute(lines[0])) {
    fail("final qualification did not return one absolute run directory");
  }
  return resolve(lines[0]);
}

async function git(repoRoot, args) {
  const executable =
    process.platform === "win32"
      ? resolve(dirname(process.execPath), "..", "Git", "cmd", "git.exe")
      : "/usr/bin/git";
  const result = await spawnCaptured(executable, args, {
    cwd: repoRoot,
    env: qualificationEnvironment(),
  });
  if (result.exitCode !== 0 || result.stderr !== "")
    fail("Git verification failed");
  return result.stdout;
}

async function apiEnvelope(fetchImpl, url, init, label) {
  if (!url.startsWith(`${API_BASE}/`))
    fail(`${label} URL is outside Cloudflare API`);
  const response = await fetchImpl(url, {
    ...init,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      response.headers.get("content-type") ?? "",
    )
  ) {
    fail(`${label} response must be JSON`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_API_RESPONSE_BYTES
  ) {
    fail(`${label} response is too large`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_API_RESPONSE_BYTES) {
    fail(`${label} response is too large`);
  }
  const payload = parseJson(text, label);
  const envelope = record(payload, label);
  const errors = envelope.errors;
  if (
    !response.ok ||
    envelope.success !== true ||
    (errors !== undefined && (!Array.isArray(errors) || errors.length !== 0))
  ) {
    fail(`${label} failed`);
  }
  return envelope;
}

async function apiJson(fetchImpl, url, init, label) {
  return (await apiEnvelope(fetchImpl, url, init, label)).result;
}

async function apiList(fetchImpl, url, token, label) {
  const target = new URL(url);
  target.searchParams.set("page", "1");
  target.searchParams.set("per_page", "1000");
  const envelope = await apiEnvelope(
    fetchImpl,
    target.href,
    { headers: authorization(token) },
    label,
  );
  if (!Array.isArray(envelope.result)) fail(`${label} result must be an array`);
  const info = record(envelope.result_info, `${label} pagination`);
  if (info.page !== 1 || info.per_page !== 1_000 || info.total_pages !== 1) {
    fail(`${label} pagination is not a complete single page`);
  }
  return envelope.result;
}

function authorization(token) {
  return { Authorization: `Bearer ${token}` };
}

function accessId(value, label) {
  if (typeof value !== "string" || !ACCESS_ID.test(value)) {
    fail(`${label} id is invalid`);
  }
  return value;
}

function validateAccessApplication(
  candidate,
  expectedId,
  domain,
  identityProviderId,
  label,
  organizationMfaDisabled,
) {
  const app = record(candidate, `${label} Access application`);
  const id = accessId(app.id, `${label} Access application`);
  if (id !== expectedId) {
    fail(`${label} Access application detail differs from list identity`);
  }
  if (
    app.type !== "self_hosted" ||
    app.domain !== domain ||
    !Array.isArray(app.allowed_idps) ||
    app.allowed_idps.length !== 1 ||
    app.allowed_idps[0] !== identityProviderId ||
    app.auto_redirect_to_identity !== true ||
    app.allow_authenticate_via_warp !== false
  ) {
    fail(
      `${label} Access application differs from the private-hosted contract`,
    );
  }
  const duration = accessDuration(app.session_duration);
  if (duration === undefined || duration > MAX_ACCESS_SESSION_MS) {
    fail(`${label} Access application session exceeds 12 hours`);
  }
  if (
    app.options_preflight_bypass !== undefined &&
    app.options_preflight_bypass !== false
  ) {
    fail(`${label} Access application bypasses OPTIONS`);
  }
  if (app.mfa_config === undefined || app.mfa_config === null) {
    if (!organizationMfaDisabled) {
      fail(`${label} Access application inherits organization MFA`);
    }
  } else {
    const mfa = record(
      app.mfa_config,
      `${label} Access application mfa_config`,
    );
    if (mfa.mfa_disabled !== true) {
      fail(`${label} Access application enables independent MFA`);
    }
  }
  if (app.destinations !== undefined) {
    if (!Array.isArray(app.destinations) || app.destinations.length !== 1) {
      fail(`${label} Access application destination differs`);
    }
    const destination = record(
      app.destinations[0],
      `${label} Access application destination`,
    );
    exactKeys(
      destination,
      ["type", "uri"],
      `${label} Access application destination`,
    );
    if (destination.type !== "public" || destination.uri !== domain) {
      fail(`${label} Access application destination differs`);
    }
  }
  if (
    app.self_hosted_domains !== undefined &&
    (!Array.isArray(app.self_hosted_domains) ||
      app.self_hosted_domains.length !== 1 ||
      app.self_hosted_domains[0] !== domain)
  ) {
    fail(`${label} Access application legacy domain differs`);
  }
  return id;
}

function validateAccessOrganization(candidate) {
  const organization = record(candidate, "Access organization");
  const mfaConfig = organization.mfa_config;
  if (
    (organization.mfa_required_for_all_apps !== undefined &&
      organization.mfa_required_for_all_apps !== null &&
      organization.mfa_required_for_all_apps !== false) ||
    (mfaConfig !== undefined &&
      mfaConfig !== null &&
      (typeof mfaConfig !== "object" || Array.isArray(mfaConfig)))
  ) {
    fail("Access organization MFA must be disabled");
  }
  if (organization.allow_authenticate_via_warp !== false) {
    fail("Access organization WARP authentication must be disabled");
  }
  return true;
}

function policyEmail(candidate) {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return undefined;
  }
  if (
    JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(["email"])
  ) {
    return undefined;
  }
  const nested = candidate.email;
  if (typeof nested !== "object" || nested === null || Array.isArray(nested)) {
    return undefined;
  }
  if (
    JSON.stringify(Object.keys(nested).sort()) !== JSON.stringify(["email"])
  ) {
    return undefined;
  }
  try {
    return checkedEmail(nested.email, "Access policy email");
  } catch {
    return undefined;
  }
}

function validateAccessPolicy(values, approvedEmails, label) {
  if (!Array.isArray(values) || values.length !== 1) {
    fail(`${label} Access application must have exactly one policy`);
  }
  const policy = record(values[0], `${label} Access policy`);
  accessId(policy.id, `${label} Access policy`);
  if (policy.decision !== "allow") {
    fail(`${label} Access policy must use Allow`);
  }
  if (!Array.isArray(policy.include) || policy.include.length === 0) {
    fail(`${label} Access policy must include approved emails only`);
  }
  const emails = policy.include.map(policyEmail);
  if (
    emails.some((email) => email === undefined) ||
    JSON.stringify([...emails].sort()) !== JSON.stringify(approvedEmails)
  ) {
    fail(`${label} Access policy email set differs`);
  }
  if (
    !Array.isArray(policy.exclude) ||
    policy.exclude.length !== 0 ||
    !Array.isArray(policy.require) ||
    policy.require.length !== 0
  ) {
    fail(`${label} Access policy broadens authentication`);
  }
  if (policy.session_duration !== undefined) {
    const duration = accessDuration(policy.session_duration);
    if (duration === undefined || duration > MAX_ACCESS_SESSION_MS) {
      fail(`${label} Access policy session exceeds 12 hours`);
    }
  }
  if (policy.mfa_config !== undefined) {
    const mfa = record(policy.mfa_config, `${label} Access policy mfa_config`);
    if (mfa.mfa_disabled !== true) {
      fail(`${label} Access policy enables independent MFA`);
    }
  }
}

async function validateActiveAccess(fetchImpl, token, config) {
  const base = `${API_BASE}/accounts/${ACCOUNT_ID}/access`;
  const [identityProviders, applications, organizationValue] =
    await Promise.all([
      apiList(
        fetchImpl,
        `${base}/identity_providers`,
        token,
        "Access identity providers",
      ),
      apiList(fetchImpl, `${base}/apps`, token, "Access applications"),
      apiJson(
        fetchImpl,
        `${base}/organizations`,
        { headers: authorization(token) },
        "Access organization",
      ),
    ]);
  const parsedIdentityProviders = identityProviders.map((candidate) =>
    record(candidate, "Access identity provider"),
  );
  const oneTimePinProviders = parsedIdentityProviders.filter(
    (candidate) => candidate.type === "onetimepin",
  );
  // New Zero Trust organizations expose one immutable Cloudflare provider.
  // It remains unusable here because each application is pinned to the OTP ID below.
  const builtInCloudflareProviders = parsedIdentityProviders.filter(
    (candidate) => candidate.type === "cloudflare",
  );
  if (oneTimePinProviders.length !== 1) {
    fail("Access must have exactly one one-time PIN identity provider");
  }
  if (
    builtInCloudflareProviders.length > 1 ||
    parsedIdentityProviders.length !==
      oneTimePinProviders.length + builtInCloudflareProviders.length
  ) {
    fail("Access has unsupported identity providers");
  }
  for (const provider of builtInCloudflareProviders) {
    accessId(provider.id, "built-in Cloudflare identity provider");
  }
  const identityProvider = record(
    oneTimePinProviders[0],
    "Access identity provider",
  );
  const identityProviderId = accessId(
    identityProvider.id,
    "Access identity provider",
  );
  if (identityProvider.type !== "onetimepin") {
    fail("Access identity provider must be one-time PIN");
  }
  if (applications.length !== 2) {
    fail("Access must have exactly two applications");
  }
  const organizationMfaDisabled = validateAccessOrganization(organizationValue);
  const rootDomain = `${PROJECT_NAME}.pages.dev`;
  const wildcardDomain = `*.${rootDomain}`;
  const rootMatches = applications.filter(
    (candidate) =>
      record(candidate, "Access application").domain === rootDomain,
  );
  const wildcardMatches = applications.filter(
    (candidate) =>
      record(candidate, "Access application").domain === wildcardDomain,
  );
  if (rootMatches.length !== 1 || wildcardMatches.length !== 1) {
    fail("Access root and wildcard applications differ");
  }
  const listedRootId = accessId(
    record(rootMatches[0], "root Access application list entry").id,
    "root Access application list entry",
  );
  const listedWildcardId = accessId(
    record(wildcardMatches[0], "wildcard Access application list entry").id,
    "wildcard Access application list entry",
  );
  const [rootDetail, wildcardDetail] = await Promise.all([
    apiJson(
      fetchImpl,
      `${base}/apps/${encodeURIComponent(listedRootId)}`,
      { headers: authorization(token) },
      "root Access application detail",
    ),
    apiJson(
      fetchImpl,
      `${base}/apps/${encodeURIComponent(listedWildcardId)}`,
      { headers: authorization(token) },
      "wildcard Access application detail",
    ),
  ]);
  const rootId = validateAccessApplication(
    rootDetail,
    listedRootId,
    rootDomain,
    identityProviderId,
    "root",
    organizationMfaDisabled,
  );
  const wildcardId = validateAccessApplication(
    wildcardDetail,
    listedWildcardId,
    wildcardDomain,
    identityProviderId,
    "wildcard",
    organizationMfaDisabled,
  );
  const [rootPolicies, wildcardPolicies] = await Promise.all([
    apiList(
      fetchImpl,
      `${base}/apps/${encodeURIComponent(rootId)}/policies`,
      token,
      "root Access policies",
    ),
    apiList(
      fetchImpl,
      `${base}/apps/${encodeURIComponent(wildcardId)}/policies`,
      token,
      "wildcard Access policies",
    ),
  ]);
  validateAccessPolicy(rootPolicies, config.approvedEmails, "root");
  validateAccessPolicy(wildcardPolicies, config.approvedEmails, "wildcard");
}

function validateNoBuildInjection(
  candidate,
  label,
  expectedDestinationDir,
  { allowOmittedDestination = false } = {},
) {
  const config = record(candidate, label);
  const allowed = new Set([
    "build_caching",
    "build_command",
    "destination_dir",
    "root_dir",
    "web_analytics_tag",
    "web_analytics_token",
  ]);
  if (Object.keys(config).some((name) => !allowed.has(name))) {
    fail(`${label} contains an unknown field`);
  }
  for (const name of [
    "build_command",
    "root_dir",
    "web_analytics_tag",
    "web_analytics_token",
  ]) {
    if (
      config[name] !== undefined &&
      config[name] !== null &&
      config[name] !== ""
    ) {
      fail(`${label} enables a build or analytics capability`);
    }
  }
  if (
    config.destination_dir !== expectedDestinationDir &&
    !(allowOmittedDestination && config.destination_dir === undefined)
  ) {
    fail(`${label} changes the qualified build output directory`);
  }
  if (
    config.build_caching !== undefined &&
    config.build_caching !== null &&
    config.build_caching !== false
  ) {
    fail(`${label} enables build caching`);
  }
}

function validateRemoteProject(
  candidate,
  evidence,
  requireConfigHash = false,
  expectedDeploymentId,
) {
  const project = record(candidate, "Cloudflare Pages project");
  if (
    project.name !== PROJECT_NAME ||
    project.production_branch !== PRODUCTION_BRANCH ||
    project.uses_functions !== true ||
    project.subdomain !== `${PROJECT_NAME}.pages.dev`
  ) {
    fail("remote Pages production identity differs");
  }
  if (
    !Array.isArray(project.domains) ||
    project.domains.length !== 1 ||
    project.domains[0] !== `${PROJECT_NAME}.pages.dev`
  ) {
    fail("remote Pages custom domains differ");
  }
  if (project.source !== undefined && project.source !== null) {
    fail("remote Pages source control must be disconnected");
  }
  validateNoBuildInjection(
    project.build_config,
    "remote Pages build config",
    evidence.pagesBuildOutputDir,
  );
  const production = record(
    record(project.deployment_configs, "deployment configs").production,
    "production deployment config",
  );
  const reviewedProductionFields = new Set([
    "ai_bindings",
    "always_use_latest_compatibility_date",
    "analytics_engine_datasets",
    "build_image_major_version",
    "browsers",
    "compatibility_date",
    "compatibility_flags",
    "d1_databases",
    "durable_object_namespaces",
    "env_vars",
    "fail_open",
    "hyperdrive_bindings",
    "images",
    "kv_namespaces",
    "limits",
    "mtls_certificates",
    "pipelines",
    "placement",
    "queue_producers",
    "r2_buckets",
    "secrets_store_secrets",
    "services",
    "usage_model",
    "vectorize_bindings",
    "workflows",
    "wrangler_config_hash",
  ]);
  if (
    Object.keys(production).some((name) => !reviewedProductionFields.has(name))
  ) {
    fail("remote Pages production config contains an unknown field");
  }
  if (
    production.compatibility_date !== COMPATIBILITY_DATE ||
    !Array.isArray(production.compatibility_flags) ||
    production.compatibility_flags.length !== 0
  ) {
    fail("remote Pages compatibility contract differs");
  }
  if (
    production.build_image_major_version !== 3 ||
    production.usage_model !== "standard"
  ) {
    fail("remote Pages Functions runtime model differs");
  }
  const envVars = record(production.env_vars, "production env vars");
  const expectedEnvNames = [
    ...Object.keys(EXPECTED_VARS),
    REQUIRED_SECRET_VAR,
  ].sort();
  if (
    JSON.stringify(Object.keys(envVars).sort()) !==
    JSON.stringify(expectedEnvNames)
  ) {
    fail("remote Pages environment names differ");
  }
  for (const [name, expected] of Object.entries(EXPECTED_VARS)) {
    const binding = record(envVars[name], `production env ${name}`);
    if (binding.type !== "plain_text" || binding.value !== expected) {
      fail(`remote Pages environment ${name} differs`);
    }
  }
  const secretBinding = record(
    envVars[REQUIRED_SECRET_VAR],
    `production env ${REQUIRED_SECRET_VAR}`,
  );
  if (
    JSON.stringify(Object.keys(secretBinding).sort()) !==
      JSON.stringify(["type", "value"]) ||
    secretBinding.type !== "secret_text" ||
    secretBinding.value !== ""
  ) {
    fail(`remote Pages environment ${REQUIRED_SECRET_VAR} differs`);
  }
  const databases = record(production.d1_databases, "production D1 bindings");
  if (
    JSON.stringify(Object.keys(databases)) !== JSON.stringify(["DB"]) ||
    record(databases.DB, "production DB binding").id !== DATABASE_ID
  ) {
    fail("remote Pages D1 binding differs");
  }
  for (const name of [
    "ai_bindings",
    "analytics_engine_datasets",
    "browsers",
    "durable_object_namespaces",
    "hyperdrive_bindings",
    "images",
    "kv_namespaces",
    "mtls_certificates",
    "pipelines",
    "queue_producers",
    "r2_buckets",
    "secrets_store_secrets",
    "services",
    "vectorize_bindings",
    "workflows",
  ]) {
    const value = production[name];
    if (
      value !== undefined &&
      value !== null &&
      (!record(value, `production ${name}`) || Object.keys(value).length !== 0)
    ) {
      fail(`remote Pages binding family ${name} is not empty`);
    }
  }
  for (const name of ["limits", "placement"]) {
    const value = production[name];
    if (
      value !== undefined &&
      value !== null &&
      (!record(value, `production ${name}`) || Object.keys(value).length !== 0)
    ) {
      fail(`remote Pages ${name} is not empty`);
    }
  }
  for (const name of ["fail_open", "always_use_latest_compatibility_date"]) {
    if (production[name] !== false) {
      fail(`remote Pages ${name} must be explicitly disabled`);
    }
  }
  if (
    requireConfigHash &&
    production.wrangler_config_hash !== evidence.wranglerConfigSha256
  ) {
    fail("remote Pages Wrangler config hash differs");
  }
  if (expectedDeploymentId !== undefined) {
    const canonical = record(
      project.canonical_deployment,
      "canonical Pages deployment",
    );
    const latest = record(project.latest_deployment, "latest Pages deployment");
    if (
      canonical.id !== expectedDeploymentId ||
      latest.id !== expectedDeploymentId
    ) {
      fail("remote Pages deployment ownership differs");
    }
  }
}

function uploadJwtClaims(jwt) {
  const parts = jwt.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    fail("Pages upload token is invalid");
  }
  let payload;
  try {
    payload = record(
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
      "Pages upload token claims",
    );
  } catch {
    return fail("Pages upload token claims are invalid");
  }
  if (
    !Number.isSafeInteger(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000) ||
    !Number.isSafeInteger(payload.max_file_count_allowed) ||
    payload.max_file_count_allowed <= 0
  ) {
    fail("Pages upload token limits are invalid");
  }
  return {
    maxFileCount: Math.min(MAX_ASSET_COUNT, payload.max_file_count_allowed),
  };
}

function uploadBuckets(assets) {
  const buckets = [];
  for (const asset of [...assets].sort(
    (left, right) => right.bytes - left.bytes,
  )) {
    let bucket = buckets.find(
      (candidate) =>
        candidate.bytes + asset.bytes <= MAX_UPLOAD_BUCKET_BYTES &&
        candidate.assets.length < MAX_UPLOAD_BUCKET_FILES,
    );
    if (!bucket) {
      bucket = { assets: [], bytes: 0 };
      buckets.push(bucket);
    }
    bucket.assets.push(asset);
    bucket.bytes += asset.bytes;
  }
  return buckets;
}

async function uploadAssets(fetchImpl, token, accountId, snapshot) {
  const uploadTokenResult = record(
    await apiJson(
      fetchImpl,
      `${API_BASE}/accounts/${accountId}/pages/projects/${PROJECT_NAME}/upload-token`,
      { headers: authorization(token) },
      "Pages upload token",
    ),
    "Pages upload token result",
  );
  if (typeof uploadTokenResult.jwt !== "string") {
    fail("Pages upload token is invalid");
  }
  const jwt = uploadTokenResult.jwt;
  const claims = uploadJwtClaims(jwt);
  if (snapshot.deployment.assets.length > claims.maxFileCount) {
    fail("Pages asset count exceeds upload token limit");
  }
  const hashes = [
    ...new Set(snapshot.deployment.assets.map(({ pagesHash }) => pagesHash)),
  ];
  const missing = await apiJson(
    fetchImpl,
    `${API_BASE}/pages/assets/check-missing`,
    {
      method: "POST",
      headers: { ...authorization(jwt), "Content-Type": "application/json" },
      body: JSON.stringify({ hashes }),
    },
    "Pages missing-assets check",
  );
  if (
    !Array.isArray(missing) ||
    missing.some(
      (hash) => typeof hash !== "string" || !hashes.includes(hash),
    ) ||
    new Set(missing).size !== missing.length
  ) {
    fail("Pages missing-assets response is invalid");
  }
  const byHash = new Map(
    snapshot.deployment.assets.map((asset) => [asset.pagesHash, asset]),
  );
  const missingAssets = missing.map((hash) => byHash.get(hash));
  for (const bucket of uploadBuckets(missingAssets)) {
    const payload = bucket.assets.map((asset) => {
      const bytes = snapshot.files.get(asset.path);
      return {
        key: asset.pagesHash,
        value: bytes.toString("base64"),
        metadata: { contentType: asset.contentType },
        base64: true,
      };
    });
    await apiJson(
      fetchImpl,
      `${API_BASE}/pages/assets/upload`,
      {
        method: "POST",
        headers: { ...authorization(jwt), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      "Pages asset upload",
    );
  }
  await apiJson(
    fetchImpl,
    `${API_BASE}/pages/assets/upsert-hashes`,
    {
      method: "POST",
      headers: { ...authorization(jwt), "Content-Type": "application/json" },
      body: JSON.stringify({ hashes }),
    },
    "Pages asset hash finalization",
  );
  return Object.fromEntries(
    snapshot.deployment.assets.map(({ path, pagesHash }) => [path, pagesHash]),
  );
}

async function workerBundle(snapshot) {
  const boundary = "----conan-qualified-pages-worker-v1";
  const metadata = JSON.stringify({
    main_module: snapshot.deployment.worker.mainModule,
    bindings: snapshot.deployment.worker.bindings,
    compatibility_date: snapshot.deployment.worker.compatibilityDate,
    compatibility_flags: snapshot.deployment.worker.compatibilityFlags,
  });
  return new Blob(
    [
      `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="${snapshot.deployment.worker.mainModule}"; filename="${snapshot.deployment.worker.mainModule}"\r\nContent-Type: application/javascript+module\r\n\r\n`,
      snapshot.files.get("/_worker.js"),
      `\r\n--${boundary}--\r\n`,
    ],
    { type: `multipart/form-data; boundary=${boundary}` },
  );
}

function validatedDeploymentUrl(candidate) {
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return fail("Pages deployment URL is invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    !url.hostname.endsWith(`.${PROJECT_NAME}.pages.dev`) ||
    url.hostname === `${PROJECT_NAME}.pages.dev`
  ) {
    fail("Pages deployment URL is invalid");
  }
  return url.href;
}

function validateDeploymentTrigger(candidate, snapshot) {
  const trigger = record(candidate, "Pages deployment trigger");
  const metadata = record(
    trigger.metadata,
    "Pages deployment trigger metadata",
  );
  if (
    trigger.type !== "ad_hoc" ||
    metadata.branch !== PRODUCTION_BRANCH ||
    metadata.commit_hash !== snapshot.report.releaseCommit ||
    metadata.commit_dirty !== false ||
    metadata.commit_message !== `qualified ${snapshot.report.releaseCommit}`
  ) {
    fail("Pages deployment trigger differs from qualification");
  }
}

function validateCreateDeploymentTrigger(candidate, snapshot) {
  const trigger = record(candidate, "Pages deployment trigger");
  if (trigger.type !== undefined && trigger.type !== "ad_hoc") {
    fail("Pages deployment trigger differs from qualification");
  }
  if (trigger.metadata === undefined) return;
  const metadata = record(
    trigger.metadata,
    "Pages deployment trigger metadata",
  );
  for (const [name, expected] of Object.entries({
    branch: PRODUCTION_BRANCH,
    commit_hash: snapshot.report.releaseCommit,
    commit_dirty: false,
    commit_message: `qualified ${snapshot.report.releaseCommit}`,
  })) {
    if (metadata[name] !== undefined && metadata[name] !== expected) {
      fail("Pages deployment trigger differs from qualification");
    }
  }
}

function validatedCreateDeployment(candidate, snapshot) {
  const deployment = record(candidate, "Pages deployment");
  if (typeof deployment.id !== "string" || deployment.id.length < 8) {
    fail("Pages deployment identity is invalid");
  }
  if (
    (deployment.project_name !== undefined &&
      deployment.project_name !== PROJECT_NAME) ||
    (deployment.environment !== undefined &&
      deployment.environment !== "production") ||
    (deployment.uses_functions !== undefined &&
      deployment.uses_functions !== null &&
      typeof deployment.uses_functions !== "boolean")
  ) {
    fail("Pages deployment identity is invalid");
  }
  if (deployment.build_config !== undefined) {
    validateNoBuildInjection(
      deployment.build_config,
      "Pages deployment build config",
      snapshot.deployment.pagesBuildOutputDir,
      { allowOmittedDestination: true },
    );
  }
  if (deployment.url !== undefined) {
    validatedDeploymentUrl(deployment.url);
  }
  if (deployment.deployment_trigger !== undefined) {
    validateCreateDeploymentTrigger(deployment.deployment_trigger, snapshot);
  }
  return { id: deployment.id };
}

function validatedDeployment(candidate, snapshot, expectedId) {
  const deployment = record(candidate, "Pages deployment");
  if (
    typeof deployment.id !== "string" ||
    deployment.id.length < 8 ||
    (expectedId !== undefined && deployment.id !== expectedId) ||
    deployment.project_name !== PROJECT_NAME ||
    deployment.environment !== "production" ||
    deployment.uses_functions !== true
  ) {
    fail("Pages deployment identity is invalid");
  }
  validateNoBuildInjection(
    deployment.build_config,
    "Pages deployment build config",
    snapshot.deployment.pagesBuildOutputDir,
  );
  const url = validatedDeploymentUrl(deployment.url);
  validateDeploymentTrigger(deployment.deployment_trigger, snapshot);
  return { ...deployment, url };
}

function validatedPollingDeployment(candidate, snapshot, expectedId) {
  const deployment = record(candidate, "Pages deployment status result");
  const receipt = validatedCreateDeployment(deployment, snapshot);
  if (receipt.id !== expectedId) {
    fail("Pages deployment identity is invalid");
  }
  const stage = record(deployment.latest_stage, "Pages latest stage");
  const status = stage.status;
  if (
    status !== "idle" &&
    status !== "active" &&
    status !== "success" &&
    status !== "failure" &&
    status !== "canceled"
  ) {
    fail("Pages deployment status is invalid");
  }
  return { deployment, status };
}

async function createDeployment(
  fetchImpl,
  token,
  accountId,
  snapshot,
  manifest,
) {
  const body = new FormData();
  body.append("manifest", JSON.stringify(manifest));
  body.append("branch", PRODUCTION_BRANCH);
  body.append("commit_dirty", "false");
  body.append("commit_hash", snapshot.report.releaseCommit);
  body.append("commit_message", `qualified ${snapshot.report.releaseCommit}`);
  body.append(
    "pages_build_output_dir",
    snapshot.deployment.pagesBuildOutputDir,
  );
  body.append("wrangler_config_hash", snapshot.deployment.wranglerConfigSha256);
  body.append(
    "_headers",
    new Blob([snapshot.files.get("/_headers")], { type: "text/plain" }),
    "_headers",
  );
  body.append(
    "_routes.json",
    new Blob([snapshot.files.get("/_routes.json")], {
      type: "application/json",
    }),
    "_routes.json",
  );
  body.append("_worker.bundle", await workerBundle(snapshot), "_worker.bundle");
  let result;
  try {
    result = await apiJson(
      fetchImpl,
      `${API_BASE}/accounts/${accountId}/pages/projects/${PROJECT_NAME}/deployments`,
      { method: "POST", headers: authorization(token), body },
      "Pages deployment creation",
    );
  } catch {
    return fail(
      "Pages deployment creation state is unknown; inspect Cloudflare before retrying",
    );
  }
  return validatedCreateDeployment(result, snapshot);
}

async function waitForDeployment(
  fetchImpl,
  sleep,
  token,
  accountId,
  deployment,
  snapshot,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const current = await apiJson(
      fetchImpl,
      `${API_BASE}/accounts/${accountId}/pages/projects/${PROJECT_NAME}/deployments/${encodeURIComponent(deployment.id)}`,
      { headers: authorization(token) },
      "Pages deployment status",
    );
    const pending = validatedPollingDeployment(
      current,
      snapshot,
      deployment.id,
    );
    if (pending.status === "success") {
      return validatedDeployment(current, snapshot, deployment.id);
    }
    if (pending.status === "failure" || pending.status === "canceled") {
      fail(`Pages deployment ended with ${pending.status}`);
    }
    await sleep(2_000);
  }
  return fail("Pages deployment did not complete in time");
}

async function probeAccess(fetchImpl, url, label) {
  const probe = new URL(url);
  probe.searchParams.set("__conan_access_probe", Date.now().toString(36));
  const response = await fetchImpl(probe.href, {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
    cache: "no-store",
    headers: {},
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const location = response.headers.get("location");
  if (response.status !== 302 || !location) {
    fail(`${label} is not protected by Cloudflare Access`);
  }
  let redirect;
  try {
    redirect = new URL(location, probe);
  } catch {
    return fail(`${label} Access redirect is invalid`);
  }
  const kids = redirect.searchParams.getAll("kid");
  const metas = redirect.searchParams.getAll("meta");
  const redirectUrls = redirect.searchParams.getAll("redirect_url");
  if (
    redirect.origin !== ACCESS_ORIGIN ||
    redirect.pathname !== `/cdn-cgi/access/login/${probe.hostname}` ||
    redirect.username !== "" ||
    redirect.password !== "" ||
    redirect.port !== "" ||
    redirect.hash !== "" ||
    kids.length !== 1 ||
    !/^[a-f0-9]{64}$/.test(kids[0] ?? "") ||
    metas.length !== 1 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(metas[0] ?? "") ||
    redirectUrls.length !== 1 ||
    redirectUrls[0] !== probe.pathname + probe.search
  ) {
    fail(`${label} Access redirect differs`);
  }
}

export function parseQualifiedDeployArgs(args) {
  if (args.length !== 0) fail("deployment accepts no command-line arguments");
  return {};
}

async function runQualifiedDeployCore(input, controls) {
  const repoRoot = await regularDirectory(input.repoRoot, "repository root");
  const runDir = await controls.qualify(
    repoRoot,
    qualificationEnvironment(input.environment),
  );
  const snapshot = await loadQualifiedSnapshot(repoRoot, runDir);
  const [head, status] = await Promise.all([
    controls.gitHead(repoRoot),
    controls.gitStatus(repoRoot),
  ]);
  if (head !== snapshot.report.releaseCommit || status !== "") {
    fail("repository changed after qualification");
  }
  const operatorConfig =
    input.operatorConfig === undefined
      ? await loadDeployOperatorConfig(input.environment ?? process.env)
      : validateDeployOperatorConfig(input.operatorConfig);
  const token = input.token;
  const accountId = ACCOUNT_ID;
  if (typeof token !== "string" || token.length < 20)
    fail("CLOUDFLARE_API_TOKEN is missing or invalid");
  if (input.accountId !== undefined && input.accountId !== ACCOUNT_ID) {
    fail("Cloudflare account differs from the fixed operator account");
  }
  await validateActiveAccess(controls.fetch, token, operatorConfig);
  await probeAccess(controls.fetch, STABLE_URL, "stable URL preflight");
  await probeAccess(
    controls.fetch,
    WILDCARD_PROBE_URL,
    "wildcard URL preflight",
  );
  const project = await apiJson(
    controls.fetch,
    `${API_BASE}/accounts/${accountId}/pages/projects/${PROJECT_NAME}`,
    { headers: authorization(token) },
    "Pages project preflight",
  );
  validateRemoteProject(project, snapshot.deployment);
  const manifest = await uploadAssets(
    controls.fetch,
    token,
    accountId,
    snapshot,
  );
  const created = await createDeployment(
    controls.fetch,
    token,
    accountId,
    snapshot,
    manifest,
  );
  const deployment = await waitForDeployment(
    controls.fetch,
    controls.sleep,
    token,
    accountId,
    created,
    snapshot,
  );
  const deployedProject = await apiJson(
    controls.fetch,
    `${API_BASE}/accounts/${accountId}/pages/projects/${PROJECT_NAME}`,
    { headers: authorization(token) },
    "deployed Pages project verification",
  );
  validateRemoteProject(
    deployedProject,
    snapshot.deployment,
    true,
    deployment.id,
  );
  await probeAccess(controls.fetch, deployment.url, "deployment URL");
  await probeAccess(controls.fetch, STABLE_URL, "stable URL");
  await probeAccess(controls.fetch, WILDCARD_PROBE_URL, "wildcard URL");
  await probeAccess(
    controls.fetch,
    new URL(snapshot.deployment.assets[0].path, STABLE_URL).href,
    "representative static asset",
  );
  await probeAccess(
    controls.fetch,
    new URL("/api/v1/health", STABLE_URL).href,
    "representative API route",
  );
  return {
    id: deployment.id,
    url: deployment.url,
    stableUrl: STABLE_URL,
    releaseCommit: snapshot.report.releaseCommit,
    runDir: snapshot.run,
  };
}

function assertPlainTestData(value, label, seen = new Set()) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }
  if (typeof value !== "object" || seen.has(value)) {
    fail(`${label} must contain plain cloneable data only`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (
    prototype !== Object.prototype &&
    prototype !== null &&
    !Array.isArray(value)
  ) {
    fail(`${label} must contain plain cloneable data only`);
  }
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length !== 0) {
    fail(`${label} must contain plain cloneable data only`);
  }
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (name === "length" && Array.isArray(value)) continue;
    if (
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      descriptor.enumerable !== true ||
      !("value" in descriptor)
    ) {
      fail(`${label} must contain plain cloneable data only`);
    }
    assertPlainTestData(descriptor.value, label, seen);
  }
  seen.delete(value);
}

function cloneTestData(value, label) {
  assertPlainTestData(value, label);
  let cloned;
  try {
    cloned = structuredClone(value);
  } catch {
    return fail(`${label} must contain plain cloneable data only`);
  }
  assertPlainTestData(cloned, label);
  return cloned;
}

function testEnvelope(result, list = false, omitErrors = false) {
  return new Response(
    JSON.stringify({
      success: true,
      ...(omitErrors ? {} : { errors: [] }),
      result,
      ...(list
        ? { result_info: { page: 1, per_page: 1_000, total_pages: 1 } }
        : {}),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function assertTestRequest(init, method, token, label) {
  const actualMethod = (init?.method ?? "GET").toUpperCase();
  if (
    actualMethod !== method ||
    init?.cache !== "no-store" ||
    init?.credentials !== "omit" ||
    init?.redirect !== "error" ||
    new Headers(init?.headers).get("authorization") !== `Bearer ${token}`
  ) {
    fail(`${label} test request differs from the exact protocol`);
  }
}

function createStaticTestFetch(scenario, requests) {
  let projectReads = 0;
  let deploymentPoll = 0;
  let lastDeploymentStatus = null;
  return async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    requests.push({
      url: url.href,
      method,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body,
    });

    if (url.origin !== new URL(API_BASE).origin) {
      if (
        method !== "GET" ||
        init.redirect !== "manual" ||
        init.credentials !== "omit" ||
        init.cache !== "no-store" ||
        url.searchParams.size !== 1 ||
        !url.searchParams.has("__conan_access_probe")
      ) {
        fail("Access test probe differs from the exact protocol");
      }
      const allowedOrigins = new Set([
        new URL(STABLE_URL).origin,
        new URL(WILDCARD_PROBE_URL).origin,
      ]);
      if (lastDeploymentStatus !== null) {
        const deploymentProbeUrl = lastDeploymentStatus.url;
        if (deploymentProbeUrl === undefined) {
          fail("deployment test scenario has no probe URL");
        }
        allowedOrigins.add(new URL(deploymentProbeUrl).origin);
      }
      if (!allowedOrigins.has(url.origin)) {
        fail(`unexpected test request: ${url.href}`);
      }
      const redirect = new URL(
        `${ACCESS_ORIGIN}/cdn-cgi/access/login/${scenario.accessRedirectHost ?? url.hostname}`,
      );
      if (scenario.accessRedirectMode !== "missing") {
        redirect.searchParams.set("kid", "a".repeat(64));
        redirect.searchParams.set("meta", "header.payload.signature");
        redirect.searchParams.set(
          "redirect_url",
          scenario.accessRedirectMode === "wrong"
            ? "/wrong"
            : url.pathname + url.search,
        );
      }
      return scenario.accessProtected
        ? new Response(null, {
            status: 302,
            headers: { location: redirect.href },
          })
        : new Response("public", { status: 200 });
    }

    const accessBase = `/client/v4/accounts/${ACCOUNT_ID}/access`;
    if (url.pathname.startsWith(accessBase)) {
      assertTestRequest(init, "GET", TEST_DEPLOY_TOKEN, "Access");
      if (url.pathname === `${accessBase}/organizations`) {
        if (url.search !== "") fail("Access organization test query differs");
        return testEnvelope(scenario.access.organization);
      }
      const detail = url.pathname.match(
        new RegExp(`^${accessBase}/apps/([^/]+)$`),
      );
      if (detail) {
        if (url.search !== "")
          fail("Access application detail test query differs");
        return testEnvelope(
          scenario.access.appDetails[decodeURIComponent(detail[1])],
        );
      }
      if (url.search !== "?page=1&per_page=1000") {
        fail("Access test pagination differs");
      }
      if (url.pathname === `${accessBase}/identity_providers`) {
        return testEnvelope(scenario.access.idps, true);
      }
      if (url.pathname === `${accessBase}/apps`) {
        return testEnvelope(scenario.access.apps, true);
      }
      const policy = url.pathname.match(
        new RegExp(`^${accessBase}/apps/([^/]+)/policies$`),
      );
      if (policy) {
        return testEnvelope(
          scenario.access.policies[decodeURIComponent(policy[1])],
          true,
        );
      }
      fail(`unexpected test request: ${url.href}`);
    }

    const projectPath = `/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`;
    if (url.pathname === projectPath && method === "GET") {
      assertTestRequest(init, "GET", TEST_DEPLOY_TOKEN, "Pages project");
      const result =
        projectReads === 0 ? scenario.project : scenario.deployedProject;
      projectReads += 1;
      return testEnvelope(result);
    }
    if (url.pathname === `${projectPath}/upload-token`) {
      assertTestRequest(init, "GET", TEST_DEPLOY_TOKEN, "Pages upload token");
      return testEnvelope({ jwt: scenario.uploadToken });
    }

    const assetToken = scenario.uploadToken;
    if (url.pathname === "/client/v4/pages/assets/check-missing") {
      assertTestRequest(init, "POST", assetToken, "Pages missing-assets check");
      return testEnvelope(
        scenario.missingHashes,
        false,
        scenario.assetEnvelopesOmitErrors,
      );
    }
    if (
      url.pathname === "/client/v4/pages/assets/upload" ||
      url.pathname === "/client/v4/pages/assets/upsert-hashes"
    ) {
      if (!scenario.mutationAllowed)
        fail("test scenario forbids Pages mutation");
      assertTestRequest(init, "POST", assetToken, "Pages asset mutation");
      return testEnvelope({}, false, scenario.assetEnvelopesOmitErrors);
    }
    if (url.pathname === `${projectPath}/deployments` && method === "POST") {
      if (!scenario.mutationAllowed)
        fail("test scenario forbids Pages mutation");
      assertTestRequest(init, "POST", TEST_DEPLOY_TOKEN, "Pages deployment");
      return testEnvelope(scenario.createdDeployment);
    }
    if (
      url.pathname ===
      `${projectPath}/deployments/${encodeURIComponent(scenario.createdDeployment.id)}`
    ) {
      assertTestRequest(
        init,
        "GET",
        TEST_DEPLOY_TOKEN,
        "Pages deployment status",
      );
      const result = scenario.deploymentStatuses[deploymentPoll];
      if (result === undefined)
        fail("test deployment status response is missing");
      lastDeploymentStatus = result;
      deploymentPoll += 1;
      return testEnvelope(result);
    }
    return fail(`unexpected test request: ${url.href}`);
  };
}

const TEST_SCENARIO_KEYS = [
  "access",
  "accessProtected",
  "accessRedirectHost",
  "accessRedirectMode",
  "assetEnvelopesOmitErrors",
  "createdDeployment",
  "deployedProject",
  "deploymentStatuses",
  "gitHead",
  "gitStatus",
  "missingHashes",
  "mutationAllowed",
  "project",
  "runDir",
  "uploadToken",
];

export function createQualifiedDeployStaticTestTransport(rawScenario) {
  const scenario = cloneTestData(rawScenario, "test deploy scenario");
  exactKeys(scenario, TEST_SCENARIO_KEYS, "test deploy scenario");
  const requests = [];
  return {
    scenario,
    requests,
    fetch: createStaticTestFetch(scenario, requests),
  };
}

export async function runQualifiedDeployForTest(input, rawScenario) {
  assertPlainTestData(input, "test deploy input");
  exactKeys(
    input,
    ["accountId", "operatorConfig", "repoRoot"],
    "test deploy input",
  );
  const transport = createQualifiedDeployStaticTestTransport(rawScenario);
  const { scenario, requests } = transport;
  const result = await runQualifiedDeployCore(
    {
      ...cloneTestData(input, "test deploy input"),
      token: TEST_DEPLOY_TOKEN,
    },
    {
      qualify: async () => scenario.runDir,
      fetch: transport.fetch,
      gitHead: async () => scenario.gitHead,
      gitStatus: async () => scenario.gitStatus,
      sleep: async () => {},
    },
  );
  return { result, requests };
}

export async function runQualifiedDeployCli() {
  parseQualifiedDeployArgs(process.argv.slice(2));
  const token = process.env.CLOUDFLARE_API_TOKEN;
  for (const name of Object.keys(process.env)) {
    if (
      /^(?:CF|CLOUDFLARE)_.+(?:KEY|SECRET|TOKEN)$/i.test(name) ||
      name === "CLOUDFLARE_ACCOUNT_ID"
    ) {
      delete process.env[name];
    }
  }
  const runDir = await qualify(MODULE_REPOSITORY_ROOT);
  const result = await runQualifiedDeployCore(
    {
      repoRoot: MODULE_REPOSITORY_ROOT,
      token,
      accountId: ACCOUNT_ID,
    },
    {
      qualify: async () => runDir,
      fetch: globalThis.fetch,
      gitHead: async (root) => (await git(root, ["rev-parse", "HEAD"])).trim(),
      gitStatus: (root) =>
        git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
      sleep: (milliseconds) =>
        new Promise((done) => setTimeout(done, milliseconds)),
    },
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (
  process.argv[1] &&
  samePath(process.argv[1], fileURLToPath(import.meta.url))
) {
  await runQualifiedDeployCli();
}
