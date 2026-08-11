import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import type { BuildManifests, ManifestEntry } from "./types.js";

const PROJECT_NAME = "conan-private-7302df07";
const PRODUCTION_BRANCH = "main";
const PAGES_BUILD_OUTPUT_DIR = "dist";
const WORKER_PATH = "/_worker.js";
const HEADERS_PATH = "/_headers";
const ROUTES_PATH = "/_routes.json";
const COMPATIBILITY_DATE = "2026-08-10";
const PRODUCTION_DATABASE_ID = "4ee3b0b4-560a-46b9-9e9f-17dd394fc291";
const SHA256 = /^[0-9a-f]{64}$/;
const PAGES_HASH = /^[0-9a-f]{32}$/;
const SAFE_PATH = /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/;

const CONTENT_TYPES = new Map([
  [".css", "text/css"],
  [".html", "text/html"],
  [".ico", "image/vnd.microsoft.icon"],
  [".js", "application/javascript"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

export type PagesAssetEvidence = ManifestEntry & {
  pagesHash: string;
  contentType: string;
};

export type PagesWorkerBinding =
  | { name: string; type: "plain_text"; text: string }
  | { name: string; type: "d1"; id: string };

export type PagesDeploymentEvidence = {
  schemaVersion: 1;
  projectName: typeof PROJECT_NAME;
  productionBranch: typeof PRODUCTION_BRANCH;
  pagesBuildOutputDir: typeof PAGES_BUILD_OUTPUT_DIR;
  wranglerConfigSha256: string;
  headersPath: typeof HEADERS_PATH;
  routesPath: typeof ROUTES_PATH;
  assets: PagesAssetEvidence[];
  worker: ManifestEntry & {
    mainModule: "_worker.js";
    contentType: "application/javascript+module";
    compatibilityDate: typeof COMPATIBILITY_DATE;
    compatibilityFlags: [];
    bindings: PagesWorkerBinding[];
  };
};

type BuildPagesDeploymentEvidenceOptions = {
  stagingDir: string;
  manifests: BuildManifests;
  wranglerConfigText: string;
};

function fail(message: string): never {
  throw new Error(`Pages deployment evidence rejected: ${message}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify([...expected].sort())
  ) {
    fail(`${label} fields must match the exact schema`);
  }
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function checkedPath(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_PATH.test(value)) {
    fail(`${label} is invalid`);
  }
  return value;
}

function checkedHash(value: unknown, label: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    fail(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function checkedEntry(value: unknown, label: string): ManifestEntry {
  const entry = record(value, label);
  exactKeys(entry, ["bytes", "path", "sha256"], label);
  const path = checkedPath(entry.path, `${label}.path`);
  if (
    !Number.isSafeInteger(entry.bytes) ||
    (entry.bytes as number) < 0
  ) {
    fail(`${label}.bytes is invalid`);
  }
  return {
    path,
    bytes: entry.bytes as number,
    sha256: checkedHash(entry.sha256, `${label}.sha256`),
  };
}

function contentType(path: string): string {
  return CONTENT_TYPES.get(extname(path).toLowerCase()) ?? "application/octet-stream";
}

function pagesHash(content: Buffer): string {
  return sha256(content).slice(0, 32);
}

function within(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

async function readStagedEntry(
  stagingRoot: string,
  entry: ManifestEntry,
): Promise<Buffer> {
  const path = resolve(stagingRoot, entry.path.slice(1));
  if (!within(stagingRoot, path)) fail(`staged path escapes root: ${entry.path}`);
  const stat = await lstat(path).catch(() => fail(`staged file is missing: ${entry.path}`));
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`staged file must be regular: ${entry.path}`);
  }
  const canonical = await realpath(path);
  if (canonical !== path) fail(`staged file path is not canonical: ${entry.path}`);
  const content = await readFile(path);
  if (content.byteLength !== entry.bytes || sha256(content) !== entry.sha256) {
    fail(`staged file differs from manifest: ${entry.path}`);
  }
  return content;
}

function parseConfig(text: string): {
  configSha256: string;
  compatibilityDate: typeof COMPATIBILITY_DATE;
  bindings: PagesWorkerBinding[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("wrangler config must be valid JSON");
  }
  const config = record(parsed, "wrangler config");
  if (
    config.name !== PROJECT_NAME ||
    config.pages_build_output_dir !== "./dist" ||
    config.compatibility_date !== COMPATIBILITY_DATE
  ) {
    fail("wrangler production identity is invalid");
  }
  const vars = record(config.vars, "wrangler vars");
  const expectedVarNames = [
    "ACCESS_TEAM_DOMAIN",
    "ACCESS_AUD",
    "DEPLOYMENT_ENV",
    "APP_HOST_KIND",
    "APP_HOST_VALUE",
    "D1_DATABASE_ID",
  ] as const;
  exactKeys(vars, expectedVarNames, "wrangler vars");
  const expectedVars: Record<(typeof expectedVarNames)[number], string> = {
    ACCESS_TEAM_DOMAIN: "https://steep-mouse-bb22.cloudflareaccess.com",
    ACCESS_AUD: "804dd12e524e3dfd51dd950d3db03b610e415e7e5c71f0300f82a0ccd269c007",
    DEPLOYMENT_ENV: "production",
    APP_HOST_KIND: "exact",
    APP_HOST_VALUE: "conan-private-7302df07.pages.dev",
    D1_DATABASE_ID: PRODUCTION_DATABASE_ID,
  };
  for (const name of expectedVarNames) {
    if (vars[name] !== expectedVars[name]) fail(`wrangler ${name} is invalid`);
  }
  if (!Array.isArray(config.d1_databases) || config.d1_databases.length !== 1) {
    fail("wrangler production D1 binding is invalid");
  }
  const database = record(config.d1_databases[0], "wrangler D1 binding");
  if (
    database.binding !== "DB" ||
    database.database_name !== "conan-cloud-data-production" ||
    database.database_id !== PRODUCTION_DATABASE_ID
  ) {
    fail("wrangler production D1 binding is invalid");
  }
  return {
    configSha256: sha256(text),
    compatibilityDate: COMPATIBILITY_DATE,
    bindings: [
      ...expectedVarNames.map((name) => ({
        name,
        type: "plain_text" as const,
        text: expectedVars[name],
      })),
      { name: "DB", type: "d1" as const, id: PRODUCTION_DATABASE_ID },
    ],
  };
}

export async function buildPagesDeploymentEvidence(
  options: BuildPagesDeploymentEvidenceOptions,
): Promise<PagesDeploymentEvidence> {
  if (!isAbsolute(options.stagingDir)) fail("staging root must be absolute");
  const stagingRoot = await realpath(options.stagingDir);
  const config = parseConfig(options.wranglerConfigText);
  const workerEntry = options.manifests.upload.find(
    ({ path }) => path === WORKER_PATH,
  );
  if (!workerEntry) fail("worker is missing from upload manifest");
  await readStagedEntry(stagingRoot, workerEntry);
  const assets = await Promise.all(
    options.manifests.response.map(async (entry) => {
      const content = await readStagedEntry(stagingRoot, entry);
      return {
        ...entry,
        pagesHash: pagesHash(content),
        contentType: contentType(entry.path),
      };
    }),
  );
  return validatePagesDeploymentEvidence({
    schemaVersion: 1,
    projectName: PROJECT_NAME,
    productionBranch: PRODUCTION_BRANCH,
    pagesBuildOutputDir: PAGES_BUILD_OUTPUT_DIR,
    wranglerConfigSha256: config.configSha256,
    headersPath: HEADERS_PATH,
    routesPath: ROUTES_PATH,
    assets,
    worker: {
      ...workerEntry,
      mainModule: "_worker.js",
      contentType: "application/javascript+module",
      compatibilityDate: config.compatibilityDate,
      compatibilityFlags: [],
      bindings: config.bindings,
    },
  });
}

export function validatePagesDeploymentEvidence(
  candidate: unknown,
): PagesDeploymentEvidence {
  const value = record(candidate, "deployment evidence");
  exactKeys(
    value,
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
    "deployment evidence",
  );
  if (
    value.schemaVersion !== 1 ||
    value.projectName !== PROJECT_NAME ||
    value.productionBranch !== PRODUCTION_BRANCH ||
    value.pagesBuildOutputDir !== PAGES_BUILD_OUTPUT_DIR ||
    value.headersPath !== HEADERS_PATH ||
    value.routesPath !== ROUTES_PATH
  ) {
    fail("deployment identity is invalid");
  }
  checkedHash(value.wranglerConfigSha256, "wranglerConfigSha256");
  if (!Array.isArray(value.assets)) fail("assets must be an array");
  let previousPath = "";
  for (const [index, candidateAsset] of value.assets.entries()) {
    const asset = record(candidateAsset, `assets[${index}]`);
    exactKeys(
      asset,
      ["bytes", "contentType", "pagesHash", "path", "sha256"],
      `assets[${index}]`,
    );
    const entry = checkedEntry(
      { path: asset.path, bytes: asset.bytes, sha256: asset.sha256 },
      `assets[${index}] entry`,
    );
    if (entry.path <= previousPath || entry.path.startsWith("/_")) {
      fail("assets must be sorted, unique, and static");
    }
    previousPath = entry.path;
    if (typeof asset.pagesHash !== "string" || !PAGES_HASH.test(asset.pagesHash)) {
      fail(`assets[${index}].pagesHash is invalid`);
    }
    if (asset.contentType !== contentType(entry.path)) {
      fail(`assets[${index}].contentType is invalid`);
    }
  }
  const worker = record(value.worker, "worker");
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
    "worker",
  );
  const workerEntry = checkedEntry(
    { path: worker.path, bytes: worker.bytes, sha256: worker.sha256 },
    "worker entry",
  );
  if (
    workerEntry.path !== WORKER_PATH ||
    worker.mainModule !== "_worker.js" ||
    worker.contentType !== "application/javascript+module" ||
    worker.compatibilityDate !== COMPATIBILITY_DATE ||
    !Array.isArray(worker.compatibilityFlags) ||
    worker.compatibilityFlags.length !== 0 ||
    !Array.isArray(worker.bindings)
  ) {
    fail("worker metadata is invalid");
  }
  const expectedBindings = parseConfig(
    `${JSON.stringify({
      name: PROJECT_NAME,
      pages_build_output_dir: "./dist",
      compatibility_date: COMPATIBILITY_DATE,
      d1_databases: [
        {
          binding: "DB",
          database_name: "conan-cloud-data-production",
          database_id: PRODUCTION_DATABASE_ID,
        },
      ],
      vars: {
        ACCESS_TEAM_DOMAIN: "https://steep-mouse-bb22.cloudflareaccess.com",
        ACCESS_AUD: "804dd12e524e3dfd51dd950d3db03b610e415e7e5c71f0300f82a0ccd269c007",
        DEPLOYMENT_ENV: "production",
        APP_HOST_KIND: "exact",
        APP_HOST_VALUE: "conan-private-7302df07.pages.dev",
        D1_DATABASE_ID: PRODUCTION_DATABASE_ID,
      },
    })}\n`,
  ).bindings;
  if (JSON.stringify(worker.bindings) !== JSON.stringify(expectedBindings)) {
    fail("worker bindings differ from the production contract");
  }
  return candidate as PagesDeploymentEvidence;
}
