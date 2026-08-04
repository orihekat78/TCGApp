import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import type { BigIntStats } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  realpath,
  stat,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path";

export type HostedOperatorConfig = {
  schemaVersion: 1;
  accountId: string;
  projectName: string;
  teamName: string;
  operatorEmail: string;
  approvedEmails: string[];
};

export type OperatorConfigAnswers = {
  accountId: string;
  teamName: string;
  operatorEmail: string;
  approvedEmails: string[];
};

type BroadAclEntry = { sid: string; type: string; rights: number };

type ConfigFileControls = {
  repoRoot: string;
  hasBroadWriteAccess?: (path: string) => Promise<boolean>;
};

type FileSnapshot = {
  dev: bigint;
  ino: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
};

type DirectoryBinding = {
  path: string;
  snapshot: FileSnapshot;
};

const CONFIG_KEYS = [
  "accountId",
  "approvedEmails",
  "operatorEmail",
  "projectName",
  "schemaVersion",
  "teamName",
] as const;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ACCOUNT_ID = /^[0-9a-f]{32}$/;
const PROJECT_PREFIX = "conan-private-";
export const MAX_APPROVED_EMAILS = 12;
const WINDOWS_SID = /^S-\d+(?:-\d+)+$/;
const TRUSTED_WINDOWS_WRITE_SIDS = new Set([
  "S-1-5-18",
  "S-1-5-32-544",
]);
const WINDOWS_WRITE_MASK =
  0x0002 |
  0x0004 |
  0x0010 |
  0x0040 |
  0x0100 |
  0x10000 |
  0x40000 |
  0x80000;

function fail(message: string): never {
  throw new Error(`private hosted operator config rejected: ${message}`);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("config must be an object");
  }
  return value as Record<string, unknown>;
}

function hasAsciiWhitespaceOrControl(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x20 || code === 0x7f;
  });
}

