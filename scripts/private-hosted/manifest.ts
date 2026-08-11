import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import type { BuildManifests, ManifestEntry } from "./types.ts";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_FILE_COUNT = 20_000;
const MAX_INITIAL_HOME_BYTES = 512 * 1024;
const MANIFEST_PATH = ".vite/manifest.json";
const PAGES_ROUTES_PATH = "_routes.json";
const PAGES_WORKER_PATH = "_worker.js";
const EXPECTED_PAGES_ROUTES = `{
  "version": 1,
  "include": ["/api/v1/*"],
  "exclude": []
}
`;
const ALWAYS_ALLOWED = new Set([
  "index.html",
  "favicon.svg",
  "_headers",
  PAGES_ROUTES_PATH,
  PAGES_WORKER_PATH,
]);
const SHA256 = /^[0-9a-f]{64}$/;
const TRUSTED_BRAND_LOGO = /^assets\/detective-conan-logo-[A-Za-z0-9_-]+\.png$/;
const APPROVED_DYNAMIC_ENTRY_KEYS = new Set([
  "src/services/gameRuntimeBundle.ts",
  "src/screens/CardsScreen.tsx",
  "src/screens/DeckEditor.tsx",
  "src/screens/HistoryScreen.tsx",
  "src/screens/RealMatchView.tsx",
  "src/screens/ReplayScreen.tsx",
  "src/screens/ResultScreen.tsx",
  "src/screens/SettingsScreen.tsx",
  "src/screens/SetupScreen.tsx",
  "src/screens/TutorialScreen.tsx",
]);
const STATIC_ROUTE_CLOSURES = [
  { key: "index.html", label: "HOME" },
  { key: "src/screens/DeckEditor.tsx", label: "DECK" },
  { key: "src/screens/CardsScreen.tsx", label: "CARDS" },
] as const;

type ViteManifestEntry = {
  file?: unknown;
  name?: unknown;
  isEntry?: unknown;
  isDynamicEntry?: unknown;
  imports?: unknown;
  dynamicImports?: unknown;
  css?: unknown;
  assets?: unknown;
};

type ViteManifest = Record<string, ViteManifestEntry>;

export type ValidatedManifestClosure = {
  reachableFiles: ReadonlySet<string>;
  initialFiles: ReadonlySet<string>;
  keyOwnership: ReadonlyMap<string, string>;
};

function fail(message: string): never {
  throw new Error(`private hosted manifest rejected: ${message}`);
}

function isWithin(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

function checkedRelative(path: unknown, label: string): string {
  if (typeof path !== "string" || path.length === 0)
    fail(`${label} must be a non-empty path`);
  if (
    isAbsolute(path) ||
    path.includes("\\") ||
    path.split("/").includes("..")
  ) {
    fail(`${label} escapes dist`);
  }
  return path;
}

function checkedList(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value.map((path, index) =>
    checkedRelative(path, `${label}[${index}]`),
  );
}

function checkedBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") fail(`${label} must be a boolean`);
  return value;
}

function extensionIs(path: string, extension: ".js" | ".css"): boolean {
  return path.toLowerCase().endsWith(extension);
}

function assertScriptOrStyle(path: string, label: string): void {
  if (!extensionIs(path, ".js") && !extensionIs(path, ".css")) {
    fail(`${label} is not JavaScript or CSS: ${path}`);
  }
}

function assertReachableAsset(path: string, label: string): void {
  if (
    !extensionIs(path, ".js") &&
    !extensionIs(path, ".css") &&
    !TRUSTED_BRAND_LOGO.test(path)
  ) {
    fail(`${label} is not an approved build asset: ${path}`);
  }
}

function assertFileCount(fileCount: number): void {
  if (
    !Number.isSafeInteger(fileCount) ||
    fileCount < 0 ||
    fileCount > MAX_FILE_COUNT
  ) {
    fail("file count exceeds 20,000");
  }
}

const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

async function resolveDistRoot(distDir: string): Promise<string> {
  const requested = resolve(distDir);
  const stat = await lstat(requested).catch(() =>
    fail("dist directory does not exist"),
  );
  if (!stat.isDirectory() || stat.isSymbolicLink())
    fail("dist directory is not a regular directory");
  return realpath(requested).catch(() =>
    fail("dist directory cannot be inspected"),
  );
}

