import { createHash } from "node:crypto";
import { mkdtemp, mkdir, realpath, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { BuildManifests, ManifestEntry } from "../../scripts/private-hosted/types.js";
import {
  assertPrivateHostedPortAvailable,
  parseLocalQualificationArgs,
  resolvePrivateHostedEnvironment,
  runPreparedLocalQualificationForTest,
} from "../../scripts/private-hosted/run-local-qualification.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((done) => server.close(() => done())),
    ),
  );
});

function entry(path: string, content: string): ManifestEntry {
  const bytes = Buffer.from(content);
  return {
    path,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function fixture(): Promise<{
  repoRoot: string;
  runDir: string;
  stagingDir: string;
  uploadManifestPath: string;
  responseManifestPath: string;
  manifests: BuildManifests;
}> {
  const parent = await mkdtemp(join(tmpdir(), "conan-private-hosted-test-"));
  const repoRoot = resolve(parent, "repo");
  const runDir = resolve(parent, "run");
  const stagingDir = resolve(runDir, "staging");
  await mkdir(repoRoot);
  await mkdir(stagingDir, { recursive: true });
  const index = "<!doctype html><title>private</title>";
  const headers = "/*\n  Cache-Control: no-store\n";
  await writeFile(resolve(stagingDir, "index.html"), index);
  await writeFile(resolve(stagingDir, "_headers"), headers);
  const manifests: BuildManifests = {
    schemaVersion: 1,
    upload: [entry("/_headers", headers), entry("/index.html", index)].sort(
      (left, right) => left.path.localeCompare(right.path),
    ),
    response: [entry("/index.html", index)],
  };
  const uploadManifestPath = resolve(runDir, "upload-manifest.json");
  const responseManifestPath = resolve(runDir, "response-manifest.json");
  await writeFile(
    uploadManifestPath,
    `${JSON.stringify({ schemaVersion: 1, files: manifests.upload }, null, 2)}\n`,
  );
  await writeFile(
    responseManifestPath,
    `${JSON.stringify({ schemaVersion: 1, files: manifests.response }, null, 2)}\n`,
  );
  return {
    repoRoot,
    runDir,
    stagingDir,
    uploadManifestPath,
    responseManifestPath,
    manifests,
  };
}

describe("private hosted local qualification", () => {
  it("requires one explicit mode and final-producer authority for prepared mode", () => {
    expect(parseLocalQualificationArgs(["--mode", "standalone"], {})).toEqual({
      mode: "standalone",
    });
    expect(() => parseLocalQualificationArgs([], {})).toThrow(/--mode/);
    expect(() =>
      parseLocalQualificationArgs(["--mode", "prepared"], {}),
    ).toThrow(/final producer/);
    expect(() =>
      parseLocalQualificationArgs(
        ["--mode", "standalone", "--mode", "prepared"],
        { PRIVATE_HOSTED_FINAL_PRODUCER: "1" },
      ),
    ).toThrow(/exactly one/);
  });

  it("requires absolute, repository-external prepared inputs", async () => {
    const f = await fixture();
    expect(() =>
      resolvePrivateHostedEnvironment(
        {
          PRIVATE_HOSTED_STAGING_DIR: "relative/staging",
          PRIVATE_HOSTED_UPLOAD_MANIFEST: f.uploadManifestPath,
          PRIVATE_HOSTED_RESPONSE_MANIFEST: f.responseManifestPath,
          PRIVATE_HOSTED_RUN_DIR: f.runDir,
        },
        f.repoRoot,
      ),
    ).toThrow(/absolute/);
    expect(() =>
      resolvePrivateHostedEnvironment(
        {
          PRIVATE_HOSTED_STAGING_DIR: resolve(f.repoRoot, "staging"),
          PRIVATE_HOSTED_UPLOAD_MANIFEST: f.uploadManifestPath,
          PRIVATE_HOSTED_RESPONSE_MANIFEST: f.responseManifestPath,
          PRIVATE_HOSTED_RUN_DIR: f.runDir,
        },
        f.repoRoot,
      ),
    ).toThrow(/outside the repository/);
  });

  it("rejects an occupied 127.0.0.1:5196 port", async () => {
    const server = createServer();
    servers.push(server);
    await new Promise<void>((done, reject) => {
      server.once("error", reject);
      server.listen(5196, "127.0.0.1", () => done());
    });
    await expect(assertPrivateHostedPortAvailable()).rejects.toThrow(
      /5196.*already in use/,
    );
  });

  it("serves only staging, keeps persistence outside it, and rechecks bytes after stop", async () => {
    const f = await fixture();
    const events: string[] = [];
    await runPreparedLocalQualificationForTest(f, {
      assertPortAvailable: async () => events.push("port"),
      startServer: async (input) => {
        events.push(`serve:${input.cwd}`);
        expect(input.cwd).toBe(f.stagingDir);
        expect(input.args.slice(0, 3)).toEqual([
          "pages",
          "dev",
          f.stagingDir,
        ]);
        const cwdFlag = input.args.indexOf("--cwd");
        expect(cwdFlag).toBeGreaterThan(-1);
        expect(input.args[cwdFlag + 1]).toBe(resolve(f.runDir, "wrangler-control"));
        expect(input.args[cwdFlag + 1]!.startsWith(f.stagingDir)).toBe(false);
        expect(input.args).toContain("--persist-to");
        const compatibilityDateFlag = input.args.indexOf("--compatibility-date");
        expect(compatibilityDateFlag).toBeGreaterThan(-1);
        expect(input.args[compatibilityDateFlag + 1]).toBe("2026-08-06");
        expect(input.persistDir.startsWith(f.runDir)).toBe(true);
        expect(input.persistDir.startsWith(f.stagingDir)).toBe(false);
        return { stop: async () => events.push("stop") };
      },
      runPlaywright: async (environment) => {
        events.push("playwright");
        expect(environment.PRIVATE_HOSTED_STAGING_DIR).toBe(f.stagingDir);
        expect(environment.PRIVATE_HOSTED_UPLOAD_MANIFEST).toBe(
          f.uploadManifestPath,
        );
      },
    });
    expect(events).toEqual([
      "port",
      `serve:${f.stagingDir}`,
      "playwright",
      "stop",
    ]);
  });

  it("fails if Wrangler or the browser mutates staging", async () => {
    const f = await fixture();
    await expect(
      runPreparedLocalQualificationForTest(f, {
        assertPortAvailable: async () => undefined,
        startServer: async () => ({ stop: async () => undefined }),
        runPlaywright: async () => {
          await mkdir(resolve(f.stagingDir, ".wrangler"));
        },
      }),
    ).rejects.toThrow(/forbidden directory|file set does not match/);
  });

  it("fails before starting a server when a supplied manifest is false", async () => {
    const f = await fixture();
    await writeFile(
      f.uploadManifestPath,
      `${JSON.stringify({
        schemaVersion: 1,
        files: [{ ...f.manifests.upload[0], sha256: "0".repeat(64) }, f.manifests.upload[1]],
      })}\n`,
    );
    let started = false;
    await expect(
      runPreparedLocalQualificationForTest(f, {
        assertPortAvailable: async () => undefined,
        startServer: async () => {
          started = true;
          return { stop: async () => undefined };
        },
        runPlaywright: async () => undefined,
      }),
    ).rejects.toThrow(/manifest|bytes/);
    expect(started).toBe(false);
  });

  it.each(["uploadManifestPath", "responseManifestPath"] as const)(
    "rejects a %s whose real path escapes the run directory",
    async (field) => {
      const f = await fixture();
      const escaped = resolve(f.repoRoot, `${field}.json`);
      let started = false;

      await expect(
        runPreparedLocalQualificationForTest(f, {
          canonicalizePath: async (path) =>
            resolve(path) === resolve(f[field]) ? escaped : realpath(path),
          startServer: async () => {
            started = true;
            return { stop: async () => undefined };
          },
        }),
      ).rejects.toThrow(/manifest.*run directory/);
      expect(started).toBe(false);
    },
  );

  it("rejects a run directory whose real path resolves into the repository", async () => {
    const f = await fixture();
    await expect(
      runPreparedLocalQualificationForTest(f, {
        canonicalizePath: async (path) =>
          resolve(path) === resolve(f.runDir) ? f.repoRoot : realpath(path),
      }),
    ).rejects.toThrow(/run directory.*outside the repository/);
  });

  it("rejects a staging directory whose real path escapes the run directory", async () => {
    const f = await fixture();
    await expect(
      runPreparedLocalQualificationForTest(f, {
        canonicalizePath: async (path) =>
          resolve(path) === resolve(f.stagingDir) ? f.repoRoot : realpath(path),
      }),
    ).rejects.toThrow(/staging directory.*run directory/);
  });

  it.each(["wrangler-persist", "wrangler-control"])(
    "rejects a %s directory whose real path escapes after creation",
    async (directory) => {
      const f = await fixture();
      const escaped = resolve(f.repoRoot, directory);
      let started = false;

      await expect(
        runPreparedLocalQualificationForTest(f, {
          assertPortAvailable: async () => undefined,
          canonicalizePath: async (path) =>
            resolve(path) === resolve(f.runDir, directory)
              ? escaped
              : realpath(path),
          startServer: async () => {
            started = true;
            return { stop: async () => undefined };
          },
        }),
      ).rejects.toThrow(/Wrangler.*run directory/);
      expect(started).toBe(false);
    },
  );

  it.each(["wrangler-persist", "wrangler-control"])(
    "rejects a pre-existing %s path before starting Wrangler",
    async (directory) => {
      const f = await fixture();
      await mkdir(resolve(f.runDir, directory));
      let started = false;

      await expect(
        runPreparedLocalQualificationForTest(f, {
          assertPortAvailable: async () => undefined,
          startServer: async () => {
            started = true;
            return { stop: async () => undefined };
          },
        }),
      ).rejects.toThrow(/must be newly created/);
      expect(started).toBe(false);
    },
  );
});