function email(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 254 ||
    value !== value.toLowerCase() ||
    value !== value.trim() ||
    hasAsciiWhitespaceOrControl(value)
  ) {
    fail(`${label} must be a lowercase exact email`);
  }
  const separator = value.lastIndexOf("@");
  if (separator <= 0 || separator !== value.indexOf("@")) {
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

function dnsLabel(value: unknown, label: string): string {
  if (typeof value !== "string" || !DNS_LABEL.test(value)) {
    fail(`${label} must be a lowercase DNS label`);
  }
  return value;
}

export function validateOperatorConfig(value: unknown): HostedOperatorConfig {
  const input = asRecord(value);
  const keys = Object.keys(input).sort();
  if (JSON.stringify(keys) !== JSON.stringify(CONFIG_KEYS)) {
    fail("config fields must match the exact schema");
  }
  if (input.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (typeof input.accountId !== "string" || !ACCOUNT_ID.test(input.accountId)) {
    fail("accountId must be 32 lowercase hexadecimal characters");
  }
  const projectName = dnsLabel(input.projectName, "projectName");
  if (!projectName.startsWith(PROJECT_PREFIX)) {
    fail(`projectName must start with ${PROJECT_PREFIX}`);
  }
  const teamName = dnsLabel(input.teamName, "teamName");
  const operatorEmail = email(input.operatorEmail, "operatorEmail");
  if (!Array.isArray(input.approvedEmails) || input.approvedEmails.length === 0) {
    fail("approvedEmails must be a non-empty array");
  }
  if (input.approvedEmails.length > MAX_APPROVED_EMAILS) {
    fail(`approvedEmails must contain at most ${MAX_APPROVED_EMAILS} addresses`);
  }
  const approvedEmails = input.approvedEmails.map((item, index) =>
    email(item, `approvedEmails[${index}]`),
  );
  if (new Set(approvedEmails).size !== approvedEmails.length) {
    fail("approvedEmails must not contain duplicates");
  }
  if (!approvedEmails.includes(operatorEmail)) {
    fail("approvedEmails must include operatorEmail");
  }
  return {
    schemaVersion: 1,
    accountId: input.accountId,
    projectName,
    teamName,
    operatorEmail,
    approvedEmails: [...approvedEmails].sort(),
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function createOperatorConfig(
  answers: OperatorConfigAnswers,
  randomHex: () => string = () => randomBytes(4).toString("hex"),
): HostedOperatorConfig {
  const suffix = randomHex();
  if (!/^[0-9a-f]{8}$/.test(suffix)) fail("random project suffix is invalid");
  const operatorEmail = normalize(answers.operatorEmail);
  return validateOperatorConfig({
    schemaVersion: 1,
    accountId: normalize(answers.accountId),
    projectName: `${PROJECT_PREFIX}${suffix}`,
    teamName: normalize(answers.teamName),
    operatorEmail,
    approvedEmails: [
      operatorEmail,
      ...answers.approvedEmails.map(normalize).filter((item) => item.length > 0),
    ].filter((item, index, all) => all.indexOf(item) === index),
  });
}

export function defaultOperatorConfigPath(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const localAppData = environment.LOCALAPPDATA;
  if (!localAppData || !isAbsolute(localAppData)) {
    fail("LOCALAPPDATA must be an absolute path");
  }
  return join(localAppData, "ConanPrivateHosted", "operator.json");
}

function within(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  );
}

function sameFile(left: FileSnapshot, right: FileSnapshot): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileContents(left: FileSnapshot, right: FileSnapshot): boolean {
  return (
    sameFile(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

export function hasBroadWindowsWriteAcl(
  entries: readonly BroadAclEntry[],
  ownerSid: string,
  operatorSid?: string,
): boolean {
  if (!WINDOWS_SID.test(ownerSid) || (operatorSid !== undefined && !WINDOWS_SID.test(operatorSid))) {
    return true;
  }
  const trustedSids = new Set(TRUSTED_WINDOWS_WRITE_SIDS);
  if (operatorSid !== undefined) trustedSids.add(operatorSid);
  if (!trustedSids.has(ownerSid)) return true;
  return entries.some(
    (entry) =>
      entry.type.toLowerCase() === "allow" &&
      (entry.rights & WINDOWS_WRITE_MASK) !== 0 &&
      !trustedSids.has(entry.sid),
  );
}

async function windowsAcl(path: string): Promise<boolean> {
  const powershell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  const script = [
    "$ErrorActionPreference='Stop'",
    "$target=$env:CONAN_PRIVATE_HOSTED_ACL_TARGET",
    "if ([string]::IsNullOrEmpty($target)) { throw 'ACL target missing' }",
    "$acl=Get-Acl -LiteralPath $target",
    "$operatorSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    "try { $ownerSid=([System.Security.Principal.NTAccount]$acl.Owner).Translate([System.Security.Principal.SecurityIdentifier]).Value }",
    "catch { try { $ownerSid=([System.Security.Principal.SecurityIdentifier]$acl.Owner).Value } catch { $ownerSid='UNRESOLVED:' + [string]$acl.Owner } }",
    "$items=@($acl.Access | ForEach-Object {",
    "  try { $sid=$_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }",
    "  catch { $sid='UNRESOLVED:' + [string]$_.IdentityReference }",
    "  [pscustomobject]@{sid=$sid;type=[string]$_.AccessControlType;rights=[int]$_.FileSystemRights}",
    "})",
    "ConvertTo-Json -InputObject ([pscustomobject]@{ownerSid=$ownerSid;operatorSid=$operatorSid;entries=$items}) -Compress -Depth 4",
  ].join("\n");
  const child = spawn(
    powershell,
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      env: {
        SystemRoot: process.env.SystemRoot,
        SYSTEMROOT: process.env.SYSTEMROOT,
        WINDIR: process.env.WINDIR,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        CONAN_PRIVATE_HOSTED_ACL_TARGET: path,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  const stdout: Buffer[] = [];
  child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr?.resume();
  const exitCode = await new Promise<number>((done, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) reject(new Error(`ACL inspection exited by signal ${signal}`));
      else done(code ?? 1);
    });
  });
  if (exitCode !== 0) {
    fail("ACL inspection process failed");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(stdout).toString("utf8"));
  } catch {
    return fail("ACL inspection returned invalid JSON");
  }
  const snapshot = asRecord(parsed);
  if (
    typeof snapshot.ownerSid !== "string" ||
    typeof snapshot.operatorSid !== "string" ||
    !Array.isArray(snapshot.entries)
  ) {
    fail("ACL inspection did not return an owner, operator, and entries");
  }
  const entries: BroadAclEntry[] = snapshot.entries.map((item) => {
    const value = asRecord(item);
    if (
      typeof value.sid !== "string" ||
      typeof value.type !== "string" ||
      typeof value.rights !== "number" ||
      !Number.isInteger(value.rights)
    ) {
      fail("ACL inspection returned an invalid entry");
    }
    return { sid: value.sid, type: value.type, rights: value.rights };
  });
  return hasBroadWindowsWriteAcl(entries, snapshot.ownerSid, snapshot.operatorSid);
}

async function broadWriteAccess(path: string): Promise<boolean> {
  if (process.platform === "win32") return windowsAcl(path);
  return ((await stat(path)).mode & 0o022) !== 0;
}

async function ensureExternal(repoRoot: string, path: string): Promise<void> {
  const repoReal = await realpath(repoRoot).catch(() => fail("repository does not exist"));
  if (within(repoReal, resolve(path))) fail("config path must be outside the repository");
  const pathReal = await realpath(path).catch(() => undefined);
  if (pathReal && within(repoReal, pathReal)) {
    fail("config realpath must be outside the repository");
  }
}

function ancestorDirectories(path: string): string[] {
  const absolute = resolve(path);
  const root = parse(absolute).root;
  const segments = relative(root, absolute).split(sep).filter(Boolean);
  const paths = [root];
  for (const segment of segments) paths.push(join(paths.at(-1)!, segment));
  return paths;
}

function directorySubject(path: string, parent: string, prefix: string): string {
  return path === parent ? `${prefix} parent` : `${prefix} ancestor`;
}

async function captureDirectoryChain(
  parent: string,
  inspect: (path: string) => Promise<boolean>,
  prefix: string,
): Promise<DirectoryBinding[]> {
  const bindings: DirectoryBinding[] = [];
  const filesystemRoot = parse(parent).root;
  for (const path of ancestorDirectories(parent)) {
    const subject = directorySubject(path, parent, prefix);
    const snapshot = await lstat(path, { bigint: true }).catch(() =>
      fail(`${subject} does not exist`),
    );
    if (!snapshot.isDirectory() || snapshot.isSymbolicLink()) {
      fail(`${subject} must be a regular directory`);
    }
    const broad = await inspect(path);
    if (broad && path !== filesystemRoot) {
      fail(`${subject} grants broad write access`);
    }
    bindings.push({ path, snapshot });
  }
  return bindings;
}

async function createDirectoryChain(
  parent: string,
  repoRoot: string,
  inspect: (path: string) => Promise<boolean>,
  prefix: string,
): Promise<DirectoryBinding[]> {
  const bindings: DirectoryBinding[] = [];
  const filesystemRoot = parse(parent).root;
  let creating = false;
  for (const path of ancestorDirectories(parent)) {
    const subject = directorySubject(path, parent, prefix);
    let snapshot = await lstat(path, { bigint: true }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    });
    if (snapshot === undefined) {
      creating = true;
      await assertDirectoryChainIdentityBound(bindings, parent, prefix, "creation");
      await ensureExternal(repoRoot, path);
      await mkdir(path, { mode: 0o700 }).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") {
          fail(`${subject} changed during creation`);
        }
        throw error;
      });
      snapshot = await lstat(path, { bigint: true }).catch(() =>
        fail(`${subject} changed during creation`),
      );
    } else if (creating) {
      fail(`${subject} changed during creation`);
    }
    if (!snapshot.isDirectory() || snapshot.isSymbolicLink()) {
      fail(`${subject} must be a regular directory`);
    }
    const broad = await inspect(path);
    if (broad && path !== filesystemRoot) {
      fail(`${subject} grants broad write access`);
    }
    bindings.push({ path, snapshot });
    await assertDirectoryChainIdentityBound(bindings, parent, prefix, "creation");
    await ensureExternal(repoRoot, path);
  }
  return bindings;
}