async function regularFile(
  rootReal: string,
  relativePath: string,
): Promise<{ absolute: string; bytes: number }> {
  const absolute = resolve(rootReal, relativePath);
  if (!isWithin(rootReal, absolute)) fail(`path escapes dist: ${relativePath}`);
  const stat = await lstat(absolute).catch(() =>
    fail(`missing file: ${relativePath}`),
  );
  if (!stat.isFile() || stat.isSymbolicLink())
    fail(`not a regular file: ${relativePath}`);
  const resolved = await realpath(absolute).catch(() =>
    fail(`cannot resolve file: ${relativePath}`),
  );
  if (!isWithin(rootReal, resolved))
    fail(`realpath escapes dist: ${relativePath}`);
  if (stat.size > MAX_FILE_BYTES) fail(`file exceeds 25 MiB: ${relativePath}`);
  return { absolute, bytes: stat.size };
}

async function listFiles(rootReal: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(relativeDir: string): Promise<void> {
    const absoluteDir = resolve(rootReal, relativeDir);
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const child = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = resolve(rootReal, child);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) fail(`symlink is forbidden: ${child}`);
      if (entry.isDirectory()) {
        const resolved = await realpath(absolute);
        if (!isWithin(rootReal, resolved))
          fail(`directory realpath escapes dist: ${child}`);
        await visit(child);
        continue;
      }
      if (!stat.isFile()) fail(`not a regular file: ${child}`);
      if (stat.size > MAX_FILE_BYTES) fail(`file exceeds 25 MiB: ${child}`);
      const resolved = await realpath(absolute);
      if (!isWithin(rootReal, resolved))
        fail(`realpath escapes dist: ${child}`);
      files.push(child);
      assertFileCount(files.length);
    }
  }
  await visit("");
  return files.sort();
}

async function assertOnlyAllowedDirectories(
  rootReal: string,
  allowedFiles: Set<string>,
): Promise<void> {
  async function visit(relativeDir: string): Promise<void> {
    const entries = await readdir(resolve(rootReal, relativeDir), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      const child = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = resolve(rootReal, child);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) fail(`symlink is forbidden: ${child}`);
      if (!stat.isDirectory()) continue;
      const resolved = await realpath(absolute);
      if (!isWithin(rootReal, resolved))
        fail(`directory realpath escapes dist: ${child}`);
      if (![...allowedFiles].some((path) => path.startsWith(`${child}/`))) {
        fail(`dist contains a forbidden directory: ${child}`);
      }
      await visit(child);
    }
  }
  await visit("");
}

function sameIdentity(
  left: { dev: number; ino: number; size: number },
  right: { dev: number; ino: number; size: number },
): boolean {
  return (
    left.dev === right.dev && left.ino === right.ino && left.size === right.size
  );
}

async function readVerifiedEntry(
  rootReal: string,
  relativePath: string,
): Promise<{ entry: ManifestEntry; content: Buffer }> {
  const file = await regularFile(rootReal, relativePath);
  const before = await lstat(file.absolute);
  const handle = await open(file.absolute, "r").catch(() =>
    fail(`cannot open file: ${relativePath}`),
  );
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameIdentity(before, opened))
      fail(`file identity changed before read: ${relativePath}`);
    const content = await handle.readFile();
    const after = await handle.stat();
    const pathnameAfter = await lstat(file.absolute).catch(() =>
      fail(`file changed while reading: ${relativePath}`),
    );
    if (
      !sameIdentity(opened, after) ||
      !sameIdentity(opened, pathnameAfter) ||
      content.byteLength !== opened.size
    ) {
      fail(`file changed while reading: ${relativePath}`);
    }
    return {
      entry: {
        path: `/${relativePath}`,
        bytes: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
      },
      content,
    };
  } finally {
    await handle.close();
  }
}

async function digestEntry(
  rootReal: string,
  relativePath: string,
): Promise<ManifestEntry> {
  return (await readVerifiedEntry(rootReal, relativePath)).entry;
}

function parseManifest(source: string): ViteManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    fail("Vite manifest is invalid JSON");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("Vite manifest must be an object");
  }
  return parsed as ViteManifest;
}

