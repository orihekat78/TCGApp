import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export type BugClassification =
  | "verified"
  | "spec-out"
  | "open"
  | "official-blocked";

export type WaveBug = {
  id: string;
  classification: BugClassification;
  owner: string;
  implementationPaths: string[];
  testPaths: string[];
  verificationCommands: string[];
  nextWaveReason: string | null;
};

export type ChangeOwnership = {
  path: string;
  owner: string;
  bugId?: string;
  contentSha256?: string;
};

export type WaveManifest = {
  version: 1;
  wave: string;
  baseCommit: string;
  bugs: WaveBug[];
  changeOwnership: ChangeOwnership[];
};

const BUG_CLASSIFICATIONS = new Set<BugClassification>([
  "verified",
  "spec-out",
  "open",
  "official-blocked",
]);

function normalizeRepoPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isPathInsideRepo(repoRoot: string, path: string): boolean {
  if (!path || isAbsolute(path)) return false;
  const relativePath = relative(repoRoot, resolve(repoRoot, path));
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function isResolvedPathInsideRoot(
  realRepoRoot: string,
  realPath: string,
): boolean {
  const relativePath = relative(realRepoRoot, realPath);
  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${sep}`) &&
    !isAbsolute(relativePath)
  );
}

function splitNullDelimited(output: string): string[] {
  return output
    .split("\0")
    .map(normalizeRepoPath)
    .filter((path) => path.length > 0);
}

function commandTokens(command: string): string[] {
  return [...command.matchAll(/"([^"]*)"|'([^']*)'|[^\s]+/g)].map(
    (match) => match[1] ?? match[2] ?? match[0],
  );
}

function validateBaseCommit(
  repoRoot: string,
  baseCommit: string,
): string | null {
  if (!/^[0-9a-fA-F]{40}$/.test(baseCommit)) {
    return `manifest baseCommit must be a full 40-hex commit OID: ${baseCommit}`;
  }
  try {
    execFileSync("git", ["cat-file", "-e", `${baseCommit}^{commit}`], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {
    return `manifest baseCommit is not an existing commit: ${baseCommit}`;
  }
  return null;
}

export function collectChangedPaths(
  repoRoot: string,
  baseCommit = "HEAD",
): string[] {
  const tracked = execFileSync(
    "git",
    [
      "-c",
      "core.autocrlf=false",
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      baseCommit,
      "--",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const untracked = execFileSync(
    "git",
    [
      "-c",
      "core.autocrlf=false",
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
    ],
    { cwd: repoRoot, encoding: "utf8" },
  );

  return [
    ...new Set([
      ...splitNullDelimited(tracked),
      ...splitNullDelimited(untracked),
    ]),
  ].sort();
}

export function runWaveScopeCheck(_repoRoot: string): {
  changedPaths: string[];
  errors: string[];
} {
  const repoRoot = resolve(_repoRoot);
  const manifestPath = resolve(
    repoRoot,
    ".claude/specs/you-vs-cpu-hardening-wave-manifest.json",
  );
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as WaveManifest;
  const baseCommitError = validateBaseCommit(repoRoot, manifest.baseCommit);
  if (baseCommitError) {
    return { changedPaths: [], errors: [baseCommitError] };
  }
  const changedPaths = collectChangedPaths(repoRoot, manifest.baseCommit);
  return {
    changedPaths,
    errors: validateWaveScope(manifest, changedPaths, repoRoot),
  };
}

export function validateWaveScope(
  manifest: WaveManifest,
  changedPaths: string[],
  repoRoot: string,
): string[] {
  const errors: string[] = [];
  const realRepoRoot = realpathSync.native(repoRoot);
  const ownershipByPath = new Map<string, ChangeOwnership[]>();
  const bugsById = new Map(manifest.bugs.map((bug) => [bug.id, bug]));
  const changedPathSet = new Set(changedPaths.map(normalizeRepoPath));

  for (const bug of manifest.bugs) {
    if (!BUG_CLASSIFICATIONS.has(bug.classification)) {
      errors.push(
        `ticket has invalid classification: ${bug.id} (${bug.classification})`,
      );
      continue;
    }
    for (const [field, values] of [
      ["implementationPaths", bug.implementationPaths],
      ["testPaths", bug.testPaths],
      ["verificationCommands", bug.verificationCommands],
    ] as const) {
      if (values.some((value) => !value.trim())) {
        errors.push(
          `${bug.classification} ticket has blank ${field} entry: ${bug.id}`,
        );
      }
    }
    for (const testPath of bug.testPaths.filter((path) => path.trim())) {
      if (
        !bug.verificationCommands.some((command) =>
          commandTokens(command).includes(testPath),
        )
      ) {
        errors.push(
          `${bug.classification} testPath is absent from verificationCommands: ${bug.id} (${testPath})`,
        );
      }
    }
    if (
      bug.classification === "verified" ||
      bug.classification === "spec-out"
    ) {
      if (bug.implementationPaths.length === 0) {
        errors.push(
          `${bug.classification} ticket requires implementationPaths: ${bug.id}`,
        );
      }
      if (bug.testPaths.length === 0) {
        errors.push(
          `${bug.classification} ticket requires testPaths: ${bug.id}`,
        );
      }
      if (bug.verificationCommands.length === 0) {
        errors.push(
          `${bug.classification} ticket requires verificationCommands: ${bug.id}`,
        );
      }
      if (bug.nextWaveReason !== null) {
        errors.push(
          `${bug.classification} ticket must not have nextWaveReason: ${bug.id}`,
        );
      }
    } else if (!bug.nextWaveReason?.trim()) {
      errors.push(
        `${bug.classification} ticket requires nextWaveReason: ${bug.id}`,
      );
    }
  }

  for (const ownership of manifest.changeOwnership) {
    const path = normalizeRepoPath(ownership.path);
    const entries = ownershipByPath.get(path) ?? [];
    entries.push(ownership);
    ownershipByPath.set(path, entries);
    if (
      ownership.owner === "pre-existing-user-work" &&
      !ownership.contentSha256
    ) {
      errors.push(`pre-existing ownership requires contentSha256: ${path}`);
    }
    if (ownership.bugId) {
      const bug = bugsById.get(ownership.bugId);
      if (!bug) {
        errors.push(
          `change owner references unknown ticket: ${path} (${ownership.bugId})`,
        );
      } else if (bug.owner !== ownership.owner) {
        errors.push(
          `change owner does not match ticket owner: ${path} (${ownership.bugId})`,
        );
      }
    }
  }

  for (const path of changedPathSet) {
    if (!ownershipByPath.has(path)) {
      errors.push(`changed path is outside manifest: ${path}`);
    }
  }

  for (const path of ownershipByPath.keys()) {
    if (!changedPathSet.has(path)) {
      errors.push(`manifest ownership path is not changed: ${path}`);
    }
  }

  for (const [path, entries] of ownershipByPath) {
    if (entries.length <= 1) continue;
    const bugIds = [
      ...new Set(entries.map((entry) => entry.bugId).filter(Boolean)),
    ].sort();
    if (bugIds.length > 1) {
      errors.push(
        `changed path has multiple RCA owners: ${path} (${bugIds.join(", ")})`,
      );
    } else {
      errors.push(`changed path has multiple owners: ${path}`);
    }
  }

  const declaredPaths = new Set<string>();
  for (const ownership of manifest.changeOwnership) {
    declaredPaths.add(normalizeRepoPath(ownership.path));
  }
  for (const bug of manifest.bugs) {
    for (const path of [...bug.implementationPaths, ...bug.testPaths]) {
      declaredPaths.add(normalizeRepoPath(path));
    }
  }
  for (const path of declaredPaths) {
    if (!isPathInsideRepo(repoRoot, path)) {
      errors.push(`manifest path escapes repository: ${path}`);
      continue;
    }
    if (!existsSync(resolve(repoRoot, path))) {
      errors.push(`manifest path does not exist: ${path}`);
      continue;
    }
    const realPath = realpathSync.native(resolve(repoRoot, path));
    if (!isResolvedPathInsideRoot(realRepoRoot, realPath)) {
      errors.push(`manifest path escapes repository via link: ${path}`);
    }
  }

  for (const bug of manifest.bugs) {
    for (const path of [...bug.implementationPaths, ...bug.testPaths]) {
      if (!path.trim() || !isPathInsideRepo(repoRoot, path)) continue;
      const absolutePath = resolve(repoRoot, path);
      if (!existsSync(absolutePath)) continue;
      const realPath = realpathSync.native(absolutePath);
      if (!isResolvedPathInsideRoot(realRepoRoot, realPath)) continue;
      if (!statSync(realPath).isFile()) {
        errors.push(
          `ticket evidence path is not a regular file: ${bug.id} (${path})`,
        );
      }
    }
  }

  for (const ownership of manifest.changeOwnership) {
    if (
      ownership.owner !== "pre-existing-user-work" ||
      !ownership.contentSha256
    ) {
      continue;
    }
    const path = normalizeRepoPath(ownership.path);
    if (!isPathInsideRepo(repoRoot, path)) continue;
    const absolutePath = resolve(repoRoot, path);
    if (!existsSync(absolutePath)) continue;
    const actualSha256 = createHash("sha256")
      .update(readFileSync(absolutePath))
      .digest("hex");
    if (actualSha256 !== ownership.contentSha256) {
      errors.push(`pre-existing content hash changed: ${path}`);
    }
  }

  return errors.sort();
}

function main(): void {
  const result = runWaveScopeCheck(process.cwd());
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`[wave-scope] ${error}`);
    console.error(`[wave-scope] FAILED (${result.errors.length} errors)`);
    process.exitCode = 1;
    return;
  }
  console.log(`[wave-scope] OK (${result.changedPaths.length} changed paths)`);
}

const entryPath = process.argv[1];
if (
  entryPath &&
  resolve(entryPath) === resolve(fileURLToPath(import.meta.url))
) {
  main();
}
