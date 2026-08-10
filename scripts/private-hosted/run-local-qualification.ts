import { createWriteStream } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildManifests, ManifestEntry } from "./types.js";
import { inspectBuild, stageBuild, verifyStagedBuild } from "./manifest.js";

const HOST = "127.0.0.1";
const PORT = 5196;
const WRANGLER_COMPATIBILITY_DATE = "2026-08-06";
const MODULE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const FINAL_PRODUCER_ENV = "PRIVATE_HOSTED_FINAL_PRODUCER";

type LocalQualificationMode = "standalone" | "prepared";

export type LocalQualificationPaths = {
  repoRoot: string;
  runDir: string;
  stagingDir: string;
  uploadManifestPath: string;
  responseManifestPath: string;
};

type ServerInput = {
  cwd: string;
  args: string[];
  persistDir: string;
  logPath: string;
};

type ServerHandle = { stop: () => Promise<void> };

type PathStat = Awaited<ReturnType<typeof lstat>>;

type LocalQualificationControls = {
  assertPortAvailable: () => Promise<void>;
  startServer: (input: ServerInput) => Promise<ServerHandle>;
  runPlaywright: (environment: NodeJS.ProcessEnv) => Promise<void>;
  inspectPath: (path: string) => Promise<PathStat>;
  canonicalizePath: (path: string) => Promise<string>;
  createDirectory: (path: string) => Promise<void>;
};

function fail(message: string): never {
  throw new Error(`private hosted local qualification rejected: ${message}`);
}

function within(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

function requiredAbsolute(value: string | undefined, name: string): string {
  if (!value || !isAbsolute(value)) fail(`${name} must be absolute`);
  return resolve(value);
}

function assertExternal(repoRoot: string, path: string, name: string): void {
  if (within(repoRoot, path)) fail(`${name} must be outside the repository`);
}

export function parseLocalQualificationArgs(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): { mode: LocalQualificationMode } {
  const modes: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--mode") fail(`unexpected argument: ${args[index]}`);
    const value = args[index + 1];
    if (value === undefined) fail("--mode requires a value");
    modes.push(value);
    index += 1;
  }
  if (modes.length !== 1) fail("exactly one --mode is required");
  const mode = modes[0];
  if (mode !== "standalone" && mode !== "prepared") {
    fail("--mode must be standalone or prepared");
  }
  if (mode === "prepared" && environment[FINAL_PRODUCER_ENV] !== "1") {
    fail("prepared mode is reserved for the final producer");
  }
  return { mode };
}

export function resolvePrivateHostedEnvironment(
  environment: NodeJS.ProcessEnv,
  repoRoot = MODULE_REPOSITORY_ROOT,
): LocalQualificationPaths {
  const root = resolve(repoRoot);
  const runDir = requiredAbsolute(
    environment.PRIVATE_HOSTED_RUN_DIR,
    "PRIVATE_HOSTED_RUN_DIR",
  );
  const stagingDir = requiredAbsolute(
    environment.PRIVATE_HOSTED_STAGING_DIR,
    "PRIVATE_HOSTED_STAGING_DIR",
  );
  const uploadManifestPath = requiredAbsolute(
    environment.PRIVATE_HOSTED_UPLOAD_MANIFEST,
    "PRIVATE_HOSTED_UPLOAD_MANIFEST",
  );
  const responseManifestPath = requiredAbsolute(
    environment.PRIVATE_HOSTED_RESPONSE_MANIFEST,
    "PRIVATE_HOSTED_RESPONSE_MANIFEST",
  );
  for (const [name, path] of [
    ["run directory", runDir],
    ["staging directory", stagingDir],
    ["upload manifest", uploadManifestPath],
    ["response manifest", responseManifestPath],
  ] as const) {
    assertExternal(root, path, name);
  }
  if (!within(runDir, stagingDir))
    fail("staging directory must be in run directory");
  if (!within(runDir, uploadManifestPath))
    fail("upload manifest must be in run directory");
  if (!within(runDir, responseManifestPath))
    fail("response manifest must be in run directory");
  return {
    repoRoot: root,
    runDir,
    stagingDir,
    uploadManifestPath,
    responseManifestPath,
  };
}