async function assertDirectoryChainIdentityBound(
  bindings: readonly DirectoryBinding[],
  parent: string,
  prefix: string,
  operation: string,
): Promise<void> {
  for (const binding of bindings) {
    const subject = directorySubject(binding.path, parent, prefix);
    const current = await lstat(binding.path, { bigint: true }).catch(() =>
      fail(`${subject} changed during ${operation}`),
    );
    if (
      !current.isDirectory() ||
      current.isSymbolicLink() ||
      !sameFile(binding.snapshot, current)
    ) {
      fail(`${subject} changed during ${operation}`);
    }
  }
}

async function assertDirectoryChainBound(
  bindings: readonly DirectoryBinding[],
  parent: string,
  inspect: (path: string) => Promise<boolean>,
  prefix: string,
  operation: string,
): Promise<void> {
  await assertDirectoryChainIdentityBound(bindings, parent, prefix, operation);
  const filesystemRoot = parse(parent).root;
  for (const binding of bindings) {
    const subject = directorySubject(binding.path, parent, prefix);
    const broad = await inspect(binding.path);
    if (broad && binding.path !== filesystemRoot) {
      fail(`${subject} grants broad write access`);
    }
  }
}

export async function writeNewOperatorConfig(
  outputPath: string,
  value: unknown,
  controls: ConfigFileControls,
): Promise<string> {
  if (!isAbsolute(outputPath)) fail("output path must be absolute");
  const target = resolve(outputPath);
  const config = validateOperatorConfig(value);
  await ensureExternal(controls.repoRoot, target);
  if (await lstat(target).then(() => true).catch(() => false)) {
    fail("output file already exists");
  }
  const parent = resolve(target, "..");
  const inspect = controls.hasBroadWriteAccess ?? broadWriteAccess;
  const directoryBindings = await createDirectoryChain(
    parent,
    controls.repoRoot,
    inspect,
    "output",
  );
  const assertParentBound = async (): Promise<void> => {
    await assertDirectoryChainBound(
      directoryBindings,
      parent,
      inspect,
      "output",
      "creation",
    );
    await ensureExternal(controls.repoRoot, parent);
  };
  await assertParentBound();
  const handle = await open(target, "wx", 0o600).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      fail("output file already exists");
    }
    throw error;
  });
  let openedStat: BigIntStats | undefined;
  let completed = false;
  let writeStarted = false;
  try {
    openedStat = await handle.stat({ bigint: true });
    if (!openedStat.isFile() || openedStat.nlink !== 1n || openedStat.size !== 0n) {
      fail("output must be a regular file");
    }
    const boundTarget = await lstat(target, { bigint: true }).catch(() =>
      fail("output changed during creation"),
    );
    if (boundTarget.isSymbolicLink() || !sameFile(openedStat, boundTarget)) {
      fail("output changed during creation");
    }
    await assertParentBound();
    if (await inspect(target)) fail("output file grants broad write access");
    const checkedHandle = await handle.stat({ bigint: true });
    const checkedTarget = await lstat(target, { bigint: true }).catch(() =>
      fail("output changed during creation"),
    );
    if (
      !checkedHandle.isFile() ||
      checkedHandle.nlink !== 1n ||
      checkedHandle.size !== 0n ||
      !sameFile(openedStat, checkedHandle) ||
      !checkedTarget.isFile() ||
      checkedTarget.isSymbolicLink() ||
      checkedTarget.nlink !== 1n ||
      checkedTarget.size !== 0n ||
      !sameFile(checkedHandle, checkedTarget)
    ) {
      fail("output changed during creation or has hard links");
    }
    await assertParentBound();

    const serialized = `${JSON.stringify(config, null, 2)}\n`;
    writeStarted = true;
    await handle.writeFile(serialized, { encoding: "utf8" });
    await handle.sync();
    const writtenStat = await handle.stat({ bigint: true });
    if (
      !writtenStat.isFile() ||
      writtenStat.nlink !== 1n ||
      !sameFile(openedStat, writtenStat) ||
      writtenStat.size !== BigInt(Buffer.byteLength(serialized))
    ) {
      fail("output changed while being written");
    }
    await ensureExternal(controls.repoRoot, target);
    if (await inspect(target)) fail("output file grants broad write access");
    await assertParentBound();
    await ensureExternal(controls.repoRoot, target);
    const finalHandle = await handle.stat({ bigint: true });
    const finalTarget = await lstat(target, { bigint: true }).catch(() =>
      fail("output changed during creation"),
    );
    if (
      !finalHandle.isFile() ||
      finalHandle.nlink !== 1n ||
      finalHandle.size !== writtenStat.size ||
      !sameFile(writtenStat, finalHandle) ||
      !finalTarget.isFile() ||
      finalTarget.isSymbolicLink() ||
      finalTarget.nlink !== 1n ||
      finalTarget.size !== writtenStat.size ||
      !sameFile(finalHandle, finalTarget)
    ) {
      fail("output changed during creation or has hard links");
    }
    completed = true;
  } finally {
    if (!completed && writeStarted) {
      await handle.truncate(0).catch(() => undefined);
      await handle.sync().catch(() => undefined);
    }
    await handle.close();
    if (!completed && openedStat) {
      const currentTarget = await lstat(target, { bigint: true }).catch(() => undefined);
      if (currentTarget && sameFile(openedStat, currentTarget)) {
        await unlink(target).catch(() => undefined);
      }
    }
  }
  return target;
}

