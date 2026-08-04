import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { spawn } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeBoundaryFinding } from "./audit-runtime-boundary.js";

export const QUALIFICATION_COMMAND_IDS = [
  "npm-ci",
  "boundary",
  "bug-gate",
  "typecheck",
  "lint",
  "unit",
  "smoke",
  "dev-e2e",
  "audit",
  "docs",
  "docs-check",
  "prepare-release",
  "prepared-private-e2e",
  "clean-tree-check",
] as const;

export type QualificationCommandId = (typeof QUALIFICATION_COMMAND_IDS)[number];

export type PreparedQualificationInputs = {
  mode: "prepared";
  stagingRealpath: string;
  uploadManifestSha256: string;
  responseManifestSha256: string;
  postStopStagingMatch: true;
};

export type QualificationCommandRecord = {
  id: QualificationCommandId;
  argv: string[];
  exitCode: 0;
  startedAt: string;
  completedAt: string;
  log: { path: string; bytes: number; sha256: string };
  preparedInputs?: PreparedQualificationInputs;
};

export type QualificationReport = {
  schemaVersion: 1;
  releaseCommit: string;
  packageLockSha256: string;
  uploadManifestSha256: string;
  responseManifestSha256: string;
  startedAt: string;
  completedAt: string;
  commands: QualificationCommandRecord[];
  boundaryFindings: RuntimeBoundaryFinding[];
  bugGateSha256: string;
};

export type QualificationCommandInput = {
  id: QualificationCommandId;
  file: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  logPath: string;
};

export type QualificationExecution = {
  exitCode: number;
  startedAt: string;
  completedAt: string;
};

type QualificationSnapshot = {
  releaseCommit: string;
  packageLockSha256: string;
};

type QualificationControls = {
  execute: (input: QualificationCommandInput) => Promise<QualificationExecution>;
  snapshot: (repoRoot: string) => Promise<QualificationSnapshot>;
  status: (repoRoot: string) => Promise<string>;
  now: () => Date;
};

type QualificationPaths = {
  repoRoot: string;
  runDir: string;
  logsDir: string;
  stagingDir: string;
  evidenceDir: string;
  uploadManifestPath: string;
  responseManifestPath: string;
  reportPath: string;
};

const MODULE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const HASH = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const REPORT_KEYS = [
  "boundaryFindings",
  "bugGateSha256",
  "commands",
  "completedAt",
  "packageLockSha256",
  "releaseCommit",
  "responseManifestSha256",
  "schemaVersion",
  "startedAt",
  "uploadManifestSha256",
] as const;
const COMMAND_KEYS = [
  "argv",
  "completedAt",
  "exitCode",
  "id",
  "log",
  "startedAt",
] as const;

function fail(message: string): never {
  throw new Error(`private hosted final qualification rejected: ${message}`);
}

function within(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

function utc(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !value.endsWith("Z") ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    fail(`${label} must be an exact UTC ISO timestamp`);
  }
  return value;
}

