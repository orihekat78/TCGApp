import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  QUALIFICATION_COMMAND_IDS,
  publishQualificationReport,
  runFinalQualification,
  validateQualificationReport,
  type QualificationCommandInput,
  type QualificationExecution,
} from "../../scripts/private-hosted/run-final-qualification.js";

const HASH = "a".repeat(64);

async function fixture(): Promise<{ repoRoot: string; runDir: string }> {
  const parent = await mkdtemp(join(tmpdir(), "conan-final-qualification-test-"));
  const repoRoot = resolve(parent, "repo");
  const runDir = resolve(parent, "run");
  await mkdir(repoRoot);
  await mkdir(runDir);
  await writeFile(resolve(repoRoot, "package-lock.json"), "{}\n");
  return { repoRoot, runDir };
}

function manifest(files: unknown[]): string {
  return `${JSON.stringify({ schemaVersion: 1, files }, null, 2)}\n`;
}

describe("private hosted final qualification", () => {
  it("never publishes or retains a partial qualification report", async () => {
    for (const failure of ["write", "publish"] as const) {
      const f = await fixture();
      const reportPath = resolve(f.runDir, "qualification-report.json");
      await expect(
        publishQualificationReport(
          reportPath,
          '{"complete":true}\n',
          failure === "write"
            ? {
                writeTemp: async (tempPath) => {
                  await writeFile(tempPath, "partial", { flag: "wx" });
                  throw new Error("injected interrupted write");
                },
              }
            : {
                publishTemp: async () => {
                  throw new Error("injected publish failure");
                },
              },
        ),
      ).rejects.toThrow(/injected/);
      await expect(readFile(reportPath, "utf8")).rejects.toThrow();
      expect((await readdir(f.runDir)).filter((name) => name.includes(".tmp-"))).toEqual([]);
    }
  });

  it("runs every required command once in exact order and writes a validated report only after success", async () => {
    const f = await fixture();
    let tick = Date.parse("2026-08-04T00:00:00.000Z");
    const seen: string[] = [];
    const seenInputs: QualificationCommandInput[] = [];
    const execute = async (input: QualificationCommandInput): Promise<QualificationExecution> => {
      seen.push(input.id);
      seenInputs.push({
        ...input,
        args: [...input.args],
        env: { ...input.env },
      });
      const startedAt = new Date(tick).toISOString();
      tick += 1_000;
      let output = `${input.id}\n`;
      if (input.id === "lint") output = "lint complete: ✓\r\nall bytes included\n";
      if (input.id === "secret-scan" || input.id === "destination-scan") {
        output = `${JSON.stringify({ schemaVersion: 1, ok: true, findings: [] }, null, 2)}\n`;
      }
      if (input.id === "bug-gate") {
        output = `${JSON.stringify({ schemaVersion: 1, ok: true, blockers: [], knownLimitations: [] }, null, 2)}\n`;
      }
      if (input.id === "prepare-release") {
        await mkdir(resolve(f.runDir, "evidence"));
        await mkdir(resolve(f.runDir, "staging"));
        await writeFile(resolve(f.runDir, "evidence/upload-manifest.json"), manifest([]));
        await writeFile(resolve(f.runDir, "evidence/response-manifest.json"), manifest([]));
      }
      await writeFile(input.logPath, output, { flag: "wx" });
      const completedAt = new Date(tick).toISOString();
      tick += 1_000;
      return { exitCode: 0, startedAt, completedAt };
    };

    const report = await runFinalQualification(
      { repoRoot: f.repoRoot, runDir: f.runDir },
      {
        execute,
        snapshot: async () => ({ releaseCommit: "1".repeat(40), packageLockSha256: HASH }),
        status: async () => "",
        now: () => new Date(tick),
      },
    );

    expect(seen).toEqual(QUALIFICATION_COMMAND_IDS);
    const expectedNpmArgs: Partial<Record<(typeof QUALIFICATION_COMMAND_IDS)[number], string[]>> = {
      "npm-ci": ["ci"],
      build: ["run", "--silent", "build"],
      "dependency-audit": ["audit", "--audit-level=high"],
      "secret-scan": ["run", "--silent", "private-hosted:scan-secrets"],
      "destination-scan": ["run", "--silent", "private-hosted:scan-destinations"],
      "bug-gate": ["run", "--silent", "private-hosted:bug-gate"],
      typecheck: ["run", "--silent", "typecheck"],
      lint: ["run", "--silent", "lint"],
      unit: ["run", "--silent", "test"],
      smoke: ["run", "--silent", "smoke:1000"],
      "dev-e2e": ["run", "--silent", "test:e2e"],
      docs: ["run", "--silent", "docs"],
      "docs-check": ["run", "--silent", "docs:check"],
      "prepared-private-e2e": [
        "run",
        "--silent",
        "test:e2e:private-hosted:prepared",
      ],
    };
    for (const input of seenInputs) {
      expect(input.cwd, input.id).toBe(f.repoRoot);
      expect(input.logPath, input.id).toBe(
        resolve(
          f.runDir,
          `logs/${String(QUALIFICATION_COMMAND_IDS.indexOf(input.id) + 1).padStart(2, "0")}-${input.id}.log`,
        ),
      );
      const npmArgs = expectedNpmArgs[input.id];
      if (npmArgs) {
        expect(input.file, input.id).toBe(process.execPath);
        expect(input.args[0], input.id).toMatch(/npm-cli\.js$/);
        expect(input.args.slice(1), input.id).toEqual(npmArgs);
      }
      expect(input.env.CI, input.id).toBe("1");
      expect(input.env.NODE_OPTIONS, input.id).toBeUndefined();
      expect(input.env.CLOUDFLARE_API_TOKEN, input.id).toBeUndefined();
      expect(input.env.PRIVATE_HOSTED_ARTIFACT_DIR, input.id).toBe(
        input.id === "secret-scan" || input.id === "destination-scan"
          ? resolve(f.runDir, "staging")
          : undefined,
      );
    }
    const devE2EPort = seenInputs.find(({ id }) => id === "dev-e2e")?.env
      .PLAYWRIGHT_PORT;
    expect(devE2EPort).toMatch(/^2\d{4}$/);
    expect(devE2EPort).not.toBe("5173");
    expect(
      seenInputs
        .filter(({ id }) => id !== "dev-e2e")
        .every(({ env }) => env.PLAYWRIGHT_PORT === undefined),
    ).toBe(true);
    expect(seenInputs.find(({ id }) => id === "prepare-release")).toMatchObject({
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        resolve(f.repoRoot, "scripts/private-hosted/prepare.ps1"),
        "--staging",
        resolve(f.runDir, "staging"),
        "--evidence",
        resolve(f.runDir, "evidence"),
      ],
    });
    expect(seenInputs.find(({ id }) => id === "clean-tree-check")).toMatchObject({
      args: ["status", "--porcelain=v1", "--untracked-files=all"],
    });
    const preparedInput = seenInputs.find(({ id }) => id === "prepared-private-e2e")!;
    expect(preparedInput.env).toMatchObject({
      PRIVATE_HOSTED_FINAL_PRODUCER: "1",
      PRIVATE_HOSTED_RUN_DIR: f.runDir,
      PRIVATE_HOSTED_STAGING_DIR: resolve(f.runDir, "staging"),
      PRIVATE_HOSTED_UPLOAD_MANIFEST: resolve(
        f.runDir,
        "evidence/upload-manifest.json",
      ),
      PRIVATE_HOSTED_RESPONSE_MANIFEST: resolve(
        f.runDir,
        "evidence/response-manifest.json",
      ),
    });
    const pkg = JSON.parse(
      await readFile(resolve(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.["test:e2e:private-hosted"]).toBe(
      "tsx scripts/private-hosted/run-local-qualification.ts --mode standalone",
    );
    expect(pkg.scripts?.["test:e2e:private-hosted:prepared"]).toBe(
      "tsx scripts/private-hosted/run-local-qualification.ts --mode prepared",
    );
    expect(report.commands.map((command) => command.id)).toEqual(
      QUALIFICATION_COMMAND_IDS,
    );
    expect(report.commands.find((command) => command.id === "prepared-private-e2e"))
      .toMatchObject({
        preparedInputs: {
          mode: "prepared",
          stagingRealpath: resolve(f.runDir, "staging"),
          postStopStagingMatch: true,
        },
      });
    expect(report.bugGateSha256).toMatch(/^[0-9a-f]{64}$/);
    const lintRecord = report.commands.find(({ id }) => id === "lint")!;
    const lintBytes = await readFile(resolve(f.runDir, lintRecord.log.path));
    expect(lintRecord.log.bytes).toBe(lintBytes.byteLength);
    expect(lintRecord.log.sha256).toBe(
      createHash("sha256").update(lintBytes).digest("hex"),
    );
    expect(validateQualificationReport(report)).toBe(report);
    expect(JSON.parse(await readFile(resolve(f.runDir, "qualification-report.json"), "utf8")))
      .toEqual(report);
  });

  it("does not write a report after a failure, skip, duplicate, dirty tree, or changed snapshot", async () => {
    for (const failure of ["exit", "dirty", "snapshot", "manifest"] as const) {
      const f = await fixture();
      let tick = Date.parse("2026-08-04T00:00:00.000Z");
      let executions = 0;
      const execute = async (input: QualificationCommandInput): Promise<QualificationExecution> => {
        executions += 1;
        const startedAt = new Date(tick).toISOString();
        tick += 1_000;
        let output = `${input.id}\n`;
        if (input.id === "secret-scan" || input.id === "destination-scan") {
          output = '{"schemaVersion":1,"ok":true,"findings":[]}\n';
        }
        if (input.id === "bug-gate") output = '{"schemaVersion":1,"ok":true,"blockers":[],"knownLimitations":[]}\n';
        if (input.id === "prepare-release") {
          await mkdir(resolve(f.runDir, "evidence"));
          await mkdir(resolve(f.runDir, "staging"));
          await writeFile(resolve(f.runDir, "evidence/upload-manifest.json"), manifest([]));
          await writeFile(resolve(f.runDir, "evidence/response-manifest.json"), manifest([]));
        }
        if (failure === "manifest" && input.id === "prepared-private-e2e") {
          await writeFile(
            resolve(f.runDir, "evidence/upload-manifest.json"),
            manifest([{ path: "/changed" }]),
          );
        }
        await writeFile(input.logPath, output, { flag: "wx" });
        const completedAt = new Date(tick).toISOString();
        tick += 1_000;
        return {
          exitCode: failure === "exit" && input.id === "lint" ? 1 : 0,
          startedAt,
          completedAt,
        };
      };
      let snapshots = 0;
      await expect(
        runFinalQualification(
          { repoRoot: f.repoRoot, runDir: f.runDir },
          {
            execute,
            snapshot: async () => ({
              releaseCommit: "1".repeat(40),
              packageLockSha256: failure === "snapshot" && snapshots++ > 0 ? "b".repeat(64) : HASH,
            }),
            status: async () => (failure === "dirty" ? " M generated.md\n" : ""),
            now: () => new Date(tick),
          },
        ),
      ).rejects.toThrow();
      await expect(readFile(resolve(f.runDir, "qualification-report.json"), "utf8"))
        .rejects.toThrow();
      if (failure === "dirty") expect(executions).toBe(0);
    }
  });

  it("rejects reordered commands, missing logs, non-UTC times, or non-empty release findings", () => {
    const command = (id: (typeof QUALIFICATION_COMMAND_IDS)[number], index: number) => ({
      id,
      argv: ["node", id],
      exitCode: 0 as const,
      startedAt: `2026-08-04T00:00:${String(index * 2).padStart(2, "0")}.000Z`,
      completedAt: `2026-08-04T00:00:${String(index * 2 + 1).padStart(2, "0")}.000Z`,
      log: {
        path: `logs/${String(index + 1).padStart(2, "0")}-${id}.log`,
        bytes: 1,
        sha256: HASH,
      },
      ...(id === "prepared-private-e2e"
        ? {
            preparedInputs: {
              mode: "prepared" as const,
              stagingRealpath: "C:\\outside\\staging",
              uploadManifestSha256: HASH,
              responseManifestSha256: HASH,
              postStopStagingMatch: true as const,
            },
          }
        : {}),
    });
    const base = {
      schemaVersion: 2 as const,
      releaseCommit: "1".repeat(40),
      packageLockSha256: HASH,
      uploadManifestSha256: HASH,
      responseManifestSha256: HASH,
      startedAt: "2026-08-04T00:00:00.000Z",
      completedAt: "2026-08-04T00:01:00.000Z",
      commands: QUALIFICATION_COMMAND_IDS.map(command),
      secretFindings: [],
      destinationFindings: [],
      bugGateSha256: HASH,
    };
    expect(() => validateQualificationReport({ ...base, commands: [...base.commands].reverse() }))
      .toThrow(/command order/);
    expect(() => validateQualificationReport({ ...base, commands: base.commands.slice(0, -1) }))
      .toThrow(/command order/);
    expect(() => validateQualificationReport({ ...base, secretFindings: [{ code: "x" }] }))
      .toThrow(/secret/);
    expect(() => validateQualificationReport({ ...base, destinationFindings: [{ code: "x" }] }))
      .toThrow(/destination/);
    expect(() => validateQualificationReport({ ...base, startedAt: "2026-08-04 00:00:00" }))
      .toThrow(/UTC/);
    const badLog = structuredClone(base);
    badLog.commands[0]!.log.bytes = 0;
    expect(() => validateQualificationReport(badLog)).toThrow(/log/);
    expect(() =>
      validateQualificationReport({ ...base, unexpected: "not canonical" }),
    ).toThrow(/exact schema/);
    const extraCommand = structuredClone(base) as typeof base & {
      commands: Array<(typeof base.commands)[number] & { secret?: string }>;
    };
    extraCommand.commands[0]!.secret = "must not enter evidence";
    expect(() => validateQualificationReport(extraCommand)).toThrow(/exact schema/);
  });
});