function parseEntries(value: unknown, label: string): ManifestEntry[] {
  if (!Array.isArray(value)) fail(`${label} files must be an array`);
  return value.map((candidate, index) => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    ) {
      return fail(`${label} files[${index}] must be an object`);
    }
    const item = candidate as Record<string, unknown>;
    if (
      typeof item.path !== "string" ||
      !item.path.startsWith("/") ||
      typeof item.bytes !== "number" ||
      !Number.isSafeInteger(item.bytes) ||
      item.bytes < 0 ||
      typeof item.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/.test(item.sha256)
    ) {
      return fail(`${label} files[${index}] is invalid`);
    }
    return { path: item.path, bytes: item.bytes, sha256: item.sha256 };
  });
}

async function readManifest(
  path: string,
  label: string,
): Promise<ManifestEntry[]> {
  const stat = await lstat(path).catch(() => fail(`${label} does not exist`));
  if (!stat.isFile() || stat.isSymbolicLink())
    fail(`${label} must be a regular file`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fail(`${label} must be valid JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(`${label} must be an object`);
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1) fail(`${label} schemaVersion must be 1`);
  return parseEntries(record.files, label);
}

async function loadPreparedManifests(
  paths: LocalQualificationPaths,
): Promise<BuildManifests> {
  const upload = await readManifest(
    paths.uploadManifestPath,
    "upload manifest",
  );
  const response = await readManifest(
    paths.responseManifestPath,
    "response manifest",
  );
  return { schemaVersion: 1, upload, response };
}

export async function assertPrivateHostedPortAvailable(): Promise<void> {
  const server = createServer();
  await new Promise<void>((done, reject) => {
    server.once("error", () =>
      reject(new Error(`port ${PORT} is already in use`)),
    );
    server.listen(PORT, HOST, () => {
      server.close((error) => (error ? reject(error) : done()));
    });
  });
}

function childEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    SystemRoot: process.env.SystemRoot,
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.platform === "win32" ? undefined : process.env.HOME,
    CI: "1",
    ...extra,
  };
}

function waitForClose(child: ChildProcess): Promise<number> {
  return new Promise((done, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) reject(new Error(`process exited by signal ${signal}`));
      else done(code ?? 1);
    });
    if (
      child.exitCode !== null &&
      (child.stdout === null || child.stdout.closed) &&
      (child.stderr === null || child.stderr.closed)
    ) {
      done(child.exitCode);
    }
  });
}

async function waitForServer(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) fail("Wrangler exited before becoming ready");
    try {
      const response = await fetch(`http://${HOST}:${PORT}/`, {
        redirect: "manual",
      });
      await response.body?.cancel();
      return;
    } catch {
      await new Promise((done) => setTimeout(done, 100));
    }
  }
  fail("Wrangler did not become ready within 30 seconds");
}