export async function loadOperatorConfig(
  configPath: string,
  controls: ConfigFileControls,
): Promise<HostedOperatorConfig> {
  if (!isAbsolute(configPath)) fail("config path must be absolute");
  const target = resolve(configPath);
  await ensureExternal(controls.repoRoot, target);
  const parent = resolve(target, "..");
  await ensureExternal(controls.repoRoot, parent);
  const targetStat = await lstat(target, { bigint: true }).catch(() =>
    fail("config file does not exist"),
  );
  if (
    !targetStat.isFile() ||
    targetStat.isSymbolicLink() ||
    targetStat.size > 65_536n
  ) {
    fail("config must be a small regular file");
  }
  if (targetStat.nlink !== 1n) fail("config file must not have hard links");
  const inspect = controls.hasBroadWriteAccess ?? broadWriteAccess;
  const directoryBindings = await captureDirectoryChain(parent, inspect, "config");
  if (await inspect(target)) fail("config file grants broad write access");
  const handle = await open(target, "r").catch(() =>
    fail("config file changed during inspection"),
  );
  let contents: string;
  try {
    const openedStat = await handle.stat({ bigint: true });
    if (
      !openedStat.isFile() ||
      openedStat.size > 65_536n ||
      openedStat.nlink !== 1n ||
      !sameFile(targetStat, openedStat)
    ) {
      fail("config file changed during inspection");
    }
    contents = await handle.readFile({ encoding: "utf8" });
    const afterReadStat = await handle.stat({ bigint: true });
    if (!sameFileContents(openedStat, afterReadStat)) {
      fail("config file changed while being read");
    }
    const finalTargetStat = await lstat(target, { bigint: true }).catch(() =>
      fail("config file changed during inspection"),
    );
    if (
      finalTargetStat.isSymbolicLink() ||
      !sameFileContents(openedStat, finalTargetStat)
    ) {
      fail("config file changed during inspection");
    }
    if (await inspect(target)) fail("config file grants broad write access");
    const reboundTargetStat = await lstat(target, { bigint: true }).catch(() =>
      fail("config file changed during inspection"),
    );
    if (!sameFileContents(openedStat, reboundTargetStat)) {
      fail("config file changed during inspection");
    }
    await assertDirectoryChainBound(
      directoryBindings,
      parent,
      inspect,
      "config",
      "inspection",
    );
  } finally {
    await handle.close();
  }
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    return fail("config file is not valid JSON");
  }
  return validateOperatorConfig(value);
}
