import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  collectChangedPaths,
  runWaveScopeCheck,
  stableTextSha256,
  validateWaveScope,
  type WaveBug,
  type WaveManifest,
} from "../../scripts/check-wave-scope";

const tempRoots: string[] = [];

function createRepoFile(
  root: string,
  path: string,
  content = "fixture\n",
): void {
  const absolutePath = resolve(root, path);
  mkdirSync(resolve(absolutePath, ".."), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

function bug(
  id: string,
  implementationPaths: string[],
  testPaths: string[] = [],
): WaveBug {
  return {
    id,
    classification: "open",
    owner: `owner-${id}`,
    implementationPaths,
    testPaths,
    verificationCommands: [`npm test -- ${id}`],
    nextWaveReason: "pending fixture",
  };
}

function manifest(overrides: Partial<WaveManifest> = {}): WaveManifest {
  return {
    version: 1,
    wave: "test-wave",
    baseCommit: "HEAD",
    bugs: [bug("BUG-202", ["src/owned.ts"], ["tests/owned.test.ts"])],
    changeOwnership: [
      { path: "src/owned.ts", owner: "owner-BUG-202", bugId: "BUG-202" },
      { path: "tests/owned.test.ts", owner: "owner-BUG-202", bugId: "BUG-202" },
    ],
    ...overrides,
  };
}

function tempRepo(): string {
  const root = mkdtempSync(resolve(tmpdir(), "conan-wave-scope-"));
  tempRoots.push(root);
  createRepoFile(root, "src/owned.ts");
  createRepoFile(root, "tests/owned.test.ts");
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("check-wave-scope entrypoint", () => {
  it("exists as a TypeScript script", () => {
    expect(existsSync(resolve("scripts/check-wave-scope.ts"))).toBe(true);
  });

  it("exports the scope validator", async () => {
    const module = await import("../../scripts/check-wave-scope");

    expect(module.validateWaveScope).toBeTypeOf("function");
  });

  it("exports the tracked and untracked change collector", async () => {
    const module = await import("../../scripts/check-wave-scope");

    expect(module.collectChangedPaths).toBeTypeOf("function");
  });

  it("exports the repository gate runner", async () => {
    const module = await import("../../scripts/check-wave-scope");

    expect(module.runWaveScopeCheck).toBeTypeOf("function");
  });

  it("is exposed as the manual wave-scope npm command", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve("package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["check:wave-scope"]).toBe(
      "tsx scripts/check-wave-scope.ts",
    );
  });
});

describe("wave manifest", () => {
  it("exists at the hardening-wave path", () => {
    expect(
      existsSync(
        resolve(".claude/specs/you-vs-cpu-hardening-wave-manifest.json"),
      ),
    ).toBe(true);
  });

  it("lists every hardening ticket with required routing metadata", () => {
    const actual = JSON.parse(
      readFileSync(
        resolve(".claude/specs/you-vs-cpu-hardening-wave-manifest.json"),
        "utf8",
      ),
    ) as Partial<WaveManifest>;
    const expectedIds = [
      "BUG-130",
      "BUG-140",
      "BUG-158",
      "BUG-166",
      "BUG-167",
      "BUG-176",
      "BUG-180",
      ...Array.from({ length: 30 }, (_, index) => `BUG-${202 + index}`),
      "BUG-232",
      "BUG-233",
      "BUG-234",
    ];

    expect(actual.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(actual.bugs).toHaveLength(40);
    expect(actual.bugs?.map((entry) => entry.id).sort()).toEqual(
      expectedIds.sort(),
    );
    expect(
      Object.fromEntries(
        ["verified", "spec-out", "open"].map((classification) => [
          classification,
          actual.bugs?.filter((entry) => entry.classification === classification).length,
        ]),
      ),
    ).toEqual({ verified: 35, "spec-out": 3, open: 2 });
    expect(actual.bugs?.find((entry) => entry.id === "BUG-232")?.classification).toBe(
      "verified",
    );
    expect(actual.bugs?.find((entry) => entry.id === "BUG-233")?.classification).toBe(
      "open",
    );
    expect(actual.bugs?.find((entry) => entry.id === "BUG-234")?.classification).toBe(
      "open",
    );
    for (const entry of actual.bugs ?? []) {
      expect(["verified", "spec-out", "open", "official-blocked"]).toContain(
        entry.classification,
      );
      expect(entry.owner).not.toBe("");
      if (
        entry.classification === "verified" ||
        entry.classification === "spec-out"
      ) {
        expect(entry.implementationPaths.length).toBeGreaterThan(0);
        expect(entry.testPaths.length).toBeGreaterThan(0);
        expect(entry.verificationCommands.length).toBeGreaterThan(0);
        expect(entry.nextWaveReason).toBeNull();
      } else {
        expect(entry.nextWaveReason).toEqual(expect.any(String));
        expect(entry.nextWaveReason).not.toBe("");
      }
    }
  });
});

describe("validateWaveScope", () => {
  it("treats LF, CRLF, and CR as the same stable text hash", () => {
    const lf = stableTextSha256("alpha\nbeta\n");

    expect(stableTextSha256("alpha\r\nbeta\r\n")).toBe(lf);
    expect(stableTextSha256("alpha\rbeta\r")).toBe(lf);
    expect(stableTextSha256("alpha\ngamma\n")).not.toBe(lf);
  });

  it("rejects a changed path outside the manifest", () => {
    const root = tempRepo();
    createRepoFile(root, "src/outside.ts");

    expect(
      validateWaveScope(manifest(), ["src/owned.ts", "src/outside.ts"], root),
    ).toContain("changed path is outside manifest: src/outside.ts");
  });

  it("rejects a manifest path that does not exist", () => {
    const root = tempRepo();
    const input = manifest({ bugs: [bug("BUG-202", ["src/missing.ts"])] });

    expect(validateWaveScope(input, ["src/owned.ts"], root)).toContain(
      "manifest path does not exist: src/missing.ts",
    );
  });

  it("rejects one changed path owned by multiple RCAs", () => {
    const root = tempRepo();
    const input = manifest({
      bugs: [
        bug("BUG-202", ["src/owned.ts"]),
        bug("BUG-203", ["src/owned.ts"]),
      ],
      changeOwnership: [
        { path: "src/owned.ts", owner: "owner-BUG-202", bugId: "BUG-202" },
        { path: "src/owned.ts", owner: "owner-BUG-203", bugId: "BUG-203" },
      ],
    });

    expect(validateWaveScope(input, ["src/owned.ts"], root)).toContain(
      "changed path has multiple RCA owners: src/owned.ts (BUG-202, BUG-203)",
    );
  });

  it("rejects a manifest ownership path absent from the current snapshot", () => {
    const root = tempRepo();

    expect(validateWaveScope(manifest(), ["src/owned.ts"], root)).toContain(
      "manifest ownership path is not changed: tests/owned.test.ts",
    );
  });

  it("allows a stable pre-existing ownership path absent from changed paths", () => {
    const root = tempRepo();
    const input = manifest({
      bugs: [],
      changeOwnership: [
        {
          path: "src/owned.ts",
          owner: "pre-existing-user-work",
          contentSha256: stableTextSha256("fixture\n"),
        },
      ],
    });

    expect(validateWaveScope(input, [], root)).toEqual([]);
  });

  it("skips stale pre-existing hash validation when the path is not changed", () => {
    const root = tempRepo();
    const input = manifest({
      bugs: [],
      changeOwnership: [
        {
          path: "src/owned.ts",
          owner: "pre-existing-user-work",
          contentSha256: stableTextSha256("older snapshot\n"),
        },
      ],
    });

    expect(validateWaveScope(input, [], root)).toEqual([]);
  });

  it("rejects paths that escape the repository root", () => {
    const root = tempRepo();
    const input = manifest({ bugs: [bug("BUG-202", ["../outside.ts"])] });

    expect(
      validateWaveScope(input, ["src/owned.ts", "tests/owned.test.ts"], root),
    ).toContain("manifest path escapes repository: ../outside.ts");
  });

  it("rejects a path that escapes through a junction", () => {
    const root = tempRepo();
    const outside = mkdtempSync(resolve(tmpdir(), "conan-wave-outside-"));
    tempRoots.push(outside);
    createRepoFile(outside, "outside.ts");
    symlinkSync(outside, resolve(root, "linked"), "junction");
    const input = manifest({
      bugs: [bug("BUG-202", ["linked/outside.ts"])],
    });

    expect(
      validateWaveScope(input, ["src/owned.ts", "tests/owned.test.ts"], root),
    ).toContain("manifest path escapes repository via link: linked/outside.ts");
  });

  it("rejects deleted paths because this snapshot requires path existence", () => {
    const root = tempRepo();
    rmSync(resolve(root, "src/owned.ts"));

    expect(
      validateWaveScope(
        manifest(),
        ["src/owned.ts", "tests/owned.test.ts"],
        root,
      ),
    ).toContain("manifest path does not exist: src/owned.ts");
  });

  it("rejects content changes to an already-listed pre-existing file", () => {
    const root = tempRepo();
    const ownedPath = resolve(root, "src/owned.ts");
    const contentSha256 = stableTextSha256(readFileSync(ownedPath, "utf8"));
    const input = manifest({
      changeOwnership: [
        {
          path: "src/owned.ts",
          owner: "pre-existing-user-work",
          contentSha256,
        } as WaveManifest["changeOwnership"][number] & {
          contentSha256: string;
        },
      ],
    });
    createRepoFile(root, "src/owned.ts", "overwritten\n");

    expect(validateWaveScope(input, ["src/owned.ts"], root)).toContain(
      "pre-existing content hash changed: src/owned.ts",
    );
  });

  it("accepts an EOL-only change to pre-existing UTF-8 content", () => {
    const root = tempRepo();
    const ownedPath = resolve(root, "src/owned.ts");
    const input = manifest({
      changeOwnership: [
        {
          path: "src/owned.ts",
          owner: "pre-existing-user-work",
          contentSha256: stableTextSha256("fixture\n"),
        },
      ],
    });
    writeFileSync(ownedPath, "fixture\r\n", "utf8");

    expect(validateWaveScope(input, ["src/owned.ts"], root)).not.toContain(
      "pre-existing content hash changed: src/owned.ts",
    );
  });

  it("requires a content hash for pre-existing ownership", () => {
    const root = tempRepo();
    const input = manifest({
      changeOwnership: [
        { path: "src/owned.ts", owner: "pre-existing-user-work" },
      ],
    });

    expect(validateWaveScope(input, ["src/owned.ts"], root)).toContain(
      "pre-existing ownership requires contentSha256: src/owned.ts",
    );
  });

  it("requires evidence fields for verified tickets", () => {
    const root = tempRepo();
    const verified = bug("BUG-202", ["src/owned.ts"]);
    verified.classification = "verified";
    verified.testPaths = [];

    expect(
      validateWaveScope(manifest({ bugs: [verified] }), ["src/owned.ts"], root),
    ).toContain("verified ticket requires testPaths: BUG-202");
  });

  it("rejects blank verified evidence entries", () => {
    const root = tempRepo();
    const verified = bug("BUG-202", [" "]);
    verified.classification = "verified";
    verified.testPaths = ["tests/owned.test.ts"];
    verified.verificationCommands = [" "];
    verified.nextWaveReason = null;

    const errors = validateWaveScope(
      manifest({ bugs: [verified] }),
      ["src/owned.ts", "tests/owned.test.ts"],
      root,
    );
    expect(errors).toContain(
      "verified ticket has blank implementationPaths entry: BUG-202",
    );
    expect(errors).toContain(
      "verified ticket has blank verificationCommands entry: BUG-202",
    );
  });

  it("requires verified evidence paths to be regular files", () => {
    const root = tempRepo();
    const verified = bug("BUG-202", ["src"]);
    verified.classification = "verified";
    verified.testPaths = ["tests/owned.test.ts"];
    verified.verificationCommands = ["npx vitest run tests/owned.test.ts"];
    verified.nextWaveReason = null;

    expect(
      validateWaveScope(
        manifest({ bugs: [verified] }),
        ["src/owned.ts", "tests/owned.test.ts"],
        root,
      ),
    ).toContain("ticket evidence path is not a regular file: BUG-202 (src)");
  });

  it("requires every verified test path in a verification command", () => {
    const root = tempRepo();
    const verified = bug("BUG-202", ["src/owned.ts"]);
    verified.classification = "verified";
    verified.testPaths = ["tests/owned.test.ts"];
    verified.verificationCommands = ["npm test"];
    verified.nextWaveReason = null;

    expect(
      validateWaveScope(
        manifest({ bugs: [verified] }),
        ["src/owned.ts", "tests/owned.test.ts"],
        root,
      ),
    ).toContain(
      "verified testPath is absent from verificationCommands: BUG-202 (tests/owned.test.ts)",
    );
  });

  it("does not accept a test path that is only a command substring", () => {
    const root = tempRepo();
    createRepoFile(root, "tests/x.test.ts");
    const verified = bug("BUG-202", ["src/owned.ts"]);
    verified.classification = "verified";
    verified.testPaths = ["tests/x.test.ts"];
    verified.verificationCommands = ["echo tests/x.test.ts.bak"];
    verified.nextWaveReason = null;

    expect(
      validateWaveScope(
        manifest({ bugs: [verified] }),
        ["src/owned.ts", "tests/owned.test.ts"],
        root,
      ),
    ).toContain(
      "verified testPath is absent from verificationCommands: BUG-202 (tests/x.test.ts)",
    );
  });

  it("accepts a quoted exact test-path command token", () => {
    const root = tempRepo();
    createRepoFile(root, "tests/x.test.ts");
    const verified = bug("BUG-202", ["src/owned.ts"]);
    verified.classification = "verified";
    verified.testPaths = ["tests/x.test.ts"];
    verified.verificationCommands = ['npx vitest run "tests/x.test.ts"'];
    verified.nextWaveReason = null;

    expect(
      validateWaveScope(
        manifest({ bugs: [verified] }),
        ["src/owned.ts", "tests/owned.test.ts"],
        root,
      ),
    ).not.toContain(
      "verified testPath is absent from verificationCommands: BUG-202 (tests/x.test.ts)",
    );
  });

  it("validates non-empty evidence supplied by an open ticket", () => {
    const root = tempRepo();
    const open = bug("BUG-202", [" "]);
    open.testPaths = ["tests/owned.test.ts"];
    open.verificationCommands = ["npm test"];

    const errors = validateWaveScope(
      manifest({ bugs: [open] }),
      ["src/owned.ts", "tests/owned.test.ts"],
      root,
    );
    expect(errors).toContain(
      "open ticket has blank implementationPaths entry: BUG-202",
    );
    expect(errors).toContain(
      "open testPath is absent from verificationCommands: BUG-202 (tests/owned.test.ts)",
    );
  });

  it("requires a next-wave reason for open tickets", () => {
    const root = tempRepo();
    const open = bug("BUG-202", ["src/owned.ts"]);
    open.nextWaveReason = null;

    expect(
      validateWaveScope(manifest({ bugs: [open] }), ["src/owned.ts"], root),
    ).toContain("open ticket requires nextWaveReason: BUG-202");
  });

  it("rejects an unknown ticket classification from JSON", () => {
    const root = tempRepo();
    const invalid = bug("BUG-202", ["src/owned.ts"]);
    invalid.classification = "unknown" as WaveBug["classification"];

    expect(
      validateWaveScope(manifest({ bugs: [invalid] }), ["src/owned.ts"], root),
    ).toContain("ticket has invalid classification: BUG-202 (unknown)");
  });
});

describe("collectChangedPaths", () => {
  it("respects core.autocrlf=true when a clean checkout contains CRLF", () => {
    const root = tempRepo();
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["config", "user.email", "scope-test@example.invalid"], {
      cwd: root,
    });
    execFileSync("git", ["config", "user.name", "Scope Test"], { cwd: root });
    execFileSync("git", ["config", "core.autocrlf", "true"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
    rmSync(resolve(root, "src/owned.ts"));
    execFileSync("git", ["checkout", "--", "src/owned.ts"], { cwd: root });

    expect(readFileSync(resolve(root, "src/owned.ts"), "utf8")).toContain("\r\n");
    expect(
      execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }),
    ).toBe("");
    expect(collectChangedPaths(root)).toEqual([]);
  });

  it("collects both tracked and untracked workspace changes", () => {
    const root = tempRepo();
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync(
      "git",
      ["config", "user.email", "scope-test@example.invalid"],
      { cwd: root },
    );
    execFileSync("git", ["config", "user.name", "Scope Test"], { cwd: root });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });

    createRepoFile(root, "src/owned.ts", "changed\n");
    createRepoFile(root, "src/untracked.ts");

    expect(collectChangedPaths(root)).toEqual([
      "src/owned.ts",
      "src/untracked.ts",
    ]);
  });

  it("reports both sides of a rename for the deletion-unsupported contract", () => {
    const root = tempRepo();
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync(
      "git",
      ["config", "user.email", "scope-test@example.invalid"],
      { cwd: root },
    );
    execFileSync("git", ["config", "user.name", "Scope Test"], { cwd: root });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });

    execFileSync("git", ["mv", "src/owned.ts", "src/renamed.ts"], {
      cwd: root,
    });

    expect(collectChangedPaths(root)).toEqual([
      "src/owned.ts",
      "src/renamed.ts",
    ]);
  });

  it("keeps inspecting the captured base after HEAD advances", () => {
    const root = tempRepo();
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync(
      "git",
      ["config", "user.email", "scope-test@example.invalid"],
      { cwd: root },
    );
    execFileSync("git", ["config", "user.name", "Scope Test"], { cwd: root });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "baseline"], { cwd: root });
    const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();

    createRepoFile(root, "src/owned.ts", "committed after baseline\n");
    execFileSync("git", ["add", "src/owned.ts"], { cwd: root });
    execFileSync("git", ["commit", "-qm", "advance head"], { cwd: root });

    const collectFromBase = collectChangedPaths as (
      repoRoot: string,
      baseCommit: string,
    ) => string[];
    expect(collectFromBase(root, baseCommit)).toEqual(["src/owned.ts"]);
  });
});