function hash(value: unknown, label: string): string {
  if (typeof value !== "string" || !HASH.test(value)) {
    fail(`${label} must be a lowercase SHA-256`);
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("qualification report must be an object");
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

export function validateQualificationReport(
  candidate: unknown,
): QualificationReport {
  const value = record(candidate);
  exactKeys(value, REPORT_KEYS, "qualification report");
  if (value.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (typeof value.releaseCommit !== "string" || !COMMIT.test(value.releaseCommit)) {
    fail("releaseCommit must be a 40-character lowercase Git hash");
  }
  hash(value.packageLockSha256, "packageLockSha256");
  hash(value.uploadManifestSha256, "uploadManifestSha256");
  hash(value.responseManifestSha256, "responseManifestSha256");
  hash(value.bugGateSha256, "bugGateSha256");
  const reportStarted = Date.parse(utc(value.startedAt, "startedAt"));
  const reportCompleted = Date.parse(utc(value.completedAt, "completedAt"));
  if (reportCompleted < reportStarted) fail("report timestamp order is invalid");
  if (!Array.isArray(value.boundaryFindings) || value.boundaryFindings.length !== 0) {
    fail("boundary findings must be empty");
  }
  if (!Array.isArray(value.commands)) fail("commands must be an array");
  const ids = value.commands.map((item) => record(item).id);
  if (JSON.stringify(ids) !== JSON.stringify(QUALIFICATION_COMMAND_IDS)) {
    fail("command order must contain every required ID exactly once");
  }
  let previous = reportStarted;
  for (let index = 0; index < value.commands.length; index += 1) {
    const item = record(value.commands[index]);
    const id = QUALIFICATION_COMMAND_IDS[index]!;
    exactKeys(
      item,
      id === "prepared-private-e2e"
        ? [...COMMAND_KEYS, "preparedInputs"]
        : COMMAND_KEYS,
      `${id} command`,
    );
    if (!Array.isArray(item.argv) || item.argv.length === 0 || item.argv.some((part) => typeof part !== "string" || !part)) {
      fail(`${id} argv is invalid`);
    }
    if (item.exitCode !== 0) fail(`${id} exitCode must be 0`);
    const started = Date.parse(utc(item.startedAt, `${id}.startedAt`));
    const completed = Date.parse(utc(item.completedAt, `${id}.completedAt`));
    if (started < previous || completed < started || completed > reportCompleted) {
      fail(`${id} timestamp order is invalid`);
    }
    previous = completed;
    const log = record(item.log);
    exactKeys(log, ["bytes", "path", "sha256"], `${id} log`);
    if (
      typeof log.path !== "string" ||
      log.path !== `logs/${String(index + 1).padStart(2, "0")}-${id}.log` ||
      typeof log.bytes !== "number" ||
      !Number.isSafeInteger(log.bytes) ||
      log.bytes <= 0
    ) {
      fail(`${id} log is invalid`);
    }
    hash(log.sha256, `${id}.log.sha256`);
    if (id === "prepared-private-e2e") {
      const prepared = record(item.preparedInputs);
      exactKeys(
        prepared,
        [
          "mode",
          "postStopStagingMatch",
          "responseManifestSha256",
          "stagingRealpath",
          "uploadManifestSha256",
        ],
        "prepared-private-e2e preparedInputs",
      );
      if (
        prepared.mode !== "prepared" ||
        typeof prepared.stagingRealpath !== "string" ||
        !isAbsolute(prepared.stagingRealpath) ||
        prepared.postStopStagingMatch !== true
      ) {
        fail("prepared-private-e2e preparedInputs are invalid");
      }
      if (
        hash(prepared.uploadManifestSha256, "prepared upload manifest") !== value.uploadManifestSha256 ||
        hash(prepared.responseManifestSha256, "prepared response manifest") !== value.responseManifestSha256
      ) {
        fail("prepared manifest hashes differ from the report");
      }
    } else if (item.preparedInputs !== undefined) {
      fail(`${id} must not contain preparedInputs`);
    }
  }
  return candidate as QualificationReport;
}

async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function childEnvironment(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    SystemRoot: process.env.SystemRoot,
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
    ComSpec: process.env.ComSpec,
    PATH: process.env.PATH,
    PATHEXT: process.env.PATHEXT,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    LOCALAPPDATA: process.env.LOCALAPPDATA,
    APPDATA: process.env.APPDATA,
    USERPROFILE: process.env.USERPROFILE,
    HOME: process.platform === "win32" ? undefined : process.env.HOME,
    CI: "1",
    ...extra,
  };
}

async function executeLogged(
  input: QualificationCommandInput,
): Promise<QualificationExecution> {
  const output = createWriteStream(input.logPath, { flags: "wx" });
  const startedAt = new Date().toISOString();
  const child = spawn(input.file, input.args, {
    cwd: input.cwd,
    env: input.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.pipe(output, { end: false });
  child.stderr?.pipe(output, { end: false });
  const exitCode = await new Promise<number>((done, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) reject(new Error(`${input.id} exited by signal ${signal}`));
      else done(code ?? 1);
    });
  }).finally(
    () =>
      new Promise<void>((done) => {
        output.end(done);
      }),
  );
  if ((await stat(input.logPath)).size === 0) {
    await writeFile(input.logPath, "[command produced no output]\n", { flag: "a" });
  }
  return { exitCode, startedAt, completedAt: new Date().toISOString() };
}

function fixedGitPath(): string {
  return process.platform === "win32"
    ? resolve(dirname(process.execPath), "..", "Git", "cmd", "git.exe")
    : "/usr/bin/git";
}

function fixedPowerShellPath(): string {
  return process.platform === "win32"
    ? "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"
    : "/usr/bin/pwsh";
}

function npmCliPath(): string {
  return resolve(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
}

async function capture(file: string, args: string[], cwd: string): Promise<string> {
  const child = spawn(file, args, {
    cwd,
    env: childEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
  const exitCode = await new Promise<number>((done, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) reject(new Error(`process exited by signal ${signal}`));
      else done(code ?? 1);
    });
  });
  if (exitCode !== 0) {
    fail(`snapshot command failed: ${Buffer.concat(stderr).toString("utf8").trim()}`);
  }
  return Buffer.concat(stdout).toString("utf8");
}

async function snapshot(repoRoot: string): Promise<QualificationSnapshot> {
  const releaseCommit = (
    await capture(fixedGitPath(), ["rev-parse", "HEAD"], repoRoot)
  ).trim();
  if (!COMMIT.test(releaseCommit)) fail("Git HEAD is invalid");
  return {
    releaseCommit,
    packageLockSha256: await sha256File(resolve(repoRoot, "package-lock.json")),
  };
}

async function status(repoRoot: string): Promise<string> {
  return capture(
    fixedGitPath(),
    ["status", "--porcelain=v1", "--untracked-files=all"],
    repoRoot,
  );
}

const DEFAULT_CONTROLS: QualificationControls = {
  execute: executeLogged,
  snapshot,
  status,
  now: () => new Date(),
};

function npmInput(
  id: QualificationCommandId,
  args: string[],
  paths: QualificationPaths,
  extraEnvironment: NodeJS.ProcessEnv = {},
): Omit<QualificationCommandInput, "logPath"> {
  return {
    id,
    file: process.execPath,
    args: [npmCliPath(), ...args],
    cwd: paths.repoRoot,
    env: childEnvironment(extraEnvironment),
  };
}

function isolatedE2EPort(runDir: string): string {
  const value = createHash("sha256").update(runDir).digest().readUInt16BE(0);
  return String(20_000 + (value % 10_000));
}

function commandInputs(paths: QualificationPaths): Array<Omit<QualificationCommandInput, "logPath">> {
  const npmRun = (id: QualificationCommandId, script: string) =>
    npmInput(id, ["run", "--silent", script], paths);
  return [
    npmInput("npm-ci", ["ci"], paths),
    npmRun("boundary", "private-hosted:boundary"),
    npmRun("bug-gate", "private-hosted:bug-gate"),
    npmRun("typecheck", "typecheck"),
    npmRun("lint", "lint"),
    npmRun("unit", "test"),
    npmRun("smoke", "smoke:1000"),
    npmInput(
      "dev-e2e",
      ["run", "--silent", "test:e2e"],
      paths,
      { PLAYWRIGHT_PORT: isolatedE2EPort(paths.runDir) },
    ),
    npmInput("audit", ["audit", "--audit-level=high"], paths),
    npmRun("docs", "docs"),
    npmRun("docs-check", "docs:check"),
    {
      id: "prepare-release",
      file: fixedPowerShellPath(),
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        resolve(paths.repoRoot, "scripts/private-hosted/prepare.ps1"),
        "--staging",
        paths.stagingDir,
        "--evidence",
        paths.evidenceDir,
      ],
      cwd: paths.repoRoot,
      env: childEnvironment(),
    },
    npmInput(
      "prepared-private-e2e",
      ["run", "--silent", "test:e2e:private-hosted:prepared"],
      paths,
      {
        PRIVATE_HOSTED_FINAL_PRODUCER: "1",
        PRIVATE_HOSTED_RUN_DIR: paths.runDir,
        PRIVATE_HOSTED_STAGING_DIR: paths.stagingDir,
        PRIVATE_HOSTED_UPLOAD_MANIFEST: paths.uploadManifestPath,
        PRIVATE_HOSTED_RESPONSE_MANIFEST: paths.responseManifestPath,
      },
    ),
    {
      id: "clean-tree-check",
      file: fixedGitPath(),
      args: ["status", "--porcelain=v1", "--untracked-files=all"],
      cwd: paths.repoRoot,
      env: childEnvironment(),
    },
  ];
}

