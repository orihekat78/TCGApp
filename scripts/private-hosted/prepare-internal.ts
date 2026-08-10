import type { BuildManifests } from "./types.js";
import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import {
  lstat,
  mkdtemp,
  open,
  readFile,
  realpath,
  rename,
} from "node:fs/promises";
import {
  basename,
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { promisify } from "node:util";
import { loadConfigFromFile, resolveConfig } from "vite";
import { inspectBuild, stageBuild } from "./manifest.js";

export type PrepareReleaseOptions = {
  repoRoot: string;
  stagingDir: string;
  evidenceDir: string;
};

export type PrivateCommand = {
  file: string;
  args: string[];
  cwd?: string;
  maxBuffer?: number;
  env?: NodeJS.ProcessEnv;
};

export type PrivateCommandResult = {
  stdout: string;
  stderr: string;
};

export type PrivatePrepareControls = {
  moduleRoot: string;
  expectedConfigSha256: string;
  runBuild?: () => Promise<void>;
  runCommand?: (command: PrivateCommand) => Promise<PrivateCommandResult>;
  verifyWrangler?: () => Promise<string>;
  writeEvidenceFile?: (path: string, data: string) => Promise<void>;
};

export type PreparedRelease = {
  manifests: BuildManifests;
  metadataPath: string;
};

const execFile = promisify(execFileCallback);
const WRANGLER_VERSION = "4.118.0";
const NPM_VERSION = "11.12.1";
const ROOT_ENTRY = "meta-app/index.html";
const RELEASE_CONFIG = "vite.config.private-hosted.ts";
const PACKAGE_BUILD_COMMAND = "vite build";
const PACKAGE_META_BUILD_COMMAND = `vite build --config ${RELEASE_CONFIG}`;
const RELEASE_BUILD_COMMAND = "npm run build:meta -- --manifest";
const FIXED_GIT_PATH =
  process.platform === "win32"
    ? resolve(dirname(process.execPath), "..", "Git", "cmd", "git.exe")
    : "/usr/bin/git";
const NULL_DEVICE = process.platform === "win32" ? "NUL" : "/dev/null";
const GIT_ARGUMENT_PREFIX = [
  "--no-optional-locks",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
];

type Snapshot = { commit: string; packageLockSha256: string };
type Contract = { packageJson: Record<string, unknown> };

function fail(message: string): never {
  throw new Error(`private hosted prepare rejected: ${message}`);
}
function within(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}
function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function sameManifests(left: BuildManifests, right: BuildManifests): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
async function regularDirectory(path: string, label: string): Promise<string> {
  const stat = await lstat(path).catch(() => fail(`${label} does not exist`));
  if (!stat.isDirectory() || stat.isSymbolicLink())
    fail(`${label} is not a regular directory`);
  return realpath(path).catch(() => fail(`${label} cannot be resolved`));
}
async function freshExternal(
  path: string,
  root: string,
  label: string,
): Promise<void> {
  if (!isAbsolute(path)) fail(`${label} directory must be absolute`);
  const requested = resolve(path);
  if (
    await lstat(requested)
      .then(() => true)
      .catch(() => false)
  )
    fail(`${label} directory must not already exist`);
  if (within(root, requested))
    fail(`${label} directory must be outside the repository`);
  const parent = await regularDirectory(dirname(requested), `${label} parent`);
  if (
    within(root, parent) ||
    resolve(parent, basename(requested)) !== requested
  )
    fail(`${label} directory must be outside the repository`);
}
function assertNoAmbientGitAuthority(): void {
  if (
    Object.entries(process.env).some(
      ([key, value]) =>
        value !== undefined && /^GIT_/i.test(key) && !/^GIT_PAGER$/i.test(key),
    )
  )
    fail("Git must not inherit ambient repository authority");
}
async function fixedGitExecutable(): Promise<string> {
  const stat = await lstat(FIXED_GIT_PATH).catch(() =>
    fail("fixed Git executable is missing"),
  );
  if (!stat.isFile() || stat.isSymbolicLink())
    fail("fixed Git executable is not a regular file");
  return realpath(FIXED_GIT_PATH).catch(() =>
    fail("fixed Git executable cannot be resolved"),
  );
}
function sanitizedGitEnvironment(gitExecutable: string): NodeJS.ProcessEnv {
  const system32 =
    process.platform === "win32" ? "C:\\Windows\\System32" : "/usr/bin";
  return {
    PATH: [dirname(gitExecutable), dirname(process.execPath), system32].join(
      delimiter,
    ),
    SystemRoot: process.platform === "win32" ? "C:\\Windows" : undefined,
    SYSTEMROOT: process.platform === "win32" ? "C:\\Windows" : undefined,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: NULL_DEVICE,
    GIT_ATTR_NOSYSTEM: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
  };
}
async function rawGit(
  root: string,
  args: string[],
): Promise<{ stdout: string }> {
  const executable = await fixedGitExecutable();
  return execFile(executable, [...GIT_ARGUMENT_PREFIX, "-C", root, ...args], {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    env: sanitizedGitEnvironment(executable),
  });
}
async function git(root: string, args: string[]): Promise<string> {
  try {
    return (await rawGit(root, args)).stdout;
  } catch {
    return fail(`git ${args.join(" ")} failed`);
  }
}
async function gitBlob(root: string, object: string): Promise<Buffer> {
  try {
    const executable = await fixedGitExecutable();
    return (
      await execFile(
        executable,
        [...GIT_ARGUMENT_PREFIX, "-C", root, "cat-file", "blob", object],
        {
          windowsHide: true,
          encoding: "buffer",
          maxBuffer: 10 * 1024 * 1024,
          env: sanitizedGitEnvironment(executable),
        },
      )
    ).stdout as Buffer;
  } catch {
    return fail(`git cat-file blob ${object} failed`);
  }
}
function gitBlobObjectId(bytes: Buffer, algorithm: "sha1" | "sha256"): string {
  return createHash(algorithm)
    .update(`blob ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}
function normalizedCrlfText(bytes: Buffer): Buffer | undefined {
  if (bytes.includes(0) || !bytes.includes(Buffer.from("\r\n")))
    return undefined;
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) return undefined;
  return Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
}
async function objectFormat(root: string): Promise<"sha1" | "sha256"> {
  const format = (
    await git(root, ["rev-parse", "--show-object-format"])
  ).trim();
  if (format !== "sha1" && format !== "sha256")
    fail("unsupported Git object format");
  return format;
}
async function assertRawTrackedFileMatchesHead(
  root: string,
  path: string,
  expectedObjectId: string,
  expectedMode: "100644" | "100755",
  algorithm: "sha1" | "sha256",
): Promise<void> {
  const absolute = resolve(root, path);
  if (!within(root, absolute)) fail(`tracked file escapes repository: ${path}`);
  const stat = await lstat(absolute).catch(() =>
    fail(`tracked file is missing: ${path}`),
  );
  assertRegularAuthorityFile(stat, path);
  if (((stat.mode & 0o111) !== 0) !== (expectedMode === "100755"))
    fail(`tracked file mode differs from HEAD: ${path}`);
  const bytes = await readFile(absolute);
  if (gitBlobObjectId(bytes, algorithm) === expectedObjectId) return;
  const normalized = normalizedCrlfText(bytes);
  if (normalized && gitBlobObjectId(normalized, algorithm) === expectedObjectId)
    return;
  fail(`tracked file differs from HEAD: ${path}`);
}
async function assertRawTrackedTreeMatchesHead(root: string): Promise<void> {
  const algorithm = await objectFormat(root);
  const tree = await git(root, ["ls-tree", "-rz", "--full-tree", "HEAD"]);
  for (const record of tree.split("\0").filter(Boolean)) {
    const tab = record.indexOf("\t");
    if (tab < 0) fail("HEAD tree entry is invalid");
    const header = record.slice(0, tab);
    const path = record.slice(tab + 1);
    const match = /^(100644|100755) blob ([0-9a-f]+)$/.exec(header);
    if (!match) fail(`tracked non-regular files are forbidden: ${path}`);
    await assertRawTrackedFileMatchesHead(
      root,
      path,
      match[2]!,
      match[1] as "100644" | "100755",
      algorithm,
    );
  }
}
async function authorityFile(root: string, path: string): Promise<string> {
  const absolute = resolve(root, path);
  if (!within(root, absolute))
    fail(`authority file escapes repository: ${path}`);
  const stat = await lstat(absolute).catch(() =>
    fail(`authority file is missing: ${path}`),
  );
  assertRegularAuthorityFile(stat, path);
  if (/^[a-z]/m.test(await git(root, ["ls-files", "-v", "--", path])))
    fail(`authority file has an unsafe Git index flag: ${path}`);
  const tree = await git(root, ["ls-tree", "HEAD", "--", path]);
  const match = /^(100644|100755)\s+blob\s+([0-9a-f]+)\t/m.exec(tree);
  if (!match) fail(`authority file is not tracked at HEAD: ${path}`);
  if (((stat.mode & 0o111) !== 0) !== (match[1] === "100755"))
    fail(`authority file mode differs from HEAD: ${path}`);
  await assertRawTrackedFileMatchesHead(
    root,
    path,
    match[2]!,
    match[1] as "100644" | "100755",
    await objectFormat(root),
  );
  return match[2];
}
/** Internal seam: keeps the Windows-safe lstat rejection branch directly testable. */
export function assertRegularAuthorityFile(
  stat: Pick<Awaited<ReturnType<typeof lstat>>, "isFile" | "isSymbolicLink">,
  path: string,
): void {
  if (!stat.isFile() || stat.isSymbolicLink())
    fail(`authority file is not a regular file: ${path}`);
}
async function snapshot(root: string): Promise<Snapshot> {
  await assertNoTrackedSymlinks(root);
  if (
    (await git(root, [
      "diff-index",
      "--cached",
      "--name-only",
      "HEAD",
      "--",
    ])) !== "" ||
    (await git(root, ["ls-files", "--others", "--exclude-standard"])) !== ""
  )
    fail("git status is not clean");
  const assumeUnchanged = await git(root, ["ls-files", "-v"]);
  const skipWorktree = await git(root, ["ls-files", "-t"]);
  if (/^[a-z]\s/m.test(assumeUnchanged) || /^S\s/m.test(skipWorktree)) {
    fail("Git index contains unsafe tracked-source flags");
  }
  await assertRawTrackedTreeMatchesHead(root);
  let branch = "";
  try {
    branch = (
      await rawGit(root, ["symbolic-ref", "--quiet", "--short", "HEAD"])
    ).stdout;
  } catch {
    fail("HEAD is detached");
  }
  if (branch.trim() === "") fail("HEAD is detached");
  const lock = resolve(root, "package-lock.json");
  const stat = await lstat(lock).catch(() =>
    fail("package-lock.json is missing"),
  );
  if (!stat.isFile() || stat.isSymbolicLink())
    fail("package-lock.json is not a regular file");
  return {
    commit: (await git(root, ["rev-parse", "HEAD"])).trim(),
    packageLockSha256: createHash("sha256")
      .update(await readFile(lock))
      .digest("hex"),
  };
}

async function assertNoIgnoredBuildInputs(root: string): Promise<void> {
  const ignored = await git(root, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--",
    "src",
    "meta-app",
    "public",
    "index.html",
    ":(glob,icase)vite.config.*",
    "package.json",
    "package-lock.json",
    ":(glob)package*.json",
    ":(glob)tsconfig*.json",
    ":(glob).env*",
    ".npmrc",
    ":(glob,icase)postcss.config.*",
    ":(glob,icase).postcssrc*",
    ":(glob,icase)tailwind.config.*",
    ".browserslistrc",
    "ct-d08-cards.json",
    "ct-d11-cards.json",
  ]);
  for (const path of ignored.split(/\r?\n/).filter(Boolean)) {
    if (
      path === ".npmrc" ||
      path.startsWith("src/") ||
      path.startsWith("meta-app/") ||
      path.startsWith("public/") ||
      /^(?:package.*\.json|tsconfig.*\.json|\.env.*|vite\.config\..+|postcss\.config\..+|\.postcssrc(?:\..+)?|tailwind\.config\..*)$/i.test(
        path,
      ) ||
      [
        "index.html",
        "package.json",
        "package-lock.json",
        ".browserslistrc",
        "ct-d08-cards.json",
        "ct-d11-cards.json",
      ].includes(path)
    )
      fail(`ignored build input is forbidden: ${path}`);
  }
}

async function assertNoTrackedSymlinks(root: string): Promise<void> {
  if (/^120000\s/m.test(await git(root, ["ls-files", "-s"])))
    fail("tracked symbolic links are forbidden");
}

async function assertNoProjectNpmrc(root: string): Promise<void> {
  if (
    await lstat(resolve(root, ".npmrc"))
      .then(() => true)
      .catch(() => false)
  )
    fail("project .npmrc is forbidden");
}

function assertNoAmbientNpmAuthority(): void {
  if (
    Object.entries(process.env).some(
      ([key, value]) =>
        value !== undefined &&
        /^NPM_CONFIG_(?:SCRIPT_SHELL|NODE_OPTIONS)$/i.test(key),
    )
  )
    fail("npm must not inherit ambient NPM_CONFIG authority");
}

function isLocalConfigPath(specifier: string): boolean {
  return (
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(specifier) ||
    /^file:/i.test(specifier)
  );
}

function assertNoLocalConfigImports(source: string): void {
  const imports = [
    /(?:\bimport\s*(?:[^'";]*?\s+from\s*)?|\bexport\s+[^'";]*?\s+from\s*)["']([^"']+)["']/g,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const expression of imports)
    for (const match of source.matchAll(expression)) {
      const specifier = match[1] ?? "";
      if (isLocalConfigPath(specifier))
        fail("Vite config must not import local executable dependencies");
    }
  for (const match of source.matchAll(/(["'])([^"'\\]*(?:\\.[^"'\\]*)*)\1/g))
    if (isLocalConfigPath(match[2] ?? ""))
      fail("Vite config must not import local executable dependencies");
}
async function canonicalRepository(
  root: string,
  moduleRoot: string,
): Promise<void> {
  if (root !== (await regularDirectory(moduleRoot, "module repository root")))
    fail("repository root must be the canonical module repository root");
  if (
    root !==
    (await realpath(
      (await git(root, ["rev-parse", "--show-toplevel"])).trim(),
    ).catch(() => fail("Git repository root cannot be resolved")))
  )
    fail("Git repository root differs from requested repository root");
}

async function contract(
  root: string,
  expectedConfigSha256: string,
): Promise<Contract> {
  await assertNoIgnoredBuildInputs(root);
  await assertNoProjectNpmrc(root);
  assertNoAmbientNpmAuthority();
  let configBlob = "";
  for (const path of [
    "package.json",
    "package-lock.json",
    ROOT_ENTRY,
    RELEASE_CONFIG,
  ]) {
    const blob = await authorityFile(root, path);
    if (path === RELEASE_CONFIG) configBlob = blob;
  }
  const configBytes = await readFile(resolve(root, RELEASE_CONFIG));
  if (
    createHash("sha256")
      .update(await gitBlob(root, `HEAD:${RELEASE_CONFIG}`))
      .digest("hex") !== expectedConfigSha256
  )
    fail("Vite config does not match the reviewed identity");
  if (!configBlob) fail("Vite config is not tracked");
  let pkg: Record<string, unknown> | undefined;
  try {
    pkg = record(
      JSON.parse(await readFile(resolve(root, "package.json"), "utf8")),
    );
  } catch {
    fail("package.json is invalid");
  }
  if (!pkg) fail("package.json is invalid");
  try {
    if (
      !record(
        JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8")),
      )
    )
      fail("package-lock.json is invalid");
  } catch {
    fail("package-lock.json is invalid");
  }
  const scripts = record(pkg.scripts);
  if (scripts?.build !== PACKAGE_BUILD_COMMAND)
    fail("package.json build command must be exactly vite build");
  if (scripts?.["build:meta"] !== PACKAGE_META_BUILD_COMMAND)
    fail(
      `package.json build:meta command must be exactly ${PACKAGE_META_BUILD_COMMAND}`,
    );
  if (scripts?.prebuild !== undefined || scripts?.postbuild !== undefined)
    fail("package.json must not define prebuild or postbuild");
  if (
    scripts?.["prebuild:meta"] !== undefined ||
    scripts?.["postbuild:meta"] !== undefined
  )
    fail("package.json must not define prebuild:meta or postbuild:meta");
  if (
    pkg.packageManager !== `npm@${NPM_VERSION}` ||
    record(pkg.engines)?.node !== "24.x" ||
    !process.version.startsWith("v24.")
  )
    fail("package.json Node and npm authority must be exact");
  for (const filename of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local",
  ]) {
    if (
      await lstat(resolve(root, filename))
        .then(() => true)
        .catch(() => false)
    )
      fail(`Vite environment file is forbidden: ${filename}`);
  }
  if (
    Object.entries(process.env).some(
      ([key, value]) =>
        value !== undefined &&
        (/^(?:VITE_|ESBUILD_)/i.test(key) ||
          /^(?:NODE_OPTIONS|NODE_PATH)$/i.test(key)),
    )
  )
    fail("Vite must not inherit ambient environment authority");
  const configPath = resolve(root, RELEASE_CONFIG);
  const source = configBytes.toString("utf8");
  if (/\bprocess\.(?:env|argv)\b|\bnpm_lifecycle_event\b/i.test(source))
    fail("Vite config must not depend on ambient process state");
  assertNoLocalConfigImports(source);
  let loaded: Awaited<ReturnType<typeof loadConfigFromFile>>;
  try {
    loaded = await loadConfigFromFile(
      {
        command: "build",
        mode: "production",
        isSsrBuild: false,
        isPreview: false,
      },
      configPath,
      root,
      "silent",
    );
  } catch {
    fail("Vite config cannot be loaded");
  }
  if (!loaded) fail("Vite config cannot be loaded");
  for (const dependency of loaded.dependencies) {
    const absolute = resolve(root, dependency);
    if (!within(root, absolute))
      fail("Vite config dependency must remain inside the repository");
    const relativeDependency = relative(root, absolute).replace(/\\/g, "/");
    await authorityFile(root, relativeDependency);
    if (
      /\bprocess\.(?:env|argv)\b|\bnpm_lifecycle_event\b/i.test(
        await readFile(absolute, "utf8"),
      )
    )
      fail("Vite config dependency must not depend on ambient process state");
  }
  try {
    const inline = { ...loaded.config, configFile: false as const };
    if (inline.root === undefined) inline.root = root;
    const resolved = await resolveConfig(
      inline,
      "build",
      "production",
      "production",
    );
    if (
      (await realpath(resolved.root)) !== resolve(root, "meta-app") ||
      resolve(root, resolved.build.outDir) !== resolve(root, "dist")
    )
      fail("Vite root and outDir must be meta-app and repository dist");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("private hosted prepare rejected:")
    )
      throw error;
    fail("Vite config cannot be resolved");
  }
  return { packageJson: pkg };
}

export function assertAcceptableBuildOutput(output: string): void {
  if (/externalized for browser compatibility/i.test(output))
    fail("browser externalization warning");
  if (/\bdist-meta\b/i.test(output))
    fail("build warning: forbidden alternate meta output");
}
function npm(args: string[]): { command: string; args: string[] } {
  return {
    command: process.execPath,
    args: [
      resolve(
        dirname(process.execPath),
        "node_modules",
        "npm",
        "bin",
        "npm-cli.js",
      ),
      ...args,
    ],
  };
}

async function fixedLifecycleShell(): Promise<string> {
  const shell =
    process.platform === "win32" ? "C:\\Windows\\System32\\cmd.exe" : "/bin/sh";
  const canonical = await realpath(shell).catch(() =>
    fail("fixed npm lifecycle shell is missing"),
  );
  const stat = await lstat(canonical).catch(() =>
    fail("fixed npm lifecycle shell is missing"),
  );
  if (!stat.isFile() || stat.isSymbolicLink())
    fail("fixed npm lifecycle shell is not a regular file");
  return canonical;
}

export async function sanitizedNpmEnvironment(
  root: string,
): Promise<NodeJS.ProcessEnv> {
  const emptyUserConfig = resolve(root, ".private-hosted-empty-user-npmrc");
  const emptyGlobalConfig = resolve(root, ".private-hosted-empty-global-npmrc");
  const lifecycleShell = await fixedLifecycleShell();
  return {
    PATH:
      process.platform === "win32"
        ? [dirname(process.execPath), "C:\\Windows\\System32"].join(delimiter)
        : [dirname(process.execPath), "/usr/bin", "/bin"].join(delimiter),
    SystemRoot: process.platform === "win32" ? "C:\\Windows" : undefined,
    SYSTEMROOT: process.platform === "win32" ? "C:\\Windows" : undefined,
    ComSpec: process.platform === "win32" ? lifecycleShell : undefined,
    COMSPEC: process.platform === "win32" ? lifecycleShell : undefined,
    PATHEXT: process.platform === "win32" ? ".COM;.EXE;.BAT;.CMD" : undefined,
    WINDIR: process.platform === "win32" ? "C:\\Windows" : undefined,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    NPM_CONFIG_USERCONFIG: emptyUserConfig,
    NPM_CONFIG_GLOBALCONFIG: emptyGlobalConfig,
    NPM_CONFIG_PREFIX: resolve(root, ".private-hosted-npm-prefix"),
    NPM_CONFIG_SCRIPT_SHELL: lifecycleShell,
    NPM_CONFIG_IGNORE_SCRIPTS: "false",
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_FUND: "false",
  };
}
async function commandSystem(
  command: PrivateCommand,
): Promise<PrivateCommandResult> {
  const result = await execFile(command.file, command.args, {
    cwd: command.cwd,
    env: command.env,
    windowsHide: true,
    maxBuffer: command.maxBuffer ?? 10 * 1024 * 1024,
  });
  return result;
}
async function npmVerified(
  root: string,
  run: (command: PrivateCommand) => Promise<PrivateCommandResult>,
) {
  const invocation = npm(["--version"]);
  const cli = invocation.args[0]!;
  const stat = await lstat(cli).catch(() =>
    fail("fixed npm executable is missing"),
  );
  if (!stat.isFile() || stat.isSymbolicLink())
    fail("fixed npm executable is not a regular file");
  try {
    const result = await run({
      file: invocation.command,
      args: invocation.args,
      cwd: root,
      env: await sanitizedNpmEnvironment(root),
    });
    if (result.stderr !== "" || result.stdout !== `${NPM_VERSION}\n`)
      fail("npm version differs from packageManager");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("private hosted prepare rejected:")
    )
      throw error;
    fail("npm version cannot be read");
  }
  return {
    command: npm([
      "run",
      "build:meta",
      "--",
      "--manifest",
    ]),
    version: NPM_VERSION,
  };
}
async function defaultBuild(
  root: string,
  invocation: { command: string; args: string[] },
  run: (command: PrivateCommand) => Promise<PrivateCommandResult>,
) {
  try {
    const result = await run({
      file: invocation.command,
      args: invocation.args,
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
      env: await sanitizedNpmEnvironment(root),
    });
    assertAcceptableBuildOutput(`${result.stdout}\n${result.stderr}`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("private hosted prepare rejected:")
    )
      throw error;
    fail(`${RELEASE_BUILD_COMMAND} failed`);
  }
}
export function assertWranglerVersionOutput(
  stdout: string,
  stderr: string,
): string {
  if (stdout !== `${WRANGLER_VERSION}\n` || stderr !== "")
    fail("local wrangler version differs from pinned version");
  return WRANGLER_VERSION;
}
async function wrangler(
  root: string,
  pkg: Record<string, unknown>,
  run: (command: PrivateCommand) => Promise<PrivateCommandResult>,
): Promise<string> {
  if (record(pkg.devDependencies)?.wrangler !== WRANGLER_VERSION)
    fail("package.json wrangler declaration must be exact");
  let lock: Record<string, unknown> | undefined;
  try {
    lock = record(
      JSON.parse(await readFile(resolve(root, "package-lock.json"), "utf8")),
    );
  } catch {
    fail("package-lock.json is invalid");
  }
  const packages = record(lock?.packages);
  if (
    record(record(packages?.[""])?.devDependencies)?.wrangler !==
      WRANGLER_VERSION ||
    record(packages?.["node_modules/wrangler"])?.version !== WRANGLER_VERSION
  )
    fail("package-lock.json wrangler resolution must be exact");
  const executable = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  const stat = await lstat(executable).catch(() =>
    fail("local wrangler executable is missing"),
  );
  if (!stat.isFile() || stat.isSymbolicLink())
    fail("local wrangler executable is not a regular file");
  try {
    const result = await run({
      file: process.execPath,
      args: [executable, "--version"],
      cwd: root,
      env: await sanitizedNpmEnvironment(root),
    });
    return assertWranglerVersionOutput(result.stdout, result.stderr);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("private hosted prepare rejected:")
    )
      throw error;
    fail("local wrangler version command failed");
  }
}
async function scan(dist: string, manifests: BuildManifests): Promise<void> {
  const markers = [
    /(?:^|[^A-Za-z0-9_])['"]?(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN|access_token|api_token|auth_token)['"]?\s*[:=]\s*['"][^'"\r\n]{16,}['"]/i,
    /(?:^|[^A-Za-z0-9_])['"]?Authorization['"]?\s*:\s*['"]Bearer\s+[^\s'"\\]{16,}['"]/i,
    /\\['"](?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN|access_token|api_token|auth_token)\\['"]\s*:\s*\\['"][^'"\r\n]{16,}\\['"]/i,
    /\\['"]Authorization\\['"]\s*:\s*\\['"]Bearer\s+[^\s'"\\]{16,}\\['"]/i,
    /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i,
    /\bsourceRoot\b/,
    /tsv-loader-fs/i,
    /node:(?:fs|path|url)/i,
    /\b(?:readFileSync|fileURLToPath)\b/,
    /\.claude(?:\/|\\{1,2})specs(?:\/|\\{1,2})cards-data/i,
  ];
  for (const entry of manifests.upload) {
    const source = await readFile(
      resolve(dist, entry.path.slice(1)),
      "utf8",
    ).catch(() => fail(`cannot scan bundle: ${entry.path}`));
    if (markers.some((marker) => marker.test(source)))
      fail(`forbidden bundle marker: ${entry.path}`);
  }
}
async function writeExclusiveSynced(path: string, data: string): Promise<void> {
  const file = await open(path, "wx");
  try {
    await file.writeFile(data);
    await file.sync();
  } finally {
    await file.close();
  }
}

async function publishEvidence(
  path: string,
  root: string,
  entries: Array<{ name: string; data: string }>,
  write: (path: string, data: string) => Promise<void>,
): Promise<string> {
  await freshExternal(path, root, "evidence");
  const parent = await realpath(dirname(resolve(path)));
  const target = resolve(parent, basename(path));
  const temporary = await mkdtemp(join(parent, `.${basename(path)}.tmp-`));
  for (const entry of entries)
    await write(resolve(temporary, entry.name), entry.data);
  await rename(temporary, target);
  return target;
}
export function parsePrepareArgs(args: readonly string[]): {
  stagingDir: string;
  evidenceDir: string;
} {
  let stagingDir: string | undefined;
  let evidenceDir: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    const value = args[index + 1];
    if (arg !== "--staging" && arg !== "--evidence") fail("unknown argument");
    if (!value || value.startsWith("--") || !isAbsolute(value))
      fail(`${arg} requires an absolute path`);
    if (arg === "--staging") {
      if (stagingDir) fail("--staging may be supplied only once");
      stagingDir = value;
    } else {
      if (evidenceDir) fail("--evidence may be supplied only once");
      evidenceDir = value;
    }
    index += 1;
  }
  if (!stagingDir || !evidenceDir)
    fail("--staging and --evidence are required");
  return { stagingDir, evidenceDir };
}
export async function prepareReleaseCore(
  options: PrepareReleaseOptions,
  controls: PrivatePrepareControls,
): Promise<PreparedRelease> {
  if (!isAbsolute(options.repoRoot)) fail("repository root must be absolute");
  assertNoAmbientGitAuthority();
  const root = await regularDirectory(
    resolve(options.repoRoot),
    "repository root",
  );
  await canonicalRepository(root, controls.moduleRoot);
  if (resolve(options.stagingDir) === resolve(options.evidenceDir))
    fail("staging and evidence directories must differ");
  await freshExternal(options.stagingDir, root, "staging");
  await freshExternal(options.evidenceDir, root, "evidence");
  const initial = await snapshot(root);
  const checked = await contract(root, controls.expectedConfigSha256);
  const afterContract = await snapshot(root);
  if (JSON.stringify(initial) !== JSON.stringify(afterContract))
    fail("commit or package-lock changed while resolving the build contract");
  const run = controls.runCommand ?? commandSystem;
  const verifiedNpm = await npmVerified(root, run);
  const build =
    controls.runBuild ?? (() => defaultBuild(root, verifiedNpm.command, run));
  await build();
  await assertNoIgnoredBuildInputs(root);
  const first = await inspectBuild(resolve(root, "dist"));
  await scan(resolve(root, "dist"), first);
  if (JSON.stringify(await snapshot(root)) !== JSON.stringify(initial))
    fail("commit or package-lock changed between builds");
  await build();
  await assertNoIgnoredBuildInputs(root);
  const second = await inspectBuild(resolve(root, "dist"));
  await scan(resolve(root, "dist"), second);
  if (JSON.stringify(await snapshot(root)) !== JSON.stringify(initial))
    fail("commit or package-lock changed during builds");
  if (!sameManifests(first, second)) fail("build manifests differ");
  const wranglerVersion = controls.verifyWrangler
    ? await controls.verifyWrangler()
    : await wrangler(root, checked.packageJson, run);
  if (wranglerVersion !== WRANGLER_VERSION)
    fail("verified wrangler version differs from pinned version");
  await stageBuild(resolve(root, "dist"), options.stagingDir, second);
  const metadata = {
    schemaVersion: 1,
    commit: initial.commit,
    packageLockSha256: initial.packageLockSha256,
    rootEntry: ROOT_ENTRY,
    buildCommand: RELEASE_BUILD_COMMAND,
    nodeVersion: process.version,
    npmVersion: verifiedNpm.version,
    wranglerVersion,
    createdAt: new Date().toISOString(),
    fileCount: second.upload.length,
    totalBytes: second.upload.reduce((sum, entry) => sum + entry.bytes, 0),
  };
  const write = controls.writeEvidenceFile ?? writeExclusiveSynced;
  const evidenceDir = await publishEvidence(
    options.evidenceDir,
    root,
    [
      {
        name: "upload-manifest.json",
        data: `${JSON.stringify({ schemaVersion: 1, files: second.upload }, null, 2)}\n`,
      },
      {
        name: "response-manifest.json",
        data: `${JSON.stringify({ schemaVersion: 1, files: second.response }, null, 2)}\n`,
      },
      {
        name: "release-metadata.json",
        data: `${JSON.stringify(metadata, null, 2)}\n`,
      },
    ],
    write,
  );
  const metadataPath = resolve(evidenceDir, "release-metadata.json");
  return { manifests: second, metadataPath };
}
/** Test-only direct core. Public prepare.ts always supplies canonical controls. */
export async function prepareReleaseForTest(
  options: PrepareReleaseOptions,
  controls: PrivatePrepareControls,
): Promise<PreparedRelease> {
  return prepareReleaseCore(options, controls);
}