function manifestEntry(manifest: ViteManifest, key: string): ViteManifestEntry {
  const entry = manifest[key];
  if (!entry || typeof entry !== "object" || Array.isArray(entry))
    fail(`missing manifest entry: ${key}`);
  return entry;
}

function heavyChunkName(key: string, entry: ViteManifestEntry): string | undefined {
  if (key === "src/services/gameRuntimeBundle.ts") return "game runtime";
  const name = entry.name;
  if (name !== undefined && typeof name !== "string")
    fail(`${key}.name must be a string`);
  if (name === "engine" || name === "cards") return name;
  const file = checkedRelative(entry.file, `${key}.file`);
  const fileHeavyName = /(?:^|[/_-])(engine|cards)(?:[-_.]|$)/i
    .exec(file)?.[1]
    ?.toLowerCase();
  if (fileHeavyName === "engine" || fileHeavyName === "cards")
    return fileHeavyName;
  if (APPROVED_DYNAMIC_ENTRY_KEYS.has(key)) return undefined;
  const keyHeavyName = /(?:^|[/_-])(engine|cards)(?:[-_.]|$)/i
    .exec(key)?.[1]
    ?.toLowerCase();
  return keyHeavyName === "engine" || keyHeavyName === "cards"
    ? keyHeavyName
    : undefined;
}

