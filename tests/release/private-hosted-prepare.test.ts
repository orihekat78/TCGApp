import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { tmpdir, userInfo } from "node:os";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAcceptableBuildOutput,
  parsePrepareArgs,
  prepareRelease,
} from "../../scripts/private-hosted/prepare.ts";
import {
  assertRegularAuthorityFile,
  assertWranglerVersionOutput,
  prepareReleaseForTest,
  sanitizedNpmEnvironment,
} from "../../scripts/private-hosted/prepare-internal.ts";
import type {
  PrivateCommand,
  PrivatePrepareControls,
} from "../../scripts/private-hosted/prepare-internal.ts";
import { createHash } from "node:crypto";

const roots: string[] = [];
const externalFiles: string[] = [];

type Fixture = {
  root: string;
  repoRoot: string;
  staging: string;
  evidence: string;
  stagingDir: string;
  evidenceDir: string;
  runBuild: () => Promise<void>;
};

function run(root: string, command: string, args: string[]): string {
  return execFileSync(command, args, { cwd: root, encoding: "utf8" });
}

function commit(root: string, message: string): void {
  run(root, "git", ["add", "."]);
  run(root, "git", ["commit", "--quiet", "-m", message]);
}

function reviewedConfigSha256(root: string): string {
  return createHash("sha256")
    .update(run(root, "git", ["cat-file", "blob", "HEAD:vite.config.ts"]))
    .digest("hex");
}

function write(root: string, path: string, contents: string): void {
  const destination = join(root, path);
  mkdirSync(join(destination, ".."), { recursive: true });
  writeFileSync(destination, contents);
}

function writeBuild(root: string, contents = "export const app = 1;\n"): void {
  write(root, "dist/index.html", "<!doctype html>\n");
  write(root, "dist/favicon.svg", "<svg/>\n");
  write(root, "dist/_headers", "/*\n");
  write(root, "dist/assets/app.js", contents);
  write(root, "dist/assets/app.css", "body {}\n");
  write(
    root,
    "dist/.vite/manifest.json",
    JSON.stringify({
      "index.html": {
        file: "assets/app.js",
        isEntry: true,
        css: ["assets/app.css"],
      },
    }),
  );
}

function fixture(): Fixture {
  const root = mkdtempSync(
    join(tmpdir(), "conan-private-hosted-prepare-repo-"),
  );
  const outputs = mkdtempSync(
    join(tmpdir(), "conan-private-hosted-prepare-output-"),
  );
  roots.push(root, outputs);
  write(
    root,
    "package.json",
    JSON.stringify(
      {
        type: "module",
        packageManager: "npm@11.12.1",
        engines: { node: "24.x" },
        scripts: { build: "vite build" },
        devDependencies: { wrangler: "4.118.0" },
      },
      null,
      2,
    ),
  );
  write(root, "package-lock.json", '{"lockfileVersion":3}\n');
  write(root, ".gitignore", "dist/\n");
  write(root, "index.html", "<!doctype html>\n");
  write(root, "src/payload.ts", "export const payload = 'reviewed';\n");
  write(root, "vite.config.ts", "export default {};\n");
  run(root, "git", ["init", "--quiet"]);
  run(root, "git", ["config", "user.email", "test@example.invalid"]);
  run(root, "git", ["config", "user.name", "Private Hosted Test"]);
  run(root, "git", ["config", "core.autocrlf", "false"]);
  run(root, "git", ["add", "."]);
  run(root, "git", ["commit", "--quiet", "-m", "fixture"]);
  return {
    root,
    repoRoot: root,
    staging: join(outputs, "staging"),
    evidence: join(outputs, "evidence"),
    stagingDir: join(outputs, "staging"),
    evidenceDir: join(outputs, "evidence"),
    runBuild: async () => writeBuild(root),
  };
}

function prepare(
  options: Fixture & { runBuild?: () => Promise<void> },
  overrides: Partial<PrivatePrepareControls> = {},
) {
  const { repoRoot, stagingDir, evidenceDir, runBuild } = options;
  return prepareReleaseForTest(
    { repoRoot, stagingDir, evidenceDir },
    {
      moduleRoot: options.repoRoot,
      expectedConfigSha256: reviewedConfigSha256(options.repoRoot),
      verifyWrangler: async () => "4.118.0",
      runBuild,
      runCommand: async (command) => {
        if (command.args.at(-1) === "--version")
          return { stdout: "11.12.1\n", stderr: "" };
        throw new Error(
          `unexpected command: ${command.file} ${command.args.join(" ")}`,
        );
      },
      ...overrides,
    },
  );
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
  for (const path of externalFiles.splice(0)) rmSync(path, { force: true });
});

