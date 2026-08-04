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
const MANIFEST_PATH = ".vite/manifest.json";
const ALWAYS_ALLOWED = new Set(["index.html", "favicon.svg", "_headers"]);
const SHA256 = /^[0-9a-f]{64}$/;

type ViteManifestEntry = {
  file?: unknown;
  isEntry?: unknown;
  imports?: unknown;
  dynamicImports?: unknown;
  css?: unknown;
  assets?: unknown;
};

type ViteManifest = Record<string, ViteManifestEntry>;

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

function extensionIs(path: string, extension: ".js" | ".css"): boolean {
  return path.toLowerCase().endsWith(extension);
}

function assertScriptOrStyle(path: string, label: string): void {
  if (!extensionIs(path, ".js") && !extensionIs(path, ".css")) {
    fail(`${label} is not JavaScript or CSS: ${path}`);
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

function reachableFiles(manifest: ViteManifest): Set<string> {
  const root = manifest["index.html"];
  if (!root || root.isEntry !== true)
    fail("Vite manifest lacks root index.html entry");
  const reachable = new Set<string>();
  const visited = new Set<string>();

  function visit(key: string): void {
    if (visited.has(key)) return;
    const entry = manifest[key];
    if (!entry || typeof entry !== "object")
      fail(`missing manifest entry: ${key}`);
    visited.add(key);
    const file = checkedRelative(entry.file, `${key}.file`);
    assertScriptOrStyle(file, `${key}.file`);
    reachable.add(file);
    for (const css of checkedList(entry.css, `${key}.css`)) {
      if (!extensionIs(css, ".css")) fail(`${key}.css is not CSS: ${css}`);
      reachable.add(css);
    }
    for (const asset of checkedList(entry.assets, `${key}.assets`)) {
      assertScriptOrStyle(asset, `${key}.assets`);
      reachable.add(asset);
    }
    for (const importKey of [
      ...checkedList(entry.imports, `${key}.imports`),
      ...checkedList(entry.dynamicImports, `${key}.dynamicImports`),
    ])
      visit(importKey);
  }

  visit("index.html");
  for (const key of Object.keys(manifest)) {
    if (!visited.has(key)) fail(`unreachable manifest entry: ${key}`);
  }
  return reachable;
}

function equalEntry(left: ManifestEntry, right: ManifestEntry): boolean {
  return (
    left.path === right.path &&
    left.bytes === right.bytes &&
    left.sha256 === right.sha256
  );
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
    (entry) => entry.path !== "/_headers",
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
  const closure = reachableFiles(manifest);
  const allowed = new Set([...ALWAYS_ALLOWED, ...closure, MANIFEST_PATH]);
  if (files.some((path) => !allowed.has(path)))
    fail("dist contains a forbidden or orphan file");
  await assertOnlyAllowedDirectories(rootReal, allowed);
  for (const path of allowed) await regularFile(rootReal, path);
  const uploadPaths = [...ALWAYS_ALLOWED, ...closure].sort();
  const upload = await Promise.all(
    uploadPaths.map((path) => digestEntry(rootReal, path)),
  );
  const response = upload.filter((entry) => entry.path !== "/_headers");
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

export type { BuildManifests, ManifestEntry } from "./types.ts";