export function validateManifestClosure(
  source: unknown,
): ValidatedManifestClosure {
  if (source === null || typeof source !== "object" || Array.isArray(source))
    fail("Vite manifest must be an object");
  const manifest = source as ViteManifest;
  const root = manifestEntry(manifest, "index.html");
  if (checkedBoolean(root.isEntry, "index.html.isEntry") !== true)
    fail("Vite manifest lacks root index.html entry");
  if (checkedBoolean(root.isDynamicEntry, "index.html.isDynamicEntry") === true)
    fail("root index.html must not be a dynamic entry");

  const rootDynamicImports = checkedList(
    root.dynamicImports,
    "index.html.dynamicImports",
  );
  const rootDynamicKeys = new Set<string>();
  for (const key of rootDynamicImports) {
    if (!APPROVED_DYNAMIC_ENTRY_KEYS.has(key))
      fail(`unknown dynamic manifest entry: ${key}`);
    if (rootDynamicKeys.has(key))
      fail(`duplicate dynamic manifest entry: ${key}`);
    rootDynamicKeys.add(key);
  }

  const reachable = new Set<string>();
  const visited = new Set<string>();
  const keyOwnership = new Map<string, string>();
  const javascriptOwners = new Map<string, string>();

  function visit(key: string): void {
    if (visited.has(key)) return;
    const entry = manifestEntry(manifest, key);
    visited.add(key);
    const isEntry = checkedBoolean(entry.isEntry, `${key}.isEntry`);
    const isDynamicEntry = checkedBoolean(
      entry.isDynamicEntry,
      `${key}.isDynamicEntry`,
    );
    if (key !== "index.html" && isEntry === true)
      fail(`sole isEntry root is index.html: ${key}`);
    if (
      key !== "index.html" &&
      isDynamicEntry === true &&
      !rootDynamicKeys.has(key)
    )
      fail(`unknown dynamic manifest entry: ${key}`);
    if (rootDynamicKeys.has(key) && isDynamicEntry !== true)
      fail(`malformed dynamic manifest entry: ${key}`);
    const file = checkedRelative(entry.file, `${key}.file`);
    assertScriptOrStyle(file, `${key}.file`);
    keyOwnership.set(key, file);
    if (extensionIs(file, ".js")) {
      const owner = javascriptOwners.get(file);
      if (owner)
        fail(`duplicate JavaScript output: ${file} (${owner}, ${key})`);
      javascriptOwners.set(file, key);
    }
    reachable.add(file);
    for (const css of checkedList(entry.css, `${key}.css`)) {
      if (!extensionIs(css, ".css")) fail(`${key}.css is not CSS: ${css}`);
      reachable.add(css);
    }
    for (const asset of checkedList(entry.assets, `${key}.assets`)) {
      assertReachableAsset(asset, `${key}.assets`);
      reachable.add(asset);
    }
    for (const importKey of checkedList(entry.imports, `${key}.imports`))
      visit(importKey);
    const dynamicImports =
      key === "index.html"
        ? rootDynamicImports
        : checkedList(entry.dynamicImports, `${key}.dynamicImports`);
    if (key !== "index.html" && dynamicImports.length > 0)
      fail(`unknown dynamic manifest entry: ${key}`);
    for (const importKey of dynamicImports) visit(importKey);
  }

  visit("index.html");
  for (const key of Object.keys(manifest)) {
    if (visited.has(key)) continue;
    const entry = manifestEntry(manifest, key);
    const file = checkedRelative(entry.file, `${key}.file`);
    const assetOnly =
      (extensionIs(file, ".css") || TRUSTED_BRAND_LOGO.test(file)) &&
      reachable.has(file) &&
      checkedBoolean(entry.isEntry, `${key}.isEntry`) !== true &&
      checkedBoolean(entry.isDynamicEntry, `${key}.isDynamicEntry`) !== true &&
      checkedList(entry.css, `${key}.css`).length === 0 &&
      checkedList(entry.assets, `${key}.assets`).length === 0 &&
      checkedList(entry.imports, `${key}.imports`).length === 0 &&
      checkedList(entry.dynamicImports, `${key}.dynamicImports`).length === 0;
    if (!assetOnly) fail(`unreachable manifest entry: ${key}`);
  }

  function assertStaticRouteClosure(
    key: string,
    route: (typeof STATIC_ROUTE_CLOSURES)[number]["label"],
    visitedKeys = new Set<string>(),
  ): void {
    if (visitedKeys.has(key)) return;
    visitedKeys.add(key);
    const entry = manifestEntry(manifest, key);
    const heavy = heavyChunkName(key, entry);
    if (heavy) {
      const file = keyOwnership.get(key);
      if (!file) fail(`missing reachable manifest ownership: ${key}`);
      fail(`static ${route} closure reaches ${heavy}: ${file}`);
    }
    for (const importKey of checkedList(entry.imports, `${key}.imports`))
      assertStaticRouteClosure(importKey, route, visitedKeys);
  }

  for (const route of STATIC_ROUTE_CLOSURES) {
    if (route.key !== "index.html" && !rootDynamicKeys.has(route.key)) continue;
    assertStaticRouteClosure(route.key, route.label);
  }

  const initialFiles = new Set<string>();
  const initialKeys = new Set<string>();
  function collectInitial(key: string): void {
    if (initialKeys.has(key)) return;
    initialKeys.add(key);
    const entry = manifestEntry(manifest, key);
    const file = keyOwnership.get(key);
    if (!file) fail(`missing reachable manifest ownership: ${key}`);
    const heavy = heavyChunkName(key, entry);
    if (heavy) fail(`initial HOME closure reaches ${heavy}: ${file}`);
    initialFiles.add(file);
    for (const css of checkedList(entry.css, `${key}.css`))
      initialFiles.add(css);
    for (const asset of checkedList(entry.assets, `${key}.assets`))
      initialFiles.add(asset);
    for (const importKey of checkedList(entry.imports, `${key}.imports`))
      collectInitial(importKey);
  }
  collectInitial("index.html");

  return { reachableFiles: reachable, initialFiles, keyOwnership };
}

function equalEntry(left: ManifestEntry, right: ManifestEntry): boolean {
  return (
    left.path === right.path &&
    left.bytes === right.bytes &&
    left.sha256 === right.sha256
  );
}

function storedRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactStoredKeys(
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

function parseStoredManifest(value: unknown, label: string): ManifestEntry[] {
  const record = storedRecord(value, label);
  exactStoredKeys(record, ["files", "schemaVersion"], label);
  if (record.schemaVersion !== 1) fail(`${label} schemaVersion must be 1`);
  if (!Array.isArray(record.files)) fail(`${label} files must be an array`);
  return record.files.map((candidate, index) => {
    const entry = storedRecord(candidate, `${label} files[${index}]`);
    exactStoredKeys(
      entry,
      ["bytes", "path", "sha256"],
      `${label} files[${index}]`,
    );
    return {
      path: entry.path as string,
      bytes: entry.bytes as number,
      sha256: entry.sha256 as string,
    };
  });
}

export function parseStoredBuildManifests(
  uploadRecord: unknown,
  responseRecord: unknown,
): BuildManifests {
  const manifests: BuildManifests = {
    schemaVersion: 1,
    upload: parseStoredManifest(uploadRecord, "upload manifest"),
    response: parseStoredManifest(responseRecord, "response manifest"),
  };
  validateExpected(manifests);
  return manifests;
}

function validateExpected(expected: BuildManifests): void {
  if (
    expected.schemaVersion !== 1 ||
    !Array.isArray(expected.upload) ||
    !Array.isArray(expected.response)
  ) {
    fail("expected manifest has an invalid schema");
  }
  assertFileCount(expected.upload.length);
  assertFileCount(expected.response.length);
  for (const entries of [expected.upload, expected.response]) {
    let previous = "";
    for (const entry of entries) {
      if (
        !entry ||
        typeof entry.path !== "string" ||
        !entry.path.startsWith("/") ||
        entry.path === "/"
      ) {
        fail("expected manifest has an invalid path");
      }
      checkedRelative(entry.path.slice(1), "expected manifest path");
      if (
        !Number.isSafeInteger(entry.bytes) ||
        entry.bytes < 0 ||
        entry.bytes > MAX_FILE_BYTES
      ) {
        fail("expected manifest has an invalid size");
      }
      if (!SHA256.test(entry.sha256) || entry.path <= previous)
        fail("expected manifest is not sorted and unique");
      previous = entry.path;
    }
  }
  const response = expected.upload.filter(
    (entry) =>
      entry.path !== "/_headers" &&
      entry.path !== `/${PAGES_ROUTES_PATH}` &&
      entry.path !== `/${PAGES_WORKER_PATH}`,
  );
  if (
    response.length !== expected.response.length ||
    response.some(
      (entry, index) => !equalEntry(entry, expected.response[index]!),
    )
  ) {
    fail("response manifest does not match upload manifest");
  }
}

async function entriesForDirectory(
  rootReal: string,
  expected: ManifestEntry[],
): Promise<ManifestEntry[]> {
  const expectedPaths = new Set(expected.map((entry) => entry.path.slice(1)));
  const files = await listFiles(rootReal);
  if (
    files.length !== expectedPaths.size ||
    files.some((path) => !expectedPaths.has(path))
  ) {
    fail("file set does not match expected upload manifest");
  }
  const actual = await Promise.all(
    files.map((path) => digestEntry(rootReal, path)),
  );
  actual.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  if (
    actual.length !== expected.length ||
    actual.some((entry, index) => !equalEntry(entry, expected[index]!))
  ) {
    fail("file bytes do not match expected upload manifest");
  }
  return actual;
}

export async function inspectBuild(distDir: string): Promise<BuildManifests> {
  const rootReal = await resolveDistRoot(distDir);
  const files = await listFiles(rootReal);
  if (!files.includes(MANIFEST_PATH)) fail("Vite manifest is missing");
  const manifestFile = await regularFile(rootReal, MANIFEST_PATH);
  const manifest = parseManifest(await readFile(manifestFile.absolute, "utf8"));
  const routesFile = await regularFile(rootReal, PAGES_ROUTES_PATH);
  const routesText = (await readFile(routesFile.absolute, "utf8")).replace(
    /\r\n?/g,
    "\n",
  );
  if (routesText !== EXPECTED_PAGES_ROUTES)
    fail("Pages routes must include only /api/v1/*");
  const closure = validateManifestClosure(manifest);
  const allowed = new Set([
    ...ALWAYS_ALLOWED,
    ...closure.reachableFiles,
    MANIFEST_PATH,
  ]);
  if (files.some((path) => !allowed.has(path)))
    fail("dist contains a forbidden or orphan file");
  await assertOnlyAllowedDirectories(rootReal, allowed);
  for (const path of allowed) await regularFile(rootReal, path);
  const uploadPaths = [...ALWAYS_ALLOWED, ...closure.reachableFiles].sort();
  const upload = await Promise.all(
    uploadPaths.map((path) => digestEntry(rootReal, path)),
  );
  const uploadByPath = new Map(
    upload.map((entry) => [entry.path.slice(1), entry]),
  );
  const initialBytes = [...closure.initialFiles].reduce((total, path) => {
    const entry = uploadByPath.get(path);
    if (!entry) fail(`initial HOME file is missing from upload: ${path}`);
    return total + entry.bytes;
  }, 0);
  if (initialBytes > MAX_INITIAL_HOME_BYTES)
    fail(`initial HOME payload exceeds ${MAX_INITIAL_HOME_BYTES} bytes`);
  const response = upload.filter(
    (entry) =>
      entry.path !== "/_headers" &&
      entry.path !== `/${PAGES_ROUTES_PATH}` &&
      entry.path !== `/${PAGES_WORKER_PATH}`,
  );
  return { schemaVersion: 1, upload, response };
}

export async function stageBuild(
  distDir: string,
  stagingDir: string,
  expected: BuildManifests,
): Promise<void> {
  validateExpected(expected);
  const inspected = await inspectBuild(distDir);
  if (
    inspected.upload.length !== expected.upload.length ||
    inspected.response.length !== expected.response.length ||
    inspected.upload.some(
      (entry, index) => !equalEntry(entry, expected.upload[index]!),
    ) ||
    inspected.response.some(
      (entry, index) => !equalEntry(entry, expected.response[index]!),
    )
  )
    fail("expected manifest differs from inspected build");
  if (!isAbsolute(stagingDir)) fail("staging directory must be absolute");
  const stagingRequested = resolve(stagingDir);
  const existingStaging = await lstat(stagingRequested)
    .then(() => true)
    .catch(() => false);
  if (existingStaging) fail("staging directory must not already exist");
  const repoReal = await realpath(REPOSITORY_ROOT).catch(() =>
    fail("repository root cannot be resolved"),
  );
  if (isWithin(repoReal, stagingRequested))
    fail("staging directory must be outside the repository");
  const stagingParent = dirname(stagingRequested);
  const stagingParentStat = await lstat(stagingParent).catch(() =>
    fail("staging parent directory does not exist"),
  );
  if (!stagingParentStat.isDirectory() || stagingParentStat.isSymbolicLink())
    fail("staging parent is not a regular directory");
  const stagingParentReal = await realpath(stagingParent);
  if (isWithin(repoReal, stagingParentReal))
    fail("staging directory must be outside the repository");
  const stagingTarget = resolve(stagingParentReal, basename(stagingRequested));
  await mkdir(stagingTarget);
  const stagingReal = await realpath(stagingTarget);
  if (!isWithin(stagingParentReal, stagingReal))
    fail("staging directory realpath escapes its parent");
  const sourceReal = await resolveDistRoot(distDir);

  for (const entry of expected.upload) {
    const sourcePath = entry.path.slice(1);
    const source = await readVerifiedEntry(sourceReal, sourcePath);
    if (!equalEntry(source.entry, entry))
      fail(`source bytes differ from expected manifest: ${entry.path}`);
    const destination = resolve(stagingReal, sourcePath);
    if (!isWithin(stagingReal, destination))
      fail(`staging path escapes: ${entry.path}`);
    const destinationParent = resolve(destination, "..");
    await mkdir(destinationParent, { recursive: true });
    const destinationParentStat = await lstat(destinationParent);
    const destinationParentReal = await realpath(destinationParent);
    if (
      !destinationParentStat.isDirectory() ||
      destinationParentStat.isSymbolicLink() ||
      !isWithin(stagingReal, destinationParentReal)
    ) {
      fail(`staging parent changed: ${entry.path}`);
    }
    const destinationHandle = await open(destination, "wx").catch(() =>
      fail(`cannot create staged file: ${entry.path}`),
    );
    try {
      await destinationHandle.writeFile(source.content);
      await destinationHandle.sync();
    } finally {
      await destinationHandle.close();
    }
    const copied = await digestEntry(stagingReal, sourcePath);
    if (!equalEntry(copied, entry))
      fail(`staged bytes differ from expected manifest: ${entry.path}`);
  }
  await entriesForDirectory(stagingReal, expected.upload);
}

export async function verifyStagedBuild(
  stagingDir: string,
  expected: BuildManifests,
): Promise<void> {
  validateExpected(expected);
  const stagingReal = await resolveDistRoot(stagingDir);
  await assertOnlyAllowedDirectories(
    stagingReal,
    new Set(expected.upload.map((entry) => entry.path.slice(1))),
  );
  await entriesForDirectory(stagingReal, expected.upload);
}

export type { BuildManifests, ManifestEntry } from "./types.ts";