describe("runWaveScopeCheck", () => {
  it("loads the repository manifest and validates current changes", () => {
    const root = tempRepo();
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync(
      "git",
      ["config", "user.email", "scope-test@example.invalid"],
      { cwd: root },
    );
    execFileSync("git", ["config", "user.name", "Scope Test"], { cwd: root });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
    const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    createRepoFile(root, "src/outside.ts");

    const manifestPath =
      ".claude/specs/you-vs-cpu-hardening-wave-manifest.json";
    createRepoFile(
      root,
      manifestPath,
      JSON.stringify(
        manifest({
          baseCommit,
          changeOwnership: [{ path: manifestPath, owner: "phase1-task1" }],
        }),
      ),
    );

    expect(runWaveScopeCheck(root).errors).toContain(
      "changed path is outside manifest: src/outside.ts",
    );
  });

  it.each(["HEAD", "deadbee", "baseline-tag"])(
    "rejects non-OID baseCommit %s before collecting changes",
    (invalidBaseCommit) => {
      const root = tempRepo();
      execFileSync("git", ["init", "-q"], { cwd: root });
      execFileSync(
        "git",
        ["config", "user.email", "scope-test@example.invalid"],
        { cwd: root },
      );
      execFileSync("git", ["config", "user.name", "Scope Test"], {
        cwd: root,
      });
      execFileSync("git", ["config", "core.autocrlf", "false"], {
        cwd: root,
      });
      execFileSync("git", ["add", "."], { cwd: root });
      execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
      const manifestPath =
        ".claude/specs/you-vs-cpu-hardening-wave-manifest.json";
      createRepoFile(
        root,
        manifestPath,
        JSON.stringify(
          manifest({
            baseCommit: invalidBaseCommit,
            changeOwnership: [{ path: manifestPath, owner: "phase1-task1" }],
          }),
        ),
      );

      expect(runWaveScopeCheck(root).errors).toEqual([
        `manifest baseCommit must be a full 40-hex commit OID: ${invalidBaseCommit}`,
      ]);
    },
  );

  it("rejects a full OID that is not an existing commit", () => {
    const root = tempRepo();
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync(
      "git",
      ["config", "user.email", "scope-test@example.invalid"],
      { cwd: root },
    );
    execFileSync("git", ["config", "user.name", "Scope Test"], { cwd: root });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
    const manifestPath =
      ".claude/specs/you-vs-cpu-hardening-wave-manifest.json";
    const missingOid = "f".repeat(40);
    createRepoFile(
      root,
      manifestPath,
      JSON.stringify(
        manifest({
          baseCommit: missingOid,
          changeOwnership: [{ path: manifestPath, owner: "phase1-task1" }],
        }),
      ),
    );

    expect(runWaveScopeCheck(root).errors).toEqual([
      `manifest baseCommit is not an existing commit: ${missingOid}`,
    ]);
  });
});