async function parseJsonLog(path: string, label: string): Promise<Record<string, unknown>> {
  try {
    return record(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return fail(`${label} log is not valid JSON`);
  }
}

async function pathsFor(repoRoot: string, runDir: string): Promise<QualificationPaths> {
  if (!isAbsolute(repoRoot) || !isAbsolute(runDir)) fail("paths must be absolute");
  const repoReal = await realpath(repoRoot).catch(() => fail("repository does not exist"));
  const runReal = await realpath(runDir).catch(() => fail("run directory does not exist"));
  if (within(repoReal, runReal)) fail("run directory must be outside the repository");
  const entries = await lstat(runReal);
  if (!entries.isDirectory() || entries.isSymbolicLink()) {
    fail("run directory must be a regular directory");
  }
  const logsDir = resolve(runReal, "logs");
  await mkdir(logsDir);
  const evidenceDir = resolve(runReal, "evidence");
  return {
    repoRoot: repoReal,
    runDir: runReal,
    logsDir,
    stagingDir: resolve(runReal, "staging"),
    evidenceDir,
    uploadManifestPath: resolve(evidenceDir, "upload-manifest.json"),
    responseManifestPath: resolve(evidenceDir, "response-manifest.json"),
    reportPath: resolve(runReal, "qualification-report.json"),
  };
}

export async function runFinalQualification(
  options: { repoRoot: string; runDir: string },
  controlOverrides: Partial<QualificationControls> = {},
): Promise<QualificationReport> {
  const controls = { ...DEFAULT_CONTROLS, ...controlOverrides };
  const paths = await pathsFor(resolve(options.repoRoot), resolve(options.runDir));
  const initial = await controls.snapshot(paths.repoRoot);
  if (!COMMIT.test(initial.releaseCommit) || !HASH.test(initial.packageLockSha256)) {
    fail("initial repository snapshot is invalid");
  }
  if ((await controls.status(paths.repoRoot)) !== "") {
    fail("repository is not clean before qualification");
  }
  const startedAt = controls.now().toISOString();
  const commands: QualificationCommandRecord[] = [];
  let uploadManifestSha256: string | undefined;
  let responseManifestSha256: string | undefined;
  let bugGateSha256: string | undefined;
  let boundaryFindings: RuntimeBoundaryFinding[] | undefined;

  const inputs = commandInputs(paths);
  for (let index = 0; index < inputs.length; index += 1) {
    const base = inputs[index]!;
    const expectedId = QUALIFICATION_COMMAND_IDS[index];
    if (base.id !== expectedId) fail("internal command order differs from contract");
    const relativeLog = `logs/${String(index + 1).padStart(2, "0")}-${base.id}.log`;
    const input: QualificationCommandInput = {
      ...base,
      logPath: resolve(paths.runDir, relativeLog),
    };
    const execution = await controls.execute(input);
    if (execution.exitCode !== 0) fail(`${base.id} exited with code ${execution.exitCode}`);
    const logStat = await stat(input.logPath).catch(() => fail(`${base.id} log is missing`));
    if (!logStat.isFile() || logStat.size <= 0) fail(`${base.id} log is missing or empty`);
    const command: QualificationCommandRecord = {
      id: base.id,
      argv: [base.file, ...base.args],
      exitCode: 0,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      log: {
        path: relativeLog,
        bytes: logStat.size,
        sha256: await sha256File(input.logPath),
      },
    };
    if (base.id === "boundary") {
      const result = await parseJsonLog(input.logPath, "boundary");
      if (result.ok !== true || !Array.isArray(result.findings)) {
        fail("boundary result is invalid");
      }
      boundaryFindings = result.findings as RuntimeBoundaryFinding[];
      if (boundaryFindings.length > 0) fail("boundary findings are not empty");
    }
    if (base.id === "bug-gate") {
      const result = await parseJsonLog(input.logPath, "bug-gate");
      if (result.ok !== true || !Array.isArray(result.blockers) || result.blockers.length > 0) {
        fail("bug gate has blockers or invalid output");
      }
      bugGateSha256 = command.log.sha256;
    }
    if (base.id === "prepare-release") {
      uploadManifestSha256 = await sha256File(paths.uploadManifestPath);
      responseManifestSha256 = await sha256File(paths.responseManifestPath);
    }
    if (base.id === "prepared-private-e2e") {
      if (!uploadManifestSha256 || !responseManifestSha256) {
        fail("prepared manifests were not recorded");
      }
      const [postE2eUploadHash, postE2eResponseHash] = await Promise.all([
        sha256File(paths.uploadManifestPath),
        sha256File(paths.responseManifestPath),
      ]);
      if (
        postE2eUploadHash !== uploadManifestSha256 ||
        postE2eResponseHash !== responseManifestSha256
      ) {
        fail("prepared manifests changed during private E2E");
      }
      command.preparedInputs = {
        mode: "prepared",
        stagingRealpath: await realpath(paths.stagingDir),
        uploadManifestSha256,
        responseManifestSha256,
        postStopStagingMatch: true,
      };
    }
    commands.push(command);
  }

  const final = await controls.snapshot(paths.repoRoot);
  if (JSON.stringify(final) !== JSON.stringify(initial)) {
    fail("HEAD or package-lock changed during qualification");
  }
  if ((await controls.status(paths.repoRoot)) !== "") {
    fail("repository is not clean after qualification");
  }
  if (!uploadManifestSha256 || !responseManifestSha256 || !bugGateSha256) {
    fail("qualification evidence is incomplete");
  }
  if (!boundaryFindings) fail("boundary evidence is missing");
  const report: QualificationReport = {
    schemaVersion: 1,
    releaseCommit: initial.releaseCommit,
    packageLockSha256: initial.packageLockSha256,
    uploadManifestSha256,
    responseManifestSha256,
    startedAt,
    completedAt: controls.now().toISOString(),
    commands,
    boundaryFindings,
    bugGateSha256,
  };
  validateQualificationReport(report);
  await writeFile(paths.reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    flag: "wx",
  });
  return report;
}

export async function runFinalQualificationCli(): Promise<void> {
  const runDir = await mkdtemp(join(tmpdir(), "conan-private-hosted-final-"));
  await runFinalQualification({ repoRoot: MODULE_REPOSITORY_ROOT, runDir });
  process.stdout.write(`${runDir}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runFinalQualificationCli();
}