async function startWrangler(input: ServerInput): Promise<ServerHandle> {
  const output = createWriteStream(input.logPath, { flags: "wx" });
  const wranglerBin = resolve(
    MODULE_REPOSITORY_ROOT,
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  const child = spawn(process.execPath, [wranglerBin, ...input.args], {
    cwd: input.cwd,
    env: childEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.pipe(output, { end: false });
  child.stderr?.pipe(output, { end: false });
  try {
    await waitForServer(child);
  } catch (error) {
    child.kill();
    await waitForClose(child).catch(() => undefined);
    await new Promise<void>((done) => output.end(done));
    throw error;
  }
  return {
    stop: async () => {
      if (child.exitCode === null) child.kill();
      await waitForClose(child).catch(() => undefined);
      await new Promise<void>((done) => output.end(done));
    },
  };
}

async function runPlaywright(environment: NodeJS.ProcessEnv): Promise<void> {
  const cli = resolve(
    MODULE_REPOSITORY_ROOT,
    "node_modules",
    "@playwright",
    "test",
    "cli.js",
  );
  const child = spawn(
    process.execPath,
    [cli, "test", "--config", "playwright.private-hosted.config.ts"],
    {
      cwd: MODULE_REPOSITORY_ROOT,
      env: childEnvironment(environment),
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const exitCode = await waitForClose(child);
  if (exitCode !== 0) fail(`Playwright exited with code ${exitCode}`);
}

const DEFAULT_CONTROLS: LocalQualificationControls = {
  assertPortAvailable: assertPrivateHostedPortAvailable,
  startServer: startWrangler,
  runPlaywright,
  inspectPath: lstat,
  canonicalizePath: realpath,
  createDirectory: async (path) => {
    await mkdir(path);
  },
};

async function canonicalExistingPath(
  requestedPath: string,
  label: string,
  kind: "directory" | "file",
  controls: LocalQualificationControls,
): Promise<string> {
  const details = await controls
    .inspectPath(requestedPath)
    .catch(() => fail(`${label} does not exist`));
  if (
    details.isSymbolicLink() ||
    (kind === "directory" ? !details.isDirectory() : !details.isFile())
  ) {
    fail(`${label} must be a regular ${kind}`);
  }
  return resolve(
    await controls
      .canonicalizePath(requestedPath)
      .catch(() => fail(`${label} real path is unavailable`)),
  );
}

async function canonicalPreparedPaths(
  paths: LocalQualificationPaths,
  controls: LocalQualificationControls,
): Promise<LocalQualificationPaths> {
  const repoReal = await canonicalExistingPath(
    paths.repoRoot,
    "repository",
    "directory",
    controls,
  );
  const runReal = await canonicalExistingPath(
    paths.runDir,
    "run directory",
    "directory",
    controls,
  );
  if (within(repoReal, runReal))
    fail("run directory real path must be outside the repository");
  const stagingReal = await canonicalExistingPath(
    paths.stagingDir,
    "staging directory",
    "directory",
    controls,
  );
  if (stagingReal === runReal || !within(runReal, stagingReal)) {
    fail("staging directory real path must remain inside the run directory");
  }
  const uploadManifestReal = await canonicalExistingPath(
    paths.uploadManifestPath,
    "upload manifest",
    "file",
    controls,
  );
  const responseManifestReal = await canonicalExistingPath(
    paths.responseManifestPath,
    "response manifest",
    "file",
    controls,
  );
  if (!within(runReal, uploadManifestReal)) {
    fail("upload manifest real path must remain inside the run directory");
  }
  if (!within(runReal, responseManifestReal)) {
    fail("response manifest real path must remain inside the run directory");
  }
  if (uploadManifestReal === responseManifestReal) {
    fail("upload and response manifests must be separate files");
  }
  return {
    repoRoot: repoReal,
    runDir: runReal,
    stagingDir: stagingReal,
    uploadManifestPath: uploadManifestReal,
    responseManifestPath: responseManifestReal,
  };
}

async function createRunDirectory(
  runDir: string,
  name: string,
  label: string,
  controls: LocalQualificationControls,
): Promise<string> {
  const requested = resolve(runDir, name);
  if (!within(runDir, requested) || requested === runDir) {
    fail(`${label} path must be inside the run directory`);
  }
  await controls
    .createDirectory(requested)
    .catch(() => fail(`${label} must be newly created`));
  const canonical = await canonicalExistingPath(
    requested,
    label,
    "directory",
    controls,
  );
  if (!within(runDir, canonical) || canonical === runDir) {
    fail(`${label} real path must remain inside the run directory`);
  }
  return canonical;
}

async function runPreparedLocalQualification(
  paths: LocalQualificationPaths,
  controls: LocalQualificationControls,
): Promise<void> {
  const safePaths = await canonicalPreparedPaths(paths, controls);
  const manifests = await loadPreparedManifests(safePaths);
  await verifyStagedBuild(safePaths.stagingDir, manifests);
  await controls.assertPortAvailable();
  const persistDir = await createRunDirectory(
    safePaths.runDir,
    "wrangler-persist",
    "Wrangler persistence directory",
    controls,
  );
  const controlDir = await createRunDirectory(
    safePaths.runDir,
    "wrangler-control",
    "Wrangler control directory",
    controls,
  );
  const server = await controls.startServer({
    cwd: safePaths.stagingDir,
    args: [
      "pages",
      "dev",
      safePaths.stagingDir,
      "--cwd",
      controlDir,
      "--ip",
      HOST,
      "--port",
      String(PORT),
      "--compatibility-date",
      WRANGLER_COMPATIBILITY_DATE,
      "--persist-to",
      persistDir,
    ],
    persistDir,
    logPath: resolve(safePaths.runDir, "wrangler.log"),
  });
  let testError: unknown;
  try {
    await controls.runPlaywright({
      PRIVATE_HOSTED_RUN_DIR: safePaths.runDir,
      PRIVATE_HOSTED_STAGING_DIR: safePaths.stagingDir,
      PRIVATE_HOSTED_UPLOAD_MANIFEST: safePaths.uploadManifestPath,
      PRIVATE_HOSTED_RESPONSE_MANIFEST: safePaths.responseManifestPath,
    });
  } catch (error) {
    testError = error;
  } finally {
    await server.stop();
  }
  await verifyStagedBuild(safePaths.stagingDir, manifests);
  if (testError !== undefined) throw testError;
}

export async function runPreparedLocalQualificationForTest(
  paths: LocalQualificationPaths & { manifests?: BuildManifests },
  controls: Partial<LocalQualificationControls>,
): Promise<void> {
  await runPreparedLocalQualification(paths, {
    ...DEFAULT_CONTROLS,
    ...controls,
  });
}

async function runCommand(
  file: string,
  args: string[],
  cwd: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  const child = spawn(file, args, {
    cwd,
    env: childEnvironment(environment),
    stdio: "inherit",
    windowsHide: true,
  });
  const exitCode = await waitForClose(child);
  if (exitCode !== 0) fail(`${file} exited with code ${exitCode}`);
}

async function createStandalonePaths(
  repoRoot: string,
): Promise<LocalQualificationPaths> {
  const runDir = await mkdtemp(
    join(tmpdir(), "conan-private-hosted-qualification-"),
  );
  const distDir = resolve(runDir, "dist");
  const stagingDir = resolve(runDir, "staging");
  const uploadManifestPath = resolve(runDir, "upload-manifest.json");
  const responseManifestPath = resolve(runDir, "response-manifest.json");
  const viteBin = resolve(repoRoot, "node_modules", "vite", "bin", "vite.js");
  await runCommand(
    process.execPath,
    [
      viteBin,
      "build",
      "--manifest",
      "--config",
      "vite.config.private-hosted.ts",
      "--outDir",
      distDir,
      "--emptyOutDir",
    ],
    repoRoot,
    {},
  );
  const manifests = await inspectBuild(distDir);
  await stageBuild(distDir, stagingDir, manifests);
  await writeFile(
    uploadManifestPath,
    `${JSON.stringify({ schemaVersion: 1, files: manifests.upload }, null, 2)}\n`,
    { flag: "wx" },
  );
  await writeFile(
    responseManifestPath,
    `${JSON.stringify({ schemaVersion: 1, files: manifests.response }, null, 2)}\n`,
    { flag: "wx" },
  );
  return {
    repoRoot,
    runDir,
    stagingDir,
    uploadManifestPath,
    responseManifestPath,
  };
}

export async function runLocalQualificationCli(
  args: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const { mode } = parseLocalQualificationArgs(args, environment);
  const paths =
    mode === "standalone"
      ? await createStandalonePaths(MODULE_REPOSITORY_ROOT)
      : resolvePrivateHostedEnvironment(environment);
  await runPreparedLocalQualification(paths, DEFAULT_CONTROLS);
  process.stdout.write(`${paths.runDir}\n`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await runLocalQualificationCli(process.argv.slice(2));
}