describe("private hosted release preparation", () => {
  it("stages only the second inspected closure and writes reproducibility evidence", async () => {
    const item = fixture();
    let builds = 0;

    const result = await prepare({
      ...item,
      runBuild: async () => {
        builds += 1;
        writeBuild(item.root, `export const build = ${builds};\n`);
        if (builds === 2) writeBuild(item.root, "export const build = 1;\n");
      },
    });

    expect(builds).toBe(2);
    expect(result.manifests.upload.map((entry) => entry.path)).toEqual([
      "/_headers",
      "/assets/app.css",
      "/assets/app.js",
      "/favicon.svg",
      "/index.html",
    ]);
    expect(readFileSync(join(item.staging, "assets", "app.js"), "utf8")).toBe(
      "export const build = 1;\n",
    );
    expect(existsSync(join(item.staging, "upload-manifest.json"))).toBe(false);
    expect(
      JSON.parse(
        readFileSync(join(item.evidence, "upload-manifest.json"), "utf8"),
      ),
    ).toEqual({
      schemaVersion: 1,
      files: result.manifests.upload,
    });
    expect(JSON.parse(readFileSync(result.metadataPath, "utf8"))).toMatchObject(
      {
        schemaVersion: 1,
        rootEntry: "index.html",
        buildCommand: "npm run build -- --manifest --config vite.config.ts",
        wranglerVersion: "4.118.0",
        fileCount: 5,
        totalBytes: expect.any(Number),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
    );
    expect(
      readdirSync(item.staging, { recursive: true })
        .map((path) => path.replace(/\\/g, "/"))
        .sort(),
    ).toEqual([
      "_headers",
      "assets",
      "assets/app.css",
      "assets/app.js",
      "favicon.svg",
      "index.html",
    ]);
    expect(readdirSync(item.evidence).sort()).toEqual([
      "release-metadata.json",
      "response-manifest.json",
      "upload-manifest.json",
    ]);
  });

  it("public API rejects an external repository before runner or output side effects", async () => {
    const item = fixture();
    let builds = 0;
    await expect(
      prepareRelease({
        ...item,
        // @ts-expect-error Public release preparation cannot replace the build.
        runBuild: async () => {
          builds += 1;
        },
      }),
    ).rejects.toThrow("canonical module repository root");
    expect(builds).toBe(0);
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it(
    "production wrapper accepts the repository's reviewed Vite configuration",
    async () => {
      const outputs = mkdtempSync(
        join(tmpdir(), "conan-private-hosted-production-prepare-"),
      );
      roots.push(outputs);

      await expect(
        prepareRelease({
          repoRoot: process.cwd(),
          stagingDir: join(outputs, "staging"),
          evidenceDir: join(outputs, "evidence"),
        }),
      ).resolves.toMatchObject({ manifests: expect.any(Object) });
    },
    300_000,
  );

  it("fails when the injected build runner fails", async () => {
    const item = fixture();
    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          throw new Error("build failed");
        },
      }),
    ).rejects.toThrow("build failed");
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it.each([
    [
      "dirty startup",
      false,
      (item: Fixture) => write(item.root, "dirty.txt", "dirty\n"),
    ],
    [
      "missing lockfile",
      true,
      (item: Fixture) => rmSync(join(item.root, "package-lock.json")),
    ],
    [
      "wrong build command",
      true,
      (item: Fixture) =>
        write(
          item.root,
          "package.json",
          JSON.stringify({ scripts: { build: "vite build --mode test" } }),
        ),
    ],
    [
      "prebuild hook",
      true,
      (item: Fixture) =>
        write(
          item.root,
          "package.json",
          JSON.stringify({
            type: "module",
            packageManager: "npm@11.12.1",
            engines: { node: "24.x" },
            scripts: { build: "vite build", prebuild: "echo injected" },
            devDependencies: { wrangler: "4.118.0" },
          }),
        ),
    ],
    [
      "postbuild hook",
      true,
      (item: Fixture) =>
        write(
          item.root,
          "package.json",
          JSON.stringify({
            type: "module",
            packageManager: "npm@11.12.1",
            engines: { node: "24.x" },
            scripts: { build: "vite build", postbuild: "echo injected" },
            devDependencies: { wrangler: "4.118.0" },
          }),
        ),
    ],
    [
      "wrong Node major",
      true,
      (item: Fixture) =>
        write(
          item.root,
          "package.json",
          JSON.stringify({
            type: "module",
            packageManager: "npm@11.12.1",
            engines: { node: "22.x" },
            scripts: { build: "vite build" },
            devDependencies: { wrangler: "4.118.0" },
          }),
        ),
    ],
    [
      "invalid package JSON",
      true,
      (item: Fixture) => write(item.root, "package.json", "{"),
    ],
    [
      "invalid lock JSON",
      true,
      (item: Fixture) => write(item.root, "package-lock.json", "{"),
    ],
    [
      "missing root entry",
      true,
      (item: Fixture) => rmSync(join(item.root, "index.html")),
    ],
    [
      "wrong output directory",
      true,
      (item: Fixture) =>
        write(
          item.root,
          "vite.config.ts",
          'export default { build: { outDir: "dist-meta" } };\n',
        ),
    ],
    [
      "computed output directory",
      true,
      (item: Fixture) =>
        write(
          item.root,
          "vite.config.ts",
          'const output = "dist-meta"; export default { build: { outDir: output } };\n',
        ),
    ],
    [
      "imported non-root app directory",
      true,
      (item: Fixture) => {
        write(item.root, "config-root.ts", 'export const root = "meta-app";\n');
        write(
          item.root,
          "vite.config.ts",
          'import { root } from "./config-root"; export default { root };\n',
        );
      },
    ],
  ])(
    "fails closed for %s before building",
    async (_label, shouldCommit, mutate) => {
      const item = fixture();
      mutate(item);
      if (shouldCommit) commit(item.root, "mutate fixture");
      await expect(prepare(item)).rejects.toThrow(
        /private hosted prepare rejected/,
      );
      expect(existsSync(item.staging)).toBe(false);
      expect(existsSync(item.evidence)).toBe(false);
    },
  );

  it("rejects a dirty Vite config before it can execute", async () => {
    const item = fixture();
    const sentinel = join(item.root, "dirty-config-sentinel.txt");
    write(
      item.root,
      "vite.config.ts",
      [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(${JSON.stringify(sentinel)}, "executed\\n");`,
        "export default {};",
      ].join("\n"),
    );
    let builds = 0;

    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
        },
      }),
    ).rejects.toThrow("tracked file differs from HEAD: vite.config.ts");

    expect(existsSync(sentinel)).toBe(false);
    expect(builds).toBe(0);
  });

  it("rejects contract-time Vite config mutations before the first build", async () => {
    const item = fixture();
    const sentinel = join(item.root, "contract-config-sentinel.txt");
    write(
      item.root,
      "vite.config.ts",
      [
        'import { writeFileSync } from "node:fs";',
        `writeFileSync(${JSON.stringify(sentinel)}, "executed\\n");`,
        "export default {};",
      ].join("\n"),
    );
    commit(item.root, "config side effect");
    let builds = 0;

    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
        },
      }),
    ).rejects.toThrow(
      "Vite config must not import local executable dependencies",
    );

    expect(existsSync(sentinel)).toBe(false);
    expect(builds).toBe(0);
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it("rejects Vite configs conditional on ambient process state before building", async () => {
    const item = fixture();
    write(
      item.root,
      "vite.config.ts",
      'export default { build: { outDir: process.env.npm_lifecycle_event === "build" ? "dist" : "dist-meta" } };\n',
    );
    commit(item.root, "ambient config");
    let builds = 0;
    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
        },
      }),
    ).rejects.toThrow("Vite config must not depend on ambient process state");
    expect(builds).toBe(0);
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it("forces full untracked status despite local Git configuration", async () => {
    const item = fixture();
    run(item.root, "git", ["config", "status.showUntrackedFiles", "no"]);
    write(item.root, "local-config-hidden.ts", "export const hidden = true;\n");
    await expect(prepare(item)).rejects.toThrow("git status is not clean");
  });

  it("rejects raw tracked bytes hidden by a Git clean filter before config execution", async () => {
    const item = fixture();
    const reviewed = `export default {};\n${" ".repeat(700)}`;
    const executionMarker = "__privateHostedConfigExecuted";
    const globals = globalThis as Record<string, unknown>;
    delete globals[executionMarker];
    write(item.root, "vite.config.ts", reviewed);
    commit(item.root, "pad reviewed config");
    write(
      item.root,
      ".git/private-hosted-clean-filter.cjs",
      `process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(${JSON.stringify(reviewed)}));\n`,
    );
    write(
      item.root,
      ".git/info/attributes",
      "vite.config.ts filter=private-hosted-hide-change\n",
    );
    run(item.root, "git", [
      "config",
      "filter.private-hosted-hide-change.clean",
      "node .git/private-hosted-clean-filter.cjs",
    ]);
    const maliciousPrefix = `(globalThis as Record<string, unknown>)[${JSON.stringify(executionMarker)}] = true;\nexport default {};\n`;
    expect(maliciousPrefix.length).toBeLessThan(reviewed.length);
    write(
      item.root,
      "vite.config.ts",
      `${maliciousPrefix}${" ".repeat(reviewed.length - maliciousPrefix.length)}`,
    );
    expect(
      run(item.root, "git", ["check-attr", "filter", "--", "vite.config.ts"]),
    ).toContain("private-hosted-hide-change");
    expect(
      run(item.root, "git", [
        "hash-object",
        "--path=vite.config.ts",
        "vite.config.ts",
      ]).trim(),
    ).toBe(run(item.root, "git", ["rev-parse", "HEAD:vite.config.ts"]).trim());
    expect(run(item.root, "git", ["status", "--porcelain"])).toBe("");

    await expect(prepare(item)).rejects.toThrow(
      "tracked file differs from HEAD: vite.config.ts",
    );
    expect(globals[executionMarker]).toBeUndefined();
    delete globals[executionMarker];
  });

  it("rejects .git/info/exclude hidden project npm configuration", async () => {
    const item = fixture();
    writeFileSync(join(item.root, ".git", "info", "exclude"), ".npmrc\n", {
      flag: "a",
    });
    write(item.root, ".npmrc", "script-shell=unreviewed\n");
    await expect(prepare(item)).rejects.toThrow(
      "ignored build input is forbidden: .npmrc",
    );
  });

  it.each(["vite.config.js", "VITE.CONFIG.CJS"])(
    "rejects ignored alternate Vite config %s before building",
    async (path) => {
      const item = fixture();
      writeFileSync(join(item.root, ".git", "info", "exclude"), `${path}\n`, {
        flag: "a",
      });
      write(
        item.root,
        path,
        "throw new Error('unreviewed config executed');\n",
      );
      let builds = 0;
      await expect(
        prepare({
          ...item,
          runBuild: async () => {
            builds += 1;
            writeBuild(item.root);
          },
        }),
      ).rejects.toThrow(`ignored build input is forbidden: ${path}`);
      expect(builds).toBe(0);
    },
  );

  it.each([".postcssrc", ".postcssrc.js", ".POSTCSSRC.CJS"])(
    "rejects ignored PostCSS config %s before building",
    async (path) => {
      const item = fixture();
      writeFileSync(join(item.root, ".git", "info", "exclude"), `${path}\n`, {
        flag: "a",
      });
      write(
        item.root,
        path,
        "throw new Error('unreviewed PostCSS executed');\n",
      );
      let builds = 0;
      await expect(
        prepare({
          ...item,
          runBuild: async () => {
            builds += 1;
            writeBuild(item.root);
          },
        }),
      ).rejects.toThrow(`ignored build input is forbidden: ${path}`);
      expect(builds).toBe(0);
    },
  );

  it("rejects ignored build inputs created between repeated builds", async () => {
    const item = fixture();
    writeFileSync(join(item.root, ".git", "info", "exclude"), "src/App.js\n", {
      flag: "a",
    });
    let builds = 0;
    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
          writeBuild(item.root);
          if (builds === 1)
            write(item.root, "src/App.js", "export const shadow = true;\n");
        },
      }),
    ).rejects.toThrow("ignored build input is forbidden: src/App.js");
    expect(builds).toBe(1);
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it("rejects ignored build inputs created by the second build", async () => {
    const item = fixture();
    writeFileSync(join(item.root, ".git", "info", "exclude"), "src/App.js\n", {
      flag: "a",
    });
    let builds = 0;
    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
          writeBuild(item.root);
          if (builds === 2)
            write(item.root, "src/App.js", "export const shadow = true;\n");
        },
      }),
    ).rejects.toThrow("ignored build input is forbidden: src/App.js");
    expect(builds).toBe(2);
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it("rejects ambient Git repository authority before any build", async () => {
    const item = fixture();
    const attacker = fixture();
    const expectedConfigSha256 = reviewedConfigSha256(item.root);
    const originalGitDir = process.env.GIT_DIR;
    const originalGitWorkTree = process.env.GIT_WORK_TREE;
    let builds = 0;
    process.env.GIT_DIR = join(attacker.root, ".git");
    process.env.GIT_WORK_TREE = attacker.root;
    try {
      await expect(
        prepareReleaseForTest(
          {
            repoRoot: item.root,
            stagingDir: item.staging,
            evidenceDir: item.evidence,
          },
          {
            moduleRoot: item.root,
            expectedConfigSha256,
            verifyWrangler: async () => "4.118.0",
            runBuild: async () => {
              builds += 1;
              writeBuild(item.root);
            },
          },
        ),
      ).rejects.toThrow("Git must not inherit ambient repository authority");
    } finally {
      if (originalGitDir === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = originalGitDir;
      if (originalGitWorkTree === undefined) delete process.env.GIT_WORK_TREE;
      else process.env.GIT_WORK_TREE = originalGitWorkTree;
    }
    expect(builds).toBe(0);
  });

  it.each([
    "GIT_INDEX_FILE",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
    "GIT_COMMON_DIR",
    "GIT_CONFIG_COUNT",
    "GIT_EXEC_PATH",
  ])("rejects ambient Git authority %s", async (name) => {
    const item = fixture();
    const expectedConfigSha256 = reviewedConfigSha256(item.root);
    const original = process.env[name];
    process.env[name] = "unreviewed";
    try {
      await expect(
        prepareReleaseForTest(
          {
            repoRoot: item.root,
            stagingDir: item.staging,
            evidenceDir: item.evidence,
          },
          {
            moduleRoot: item.root,
            expectedConfigSha256,
            verifyWrangler: async () => "4.118.0",
            runBuild: item.runBuild,
          },
        ),
      ).rejects.toThrow("Git must not inherit ambient repository authority");
    } finally {
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  });

  it("does not resolve Git through ambient PATH", async () => {
    const item = fixture();
    const expectedConfigSha256 = reviewedConfigSha256(item.root);
    const emptyPath = mkdtempSync(join(tmpdir(), "conan-empty-path-"));
    roots.push(emptyPath);
    const originalPath = process.env.PATH;
    process.env.PATH = emptyPath;
    try {
      await expect(
        prepareReleaseForTest(
          {
            repoRoot: item.root,
            stagingDir: item.staging,
            evidenceDir: item.evidence,
          },
          {
            moduleRoot: item.root,
            expectedConfigSha256,
            verifyWrangler: async () => "4.118.0",
            runBuild: item.runBuild,
            runCommand: async (command) => {
              if (command.args.at(-1) === "--version")
                return { stdout: "11.12.1\n", stderr: "" };
              throw new Error("unexpected build command");
            },
          },
        ),
      ).resolves.toMatchObject({ manifests: expect.any(Object) });
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
    }
  });

  it("accepts only exact LF-to-CRLF normalization of tracked UTF-8 text", async () => {
    const accepted = fixture();
    const source = join(accepted.root, "src", "payload.ts");
    writeFileSync(source, readFileSync(source, "utf8").replace(/\n/g, "\r\n"));
    await expect(prepare(accepted)).resolves.toMatchObject({
      manifests: expect.any(Object),
    });

    for (const bytes of [
      Buffer.from("export const payload = 'reviewed';\r", "utf8"),
      Buffer.concat([
        Buffer.from("export const payload = 'reviewed';\n", "utf8"),
        Buffer.from([0xff]),
      ]),
    ]) {
      const rejected = fixture();
      writeFileSync(join(rejected.root, "src", "payload.ts"), bytes);
      await expect(prepare(rejected)).rejects.toThrow(
        "tracked file differs from HEAD: src/payload.ts",
      );
    }
  });

  it("rejects ignored src/App.js shadow inputs", async () => {
    const item = fixture();
    write(item.root, "src/App.tsx", "export const app = 'reviewed';\n");
    commit(item.root, "add reviewed app source");
    writeFileSync(join(item.root, ".git", "info", "exclude"), "src/App.js\n", {
      flag: "a",
    });
    write(item.root, "src/App.js", "export const app = 'shadow';\n");
    await expect(prepare(item)).rejects.toThrow(
      "ignored build input is forbidden: src/App.js",
    );
  });

  it("rejects ignored Vite environment inputs", async () => {
    const item = fixture();
    writeFileSync(
      join(item.root, ".git", "info", "exclude"),
      ".env.production\n",
      {
        flag: "a",
      },
    );
    write(item.root, ".env.production", "VITE_SHADOW=1\n");
    await expect(prepare(item)).rejects.toThrow(
      "ignored build input is forbidden: .env.production",
    );
  });

  it("rejects project npm configuration even when tracked", async () => {
    const item = fixture();
    write(item.root, ".npmrc", "script-shell=unreviewed\n");
    commit(item.root, "add npm config");
    await expect(prepare(item)).rejects.toThrow("project .npmrc is forbidden");
  });

  it("rejects ambient NPM_CONFIG authority before building", async () => {
    const item = fixture();
    const original = process.env.NPM_CONFIG_SCRIPT_SHELL;
    process.env.NPM_CONFIG_SCRIPT_SHELL = "unreviewed";
    try {
      await expect(prepare(item)).rejects.toThrow(
        "npm must not inherit ambient NPM_CONFIG authority",
      );
    } finally {
      if (original === undefined) delete process.env.NPM_CONFIG_SCRIPT_SHELL;
      else process.env.NPM_CONFIG_SCRIPT_SHELL = original;
    }
  });

  it("rejects tracked Git symlink entries before snapshot validation", async () => {
    const item = fixture();
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: item.root,
      encoding: "utf8",
      input: "unreviewed-target\n",
    }).trim();
    run(item.root, "git", [
      "update-index",
      "--add",
      "--cacheinfo",
      `120000,${blob},src/tracked-link.ts`,
    ]);
    run(item.root, "git", ["commit", "--quiet", "-m", "add tracked link"]);
    await expect(prepare(item)).rejects.toThrow(
      "tracked symbolic links are forbidden",
    );
  });

  it("rejects local Vite config dependencies before they execute", async () => {
    const item = fixture();
    const sentinel = join(item.root, "config-import-sentinel.txt");
    write(
      item.root,
      "config-side-effect.ts",
      `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(sentinel)}, "executed"); export default {};\n`,
    );
    write(
      item.root,
      "vite.config.ts",
      'import config from "./config-side-effect"; export default config;\n',
    );
    commit(item.root, "malicious local config dependency");
    await expect(prepare(item)).rejects.toThrow(
      "Vite config must not import local executable dependencies",
    );
    expect(existsSync(sentinel)).toBe(false);
  });

  it.each([
    [
      "dynamic import",
      'const config = await import("./config-side-effect"); export default config;',
    ],
    [
      "dynamic import options",
      'const config = await import("./config-side-effect", { with: {} }); export default config;',
    ],
    [
      "CommonJS require",
      'const config = require("./config-side-effect"); export default config;',
    ],
    [
      "file URL import",
      'import config from "file:///unreviewed-config.js"; export default config;',
    ],
  ])(
    "rejects %s Vite config dependencies before loading",
    async (_label, source) => {
      const item = fixture();
      write(item.root, "vite.config.ts", `${source}\n`);
      commit(item.root, "unreviewed config import form");
      await expect(prepare(item)).rejects.toThrow(
        "Vite config must not import local executable dependencies",
      );
    },
  );

  it.each([".env", ".env.local", ".env.production", ".env.production.local"])(
    "rejects Vite environment file %s",
    async (filename) => {
      const item = fixture();
      write(item.root, filename, "VITE_PRIVATE_INPUT=not-reviewed\n");
      commit(item.root, `add ${filename}`);
      await expect(prepare(item)).rejects.toThrow(
        `Vite environment file is forbidden: ${filename}`,
      );
    },
  );

  it.each([
    "VITE_PRIVATE_INPUT",
    "NODE_OPTIONS",
    "NODE_PATH",
    "ESBUILD_BINARY_PATH",
  ])("rejects inherited ambient authority %s", async (key) => {
    const item = fixture();
    const original = process.env[key];
    process.env[key] = "not-reviewed";
    try {
      await expect(prepare(item)).rejects.toThrow(
        "Vite must not inherit ambient environment authority",
      );
    } finally {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
  });

  it("rejects ignored, untracked authority files after the clean snapshot", async () => {
    const item = fixture();
    run(item.root, "git", ["rm", "--cached", "--quiet", "index.html"]);
    run(item.root, "git", [
      "commit",
      "--quiet",
      "-m",
      "remove authority entry",
    ]);
    writeFileSync(join(item.root, ".git", "info", "exclude"), "index.html\n", {
      flag: "a",
    });
    write(item.root, "index.html", "<!doctype html>\n");
    await expect(prepare(item)).rejects.toThrow(
      "ignored build input is forbidden: index.html",
    );
  });

  it("rejects ignored, untracked Vite config dependencies", async () => {
    const item = fixture();
    write(
      item.root,
      "ignored-config-dependency.ts",
      "export const ignored = {};\n",
    );
    writeFileSync(
      join(item.root, ".git", "info", "exclude"),
      "ignored-config-dependency.ts\n",
      { flag: "a" },
    );
    write(
      item.root,
      "vite.config.ts",
      'import { ignored } from "./ignored-config-dependency"; export default ignored;\n',
    );
    run(item.root, "git", ["add", "vite.config.ts"]);
    run(item.root, "git", [
      "commit",
      "--quiet",
      "-m",
      "ignored config dependency",
    ]);
    await expect(prepare(item)).rejects.toThrow(
      "Vite config must not import local executable dependencies",
    );
  });

  it("rejects an assume-unchanged authority file", async () => {
    const item = fixture();
    write(item.root, "package.json", JSON.stringify({ changed: true }));
    run(item.root, "git", [
      "update-index",
      "--assume-unchanged",
      "package.json",
    ]);
    await expect(prepare(item)).rejects.toThrow(
      "Git index contains unsafe tracked-source flags",
    );
  });

  it.each([
    [
      "assume-unchanged",
      ["update-index", "--assume-unchanged", "src/payload.ts"],
    ],
    ["skip-worktree", ["update-index", "--skip-worktree", "src/payload.ts"]],
  ])("rejects a %s flag on any tracked source", async (_label, command) => {
    const item = fixture();
    write(item.root, "src/payload.ts", "export const payload = 'altered';\n");
    run(item.root, "git", command);
    await expect(prepare(item)).rejects.toThrow(
      "Git index contains unsafe tracked-source flags",
    );
  });

  it("rejects a final dirty checkpoint after the second build", async () => {
    const item = fixture();
    let builds = 0;
    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
          writeBuild(item.root);
          if (builds === 2)
            write(item.root, "dirty-after-second.txt", "dirty\n");
        },
      }),
    ).rejects.toThrow("git status is not clean");
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it("fails closed for detached HEAD", async () => {
    const item = fixture();
    run(item.root, "git", ["checkout", "--detach", "--quiet"]);
    await expect(prepare(item)).rejects.toThrow("HEAD is detached");
  });

  it("fails when either clean checkpoint changes during the builds", async () => {
    const item = fixture();
    let builds = 0;
    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
          writeBuild(item.root);
          if (builds === 1) write(item.root, "dirty.txt", "dirty\n");
        },
      }),
    ).rejects.toThrow("git status is not clean");
  });

  it("fails when the two inspected builds differ", async () => {
    const item = fixture();
    let builds = 0;
    await expect(
      prepare({
        ...item,
        runBuild: async () => {
          builds += 1;
          writeBuild(item.root, `export const build = ${builds};\n`);
        },
      }),
    ).rejects.toThrow("build manifests differ");
  });

  it.each([
    [
      "relative staging",
      (item: Fixture) => ({ ...item, stagingDir: "staging" }),
    ],
    [
      "relative evidence",
      (item: Fixture) => ({ ...item, evidenceDir: "evidence" }),
    ],
    [
      "repo-contained staging",
      (item: Fixture) => ({ ...item, stagingDir: join(item.root, "staging") }),
    ],
    [
      "repo-contained evidence",
      (item: Fixture) => ({
        ...item,
        evidenceDir: join(item.root, "evidence"),
      }),
    ],
    [
      "same output directory",
      (item: Fixture) => ({ ...item, evidenceDir: item.staging }),
    ],
  ])("rejects %s paths", async (_label, options) => {
    const item = fixture();
    await expect(prepare(options(item))).rejects.toThrow(
      /private hosted prepare rejected/,
    );
  });

  it("does not reuse existing evidence or staging directories", async () => {
    const item = fixture();
    mkdirSync(item.evidence);
    await expect(prepare(item)).rejects.toThrow(
      "evidence directory must not already exist",
    );
    rmSync(item.evidence, { recursive: true });
    mkdirSync(item.staging);
    await expect(prepare(item)).rejects.toThrow(
      "staging directory must not already exist",
    );
  });

  it("rejects a symlink-shaped lstat result without requiring Windows symlink permission", () => {
    expect(() =>
      assertRegularAuthorityFile(
        { isFile: () => true, isSymbolicLink: () => true },
        "package.json",
      ),
    ).toThrow("authority file is not a regular file: package.json");
  });

  // Windows may deny unprivileged symlink creation; the lstat seam above is mandatory there.
  it.skipIf(process.platform === "win32")(
    "rejects symlink authority files after a clean snapshot",
    async () => {
      const item = fixture();
      const original = join(item.root, "package.real.json");
      write(
        item.root,
        "package.real.json",
        readFileSync(join(item.root, "package.json"), "utf8"),
      );
      writeFileSync(
        join(item.root, ".git", "info", "exclude"),
        "package.real.json\n",
        { flag: "a" },
      );
      rmSync(join(item.root, "package.json"));
      symlinkSync(original, join(item.root, "package.json"), "file");
      run(item.root, "git", [
        "update-index",
        "--assume-unchanged",
        "package.json",
      ]);
      await expect(prepare(item)).rejects.toThrow(
        "authority file is not a regular file: package.json",
      );
      expect(existsSync(item.staging)).toBe(false);
      expect(existsSync(item.evidence)).toBe(false);
    },
  );

  it.each([
    [
      "browser externalization",
      'Module "node:fs" has been externalized for browser compatibility',
    ],
    ["meta build", "npm run build:meta"],
    ["forbidden meta output", "npm run build:meta"],
  ])("rejects %s build output", (label, output) => {
    expect(() => assertAcceptableBuildOutput(output)).toThrow(
      label === "browser externalization"
        ? "browser externalization warning"
        : "build warning",
    );
  });

  it("permits Vite chunk-size warnings", () => {
    expect(() =>
      assertAcceptableBuildOutput(
        "(!) Some chunks are larger than 500 kB after minification.",
      ),
    ).not.toThrow();
  });

  it("accepts only the exact local Wrangler version output", () => {
    expect(assertWranglerVersionOutput("4.118.0\n", "")).toBe("4.118.0");
    expect(() => assertWranglerVersionOutput("wrangler 4.118.0\n", "")).toThrow(
      "local wrangler version differs",
    );
    expect(() => assertWranglerVersionOutput("4.118.0\nextra\n", "")).toThrow(
      "local wrangler version differs",
    );
    expect(() => assertWranglerVersionOutput("4.118.0\n", "warning")).toThrow(
      "local wrangler version differs",
    );
  });

  it.each([
    [
      "credential token",
      'const CLOUDFLARE_API_TOKEN = "Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF";\n',
    ],
    ["private key", "-----BEGIN PRIVATE KEY-----\n"],
    ["source root", 'const sourceRoot = "/private";\n'],
    ["node fs", 'import "node:fs";\n'],
    ["TSV loader", "tsv-loader-fs\n"],
    ["card source", ".claude/specs/cards-data\n"],
  ])("rejects %s markers in the upload closure", async (_label, marker) => {
    const item = fixture();
    await expect(
      prepare({ ...item, runBuild: async () => writeBuild(item.root, marker) }),
    ).rejects.toThrow("forbidden bundle marker");
  });

  it.each([
    'const config = { "CLOUDFLARE_API_TOKEN": "Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF" };',
    'const config = { CF_API_TOKEN: "Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF" };',
    'const config = { "access_token": "Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF" };',
    'const config = { api_token: "Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF" };',
    'x.CLOUDFLARE_API_TOKEN = "Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF";',
    '{\\"CF_API_TOKEN\\":\\"Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF\\"}',
    'const headers = { "Authorization": "Bearer Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF" };',
    'const headers = { Authorization: "Bearer Vb8Qk4mZ1pL7xR2dN9sT6wY3aC5eH0jF" };',
    ".claude/specs/cards-data",
    ".claude\\specs\\cards-data",
    ".claude\\\\specs\\\\cards-data",
  ])("rejects encoded secret or source marker %s", async (marker) => {
    const item = fixture();
    await expect(
      prepare({ ...item, runBuild: async () => writeBuild(item.root, marker) }),
    ).rejects.toThrow("forbidden bundle marker");
  });

  it("allows benign runtime token identifiers in the upload closure", async () => {
    const item = fixture();
    await expect(
      prepare({
        ...item,
        runBuild: async () =>
          writeBuild(item.root, "const token = matchState.turnToken;\n"),
      }),
    ).resolves.toMatchObject({ manifests: expect.any(Object) });
  });

  it("uses the fixed default build command through the injected no-shell runner", async () => {
    const item = fixture();
    const commands: Array<{
      file: string;
      args: string[];
      cwd?: string;
      env?: NodeJS.ProcessEnv;
    }> = [];
    await expect(
      prepare(
        { ...item, runBuild: undefined },
        {
          runCommand: async (command) => {
            commands.push(command);
            if (command.args.at(-1) === "--version") {
              expect(command.file).toBe(process.execPath);
              expect(command.args).toHaveLength(2);
              expect(command.args[1]).toBe("--version");
              expect(command.cwd).toBe(item.root);
              expect(command.env?.NPM_CONFIG_USERCONFIG).toBe(
                resolve(item.root, ".private-hosted-empty-user-npmrc"),
              );
              return { stdout: "11.12.1\n", stderr: "" };
            }
            expect(command.file).toBe(process.execPath);
            expect(command.cwd).toBe(item.root);
            expect(command.args.slice(-6)).toEqual([
              "run",
              "build",
              "--",
              "--manifest",
              "--config",
              "vite.config.ts",
            ]);
            expect(command.env?.NPM_CONFIG_GLOBALCONFIG).toBe(
              resolve(item.root, ".private-hosted-empty-global-npmrc"),
            );
            expect(command.env?.NPM_CONFIG_SCRIPT_SHELL).toBeTruthy();
            expect(command.env?.NPM_CONFIG_IGNORE_SCRIPTS).toBe("false");
            writeBuild(item.root);
            return {
              stdout:
                "(!) Some chunks are larger than 500 kB after minification.",
              stderr: "",
            };
          },
        },
      ),
    ).resolves.toMatchObject({ manifests: expect.any(Object) });
    expect(
      commands.filter(
        (command) =>
          command.args.slice(-6).join(" ") ===
          "run build -- --manifest --config vite.config.ts",
      ),
    ).toHaveLength(2);
    expect(commands.every((command) => !("shell" in command))).toBe(true);
  });

  it("checks the fixed Wrangler executable with the sanitized child environment", async () => {
    const item = fixture();
    write(item.root, ".gitignore", "dist/\nnode_modules/\n");
    write(
      item.root,
      "package-lock.json",
      `${JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": { devDependencies: { wrangler: "4.118.0" } },
          "node_modules/wrangler": { version: "4.118.0" },
        },
      })}\n`,
    );
    commit(item.root, "pin wrangler fixture");
    write(
      item.root,
      "node_modules/wrangler/bin/wrangler.js",
      "throw new Error('the injected runner must own execution');\n",
    );
    const commands: PrivateCommand[] = [];

    await expect(
      prepare(
        { ...item, runBuild: undefined },
        {
          verifyWrangler: undefined,
          runCommand: async (command) => {
            commands.push(command);
            if (command.args.at(-1) !== "--version") {
              writeBuild(item.root);
              return { stdout: "", stderr: "" };
            }
            if (command.args[0]?.endsWith("wrangler.js"))
              return { stdout: "4.118.0\n", stderr: "" };
            return { stdout: "11.12.1\n", stderr: "" };
          },
        },
      ),
    ).resolves.toMatchObject({ manifests: expect.any(Object) });

    const wrangler = commands.find((command) =>
      command.args[0]?.endsWith("wrangler.js"),
    );
    expect(wrangler).toMatchObject({
      file: process.execPath,
      args: [expect.stringMatching(/wrangler\.js$/), "--version"],
      cwd: item.root,
    });
    expect(wrangler?.env?.NODE_OPTIONS).toBeUndefined();
    expect(wrangler?.env?.NPM_CONFIG_USERCONFIG).toBe(
      resolve(item.root, ".private-hosted-empty-user-npmrc"),
    );
  });

  it("fails closed when the default runner exits nonzero", async () => {
    const item = fixture();
    await expect(
      prepare(
        { ...item, runBuild: undefined },
        {
          runCommand: async (command) => {
            if (command.args.at(-1) === "--version")
              return { stdout: "11.12.1\n", stderr: "" };
            throw new Error("nonzero");
          },
        },
      ),
    ).rejects.toThrow(
      "npm run build -- --manifest --config vite.config.ts failed",
    );
    expect(existsSync(item.staging)).toBe(false);
    expect(existsSync(item.evidence)).toBe(false);
  });

  it("keeps prepare.ts non-operational when invoked as a direct CLI", () => {
    const root = process.cwd();
    const outputRoot = mkdtempSync(join(tmpdir(), "conan-direct-cli-"));
    roots.push(outputRoot);
    const staging = join(outputRoot, "staging");
    const evidence = join(outputRoot, "evidence");
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules", "tsx", "dist", "cli.mjs"),
        resolve(root, "scripts", "private-hosted", "prepare.ts"),
        "--staging",
        staging,
        "--evidence",
        evidence,
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
    expect(existsSync(staging)).toBe(false);
    expect(existsSync(evidence)).toBe(false);
  });

  it("does not expose release preparation through an ambient npm lifecycle shell", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["private-hosted:prepare"]).toBeUndefined();
  });

  it.runIf(process.platform === "win32")(
    "launches preparation through a fixed PowerShell boundary before Node options apply",
    () => {
      const root = process.cwd();
      const outputRoot = mkdtempSync(
        join(tmpdir(), "conan-private-hosted-launcher-"),
      );
      roots.push(outputRoot);
      const sentinel = join(outputRoot, "node-options-executed.txt");
      const preload = join(outputRoot, "preload.cjs");
      writeFileSync(
        preload,
        `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "executed");\n`,
      );
      const result = spawnSync(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          resolve(root, "scripts", "private-hosted", "prepare.ps1"),
          "--not-a-real-secret=do-not-echo",
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            NODE_OPTIONS: `--require ${JSON.stringify(preload)}`,
            NPM_CONFIG_SCRIPT_SHELL: "hostile-shell",
          },
        },
      );
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toContain("unknown argument");
      expect(`${result.stdout}${result.stderr}`).not.toContain("do-not-echo");
      expect(existsSync(sentinel)).toBe(false);
    },
  );

  it.runIf(process.platform === "win32")(
    "clears esbuild authority before loading the TypeScript entry point",
    () => {
      const root = process.cwd();
      const outputRoot = mkdtempSync(
        join(tmpdir(), "conan-private-hosted-esbuild-boundary-"),
      );
      roots.push(outputRoot);
      const fixtureRoot = join(outputRoot, "fixture");
      const scripts = join(fixtureRoot, "scripts", "private-hosted");
      const success = join(outputRoot, "launcher-success.txt");
      mkdirSync(scripts, { recursive: true });
      writeFileSync(
        join(fixtureRoot, "package.json"),
        `${JSON.stringify({ type: "module" })}\n`,
      );
      writeFileSync(
        join(scripts, "prepare.ps1"),
        readFileSync(resolve(root, "scripts", "private-hosted", "prepare.ps1")),
      );
      writeFileSync(
        join(scripts, "prepare.ts"),
        `import { writeFileSync } from "node:fs";\n` +
          `enum ForceTransform { Yes = "yes" }\n` +
          `export async function runPrepareCli(args: readonly string[]): Promise<void> {\n` +
          `  writeFileSync(args[0]!, ForceTransform.Yes + ":" + (process.env.ESBUILD_BINARY_PATH ?? "cleared") + ":" + process.env.TSX_DISABLE_CACHE);\n` +
          `}\n`,
      );
      symlinkSync(
        resolve(root, "node_modules"),
        join(fixtureRoot, "node_modules"),
        "junction",
      );
      const esbuild = resolve(
        root,
        "node_modules",
        "@esbuild",
        "win32-x64",
        "esbuild.exe",
      );
      expect(existsSync(esbuild)).toBe(true);
      const result = spawnSync(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          join(scripts, "prepare.ps1"),
          success,
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            ESBUILD_BINARY_PATH: esbuild,
          },
        },
      );
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status, output).toBe(0);
      expect(output).toBe("");
      expect(readFileSync(success, "utf8")).toBe("yes:cleared:1");
    },
  );

  it.runIf(process.platform === "win32")(
    "ignores caller tsconfig paths before bootstrap and cleans launcher temp",
    () => {
      const root = process.cwd();
      const outputRoot = mkdtempSync(
        join(tmpdir(), "conan-private-hosted-caller-tsconfig-"),
      );
      roots.push(outputRoot);
      const fixtureRoot = join(outputRoot, "fixture");
      const callerRoot = join(outputRoot, "caller");
      const scripts = join(fixtureRoot, "scripts", "private-hosted");
      const success = join(outputRoot, "launcher-success.txt");
      const sentinel = join(outputRoot, "caller-tsconfig-executed.txt");
      const prebootstrap = join(outputRoot, "prebootstrap.json");
      mkdirSync(scripts, { recursive: true });
      mkdirSync(callerRoot, { recursive: true });
      writeFileSync(
        join(callerRoot, "package.json"),
        `${JSON.stringify({ type: "module" })}\n`,
      );
      writeFileSync(
        join(fixtureRoot, "package.json"),
        `${JSON.stringify({ type: "module" })}\n`,
      );
      writeFileSync(
        join(scripts, "prepare.ps1"),
        readFileSync(resolve(root, "scripts", "private-hosted", "prepare.ps1")),
      );
      writeFileSync(
        join(scripts, "prepare.ts"),
        `import { writeFileSync } from "node:fs";\n` +
          `import { defineConfig } from "vite";\n` +
          `export async function runPrepareCli(args: readonly string[]): Promise<void> {\n` +
          `  const config = defineConfig({ marker: "trusted" }) as { marker: string };\n` +
          `  writeFileSync(args[0]!, config.marker);\n` +
          `}\n`,
      );
      const fixtureModules = join(fixtureRoot, "node_modules");
      const fixtureTsxDist = join(fixtureModules, "tsx", "dist");
      mkdirSync(fixtureTsxDist, { recursive: true });
      symlinkSync(
        resolve(root, "node_modules", "vite"),
        join(fixtureModules, "vite"),
        "junction",
      );
      writeFileSync(
        join(fixtureTsxDist, "loader.mjs"),
        `import { readFileSync, writeFileSync } from "node:fs";\n` +
          `const tsconfigPath = process.env.TSX_TSCONFIG_PATH;\n` +
          `writeFileSync(${JSON.stringify(prebootstrap)}, JSON.stringify({\n` +
          `  cwd: process.cwd(),\n` +
          `  tsconfigPath,\n` +
          `  tsconfig: tsconfigPath ? readFileSync(tsconfigPath, "utf8") : null,\n` +
          `}));\n` +
          `await import(${JSON.stringify(
            pathToFileURL(
              resolve(root, "node_modules", "tsx", "dist", "loader.mjs"),
            ).href,
          )});\n`,
      );
      writeFileSync(
        join(callerRoot, "tsconfig.json"),
        `${JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            paths: { vite: ["./poison.ts"] },
          },
        })}\n`,
      );
      writeFileSync(
        join(callerRoot, "poison.ts"),
        `import { writeFileSync } from "node:fs";\n` +
          `writeFileSync(${JSON.stringify(sentinel)}, "executed");\n` +
          `export const defineConfig = () => ({ marker: "poisoned" });\n`,
      );
      const sharedTemp = join(process.env.LOCALAPPDATA!, "Temp");
      const launcherTempPrefix = "conan-private-hosted-launcher-temp-";
      const privateTempBefore = readdirSync(sharedTemp)
        .filter((name) => name.startsWith(launcherTempPrefix))
        .sort();
      const result = spawnSync(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          join(scripts, "prepare.ps1"),
          success,
        ],
        { cwd: callerRoot, encoding: "utf8", env: { ...process.env } },
      );
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status, output).toBe(0);
      expect(output).toBe("");
      expect(readFileSync(success, "utf8")).toBe("trusted");
      expect(existsSync(sentinel)).toBe(false);
      const prebootstrapState = JSON.parse(
        readFileSync(prebootstrap, "utf8"),
      ) as {
        cwd: string;
        tsconfigPath?: string;
        tsconfig: string | null;
      };
      expect(resolve(prebootstrapState.cwd)).toBe(resolve(fixtureRoot));
      expect(prebootstrapState.tsconfig).toBe("{}\n");
      const privateTempName = prebootstrapState
        .tsconfigPath!.split(/[/\\]/)
        .at(-2)!;
      expect(resolve(dirname(prebootstrapState.tsconfigPath!))).toBe(
        resolve(sharedTemp, privateTempName),
      );
      expect(privateTempName).toMatch(
        new RegExp(`^${launcherTempPrefix}[0-9a-f]{32}$`),
      );
      expect(existsSync(dirname(prebootstrapState.tsconfigPath!))).toBe(false);
      expect(
        readdirSync(sharedTemp)
          .filter((name) => name.startsWith(launcherTempPrefix))
          .sort(),
      ).toEqual(privateTempBefore);
    },
  );

  it.runIf(process.platform === "win32")(
    "ignores a poisoned persistent tsx transform cache before bootstrap",
    () => {
      const root = process.cwd();
      const outputRoot = mkdtempSync(
        join(tmpdir(), "conan-private-hosted-tsx-cache-"),
      );
      roots.push(outputRoot);
      const fixtureRoot = join(outputRoot, "fixture");
      const scripts = join(fixtureRoot, "scripts", "private-hosted");
      const primeMarker = join(outputRoot, "prime.txt");
      const releaseMarker = join(outputRoot, "release.txt");
      const poisonMarker = join(outputRoot, "poison.txt");
      mkdirSync(scripts, { recursive: true });
      writeFileSync(
        join(fixtureRoot, "package.json"),
        `${JSON.stringify({ type: "module" })}\n`,
      );
      writeFileSync(
        join(scripts, "prepare.ps1"),
        readFileSync(resolve(root, "scripts", "private-hosted", "prepare.ps1")),
      );
      const entry = join(scripts, "prepare.ts");
      writeFileSync(
        entry,
        `import { writeFileSync } from "node:fs";\n` +
          `enum Marker { Legitimate = "legitimate" }\n` +
          `export async function runPrepareCli(args: readonly string[]): Promise<void> {\n` +
          `  writeFileSync(args[0]!, Marker.Legitimate);\n` +
          `}\n`,
      );
      symlinkSync(
        resolve(root, "node_modules"),
        join(fixtureRoot, "node_modules"),
        "junction",
      );
      const sharedTemp = join(process.env.LOCALAPPDATA!, "Temp");
      const privateTempBefore = readdirSync(sharedTemp)
        .filter((name) =>
          name.startsWith("conan-private-hosted-launcher-temp-"),
        )
        .sort();
      const cacheDir = join(sharedTemp, `tsx-${userInfo().username}`);
      mkdirSync(cacheDir, { recursive: true });
      const before = new Set(readdirSync(cacheDir));
      const loader = pathToFileURL(
        resolve(root, "node_modules", "tsx", "dist", "loader.mjs"),
      ).href;
      const bootstrap = (marker: string) =>
        `import(${JSON.stringify(pathToFileURL(entry).href)})` +
        `.then(({ runPrepareCli }) => runPrepareCli([${JSON.stringify(marker)}]))` +
        `.catch((error) => { console.error(error); process.exitCode = 1; });`;
      const primeEnvironment = {
        PATH: [
          dirname(process.execPath),
          "C:\\Program Files\\Git\\cmd",
          "C:\\Windows\\System32",
        ].join(";"),
        PATHEXT: ".COM;.EXE;.BAT;.CMD",
        SystemRoot: "C:\\Windows",
        SYSTEMROOT: "C:\\Windows",
        ComSpec: "C:\\Windows\\System32\\cmd.exe",
        COMSPEC: "C:\\Windows\\System32\\cmd.exe",
        TEMP: sharedTemp,
        TMP: sharedTemp,
      };
      const prime = spawnSync(
        process.execPath,
        ["--import", loader, "--eval", bootstrap(primeMarker)],
        {
          cwd: fixtureRoot,
          encoding: "utf8",
          env: primeEnvironment,
        },
      );
      const created = readdirSync(cacheDir).filter((name) => !before.has(name));
      externalFiles.push(...created.map((name) => join(cacheDir, name)));
      expect(prime.status, `${prime.stdout}${prime.stderr}`).toBe(0);
      expect(readFileSync(primeMarker, "utf8")).toBe("legitimate");
      const cacheFile = created
        .map((name) => join(cacheDir, name))
        .find((path) => {
          try {
            const cached = JSON.parse(readFileSync(path, "utf8")) as {
              code?: unknown;
            };
            return (
              typeof cached.code === "string" &&
              cached.code.includes("legitimate")
            );
          } catch {
            return false;
          }
        });
      expect(cacheFile).toBeTruthy();
      const cached = JSON.parse(readFileSync(cacheFile!, "utf8")) as {
        code: string;
        map?: unknown;
      };
      cached.code =
        `import { writeFileSync } from "node:fs";\n` +
        `writeFileSync(${JSON.stringify(poisonMarker)}, "executed");\n` +
        `export async function runPrepareCli(args) { writeFileSync(args[0], "poisoned"); }\n`;
      writeFileSync(cacheFile!, JSON.stringify(cached));
      const vulnerableControl = spawnSync(
        process.execPath,
        ["--import", loader, "--eval", bootstrap(releaseMarker)],
        { cwd: fixtureRoot, encoding: "utf8", env: primeEnvironment },
      );
      expect(
        vulnerableControl.status,
        `${vulnerableControl.stdout}${vulnerableControl.stderr}`,
      ).toBe(0);
      expect(readFileSync(releaseMarker, "utf8")).toBe("poisoned");
      expect(readFileSync(poisonMarker, "utf8")).toBe("executed");
      rmSync(releaseMarker, { force: true });
      rmSync(poisonMarker, { force: true });
      const result = spawnSync(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          join(scripts, "prepare.ps1"),
          releaseMarker,
        ],
        { cwd: root, encoding: "utf8", env: { ...process.env } },
      );
      expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
      expect(`${result.stdout}${result.stderr}`).toBe("");
      expect(readFileSync(releaseMarker, "utf8")).toBe("legitimate");
      expect(existsSync(poisonMarker)).toBe(false);
      expect(
        readdirSync(sharedTemp)
          .filter((name) =>
            name.startsWith("conan-private-hosted-launcher-temp-"),
          )
          .sort(),
      ).toEqual(privateTempBefore);
    },
  );

  it.runIf(process.platform === "win32")(
    "does not invoke caller-defined PowerShell command shadows",
    () => {
      const root = process.cwd();
      const outputRoot = mkdtempSync(
        join(tmpdir(), "conan-private-hosted-powershell-shadow-"),
      );
      roots.push(outputRoot);
      const sentinel = join(outputRoot, "node-options-executed.txt");
      const preload = join(outputRoot, "preload.cjs");
      writeFileSync(
        preload,
        `require("node:fs").writeFileSync(${JSON.stringify(sentinel)}, "executed");\n`,
      );
      const command = `
        function global:Remove-Item { throw "shadowed Remove-Item" }
        function global:Get-ChildItem { throw "shadowed Get-ChildItem" }
        function global:Where-Object { throw "shadowed Where-Object" }
        function global:ForEach-Object { throw "shadowed ForEach-Object" }
        function global:Join-Path { throw "shadowed Join-Path" }
        function global:Get-Item { throw "shadowed Get-Item" }
        function global:Set-Location { throw "shadowed Set-Location" }
        & $env:PREPARE_SCRIPT "--not-a-real-secret=do-not-echo"
        exit $LASTEXITCODE
      `;
      const result = spawnSync(
        "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          command,
        ],
        {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            PREPARE_SCRIPT: resolve(
              root,
              "scripts",
              "private-hosted",
              "prepare.ps1",
            ),
            NODE_OPTIONS: `--require ${JSON.stringify(preload)}`,
          },
        },
      );
      const output = `${result.stdout}${result.stderr}`;
      expect(result.status).not.toBe(0);
      expect(output).toContain("unknown argument");
      expect(output).not.toContain("do-not-echo");
      expect(output).not.toContain("shadowed");
      expect(existsSync(sentinel)).toBe(false);
    },
  );

  it("probes npm config with the sanitized child environment", async () => {
    const item = fixture();
    const environment = await sanitizedNpmEnvironment(item.root);
    expect(environment.PATH).not.toBe(process.env.PATH);
    expect(environment.PATH).not.toContain("unreviewed");
    expect(
      Object.keys(environment).filter((name) => /^GIT_/i.test(name)),
    ).toEqual([]);
    const output = execFileSync(
      process.execPath,
      [
        resolve(
          dirname(process.execPath),
          "node_modules",
          "npm",
          "bin",
          "npm-cli.js",
        ),
        "config",
        "get",
        "userconfig",
      ],
      { cwd: item.root, env: environment, encoding: "utf8" },
    );
    expect(output.trim()).toBe(
      resolve(item.root, ".private-hosted-empty-user-npmrc"),
    );
  });

  it("importing the CLI module has no preparation side effect", () => {
    const root = process.cwd();
    const result = spawnSync(
      process.execPath,
      [
        resolve(root, "node_modules", "tsx", "dist", "cli.mjs"),
        "-e",
        `import(${JSON.stringify(pathToFileURL(resolve(root, "scripts", "private-hosted", "prepare.ts")).href)})`,
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("canonicalizes a lexical repository alias before verifying the module root", async () => {
    const item = fixture();
    await expect(
      prepareReleaseForTest(
        {
          repoRoot: join(item.root, "..", item.root.split(/[/\\]/).at(-1)!),
          stagingDir: item.stagingDir,
          evidenceDir: item.evidenceDir,
        },
        {
          moduleRoot: item.root,
          expectedConfigSha256: createHash("sha256")
            .update(
              run(item.root, "git", [
                "cat-file",
                "blob",
                "HEAD:vite.config.ts",
              ]),
            )
            .digest("hex"),
          verifyWrangler: async () => "4.118.0",
          runBuild: item.runBuild,
          runCommand: async (command) => {
            if (command.args.at(-1) === "--version") {
              return { stdout: "11.12.1\n", stderr: "" };
            }
            throw new Error(
              `unexpected command: ${command.file} ${command.args.join(" ")}`,
            );
          },
        },
      ),
    ).resolves.toMatchObject({ manifests: expect.any(Object) });
  });

  it("does not publish final evidence after partial release metadata writing fails", async () => {
    const item = fixture();
    await expect(
      prepare(item, {
        writeEvidenceFile: async (path, data) => {
          writeFileSync(path, data, { flag: "wx" });
          if (path.endsWith("release-metadata.json"))
            throw new Error("write blocked");
        },
      }),
    ).rejects.toThrow("write blocked");
    expect(existsSync(item.evidence)).toBe(false);
    expect(
      readdirSync(dirname(item.evidence)).some((entry) =>
        entry.startsWith(`.${item.evidence.split(/[/\\]/).at(-1)}.tmp-`),
      ),
    ).toBe(true);
  });

  it("parses only complete absolute CLI arguments", () => {
    const staging = resolve(tmpdir(), "private-hosted-cli-staging");
    const evidence = resolve(tmpdir(), "private-hosted-cli-evidence");
    expect(
      parsePrepareArgs(["--staging", staging, "--evidence", evidence]),
    ).toEqual({ stagingDir: staging, evidenceDir: evidence });
    for (const args of [
      [],
      ["--staging", staging],
      ["--evidence", evidence],
      ["--staging", "relative", "--evidence", evidence],
      ["--staging", staging, "--evidence", evidence, "--unknown"],
      ["--staging", staging, "--staging", evidence, "--evidence", evidence],
    ])
      expect(() => parsePrepareArgs(args)).toThrow(
        /private hosted prepare rejected/,
      );
  });
});
