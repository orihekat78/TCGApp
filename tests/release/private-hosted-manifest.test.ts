import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  inspectBuild,
  stageBuild,
} from "../../scripts/private-hosted/manifest.ts";

const roots: string[] = [];

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "conan-private-hosted-dist-"));
  roots.push(root);
  mkdirSync(join(root, ".vite"), { recursive: true });
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), "<!doctype html>\n");
  writeFileSync(join(root, "favicon.svg"), "<svg/>\n");
  writeFileSync(join(root, "_headers"), "/*\n");
  writeFileSync(join(root, "assets", "app.js"), 'import "./app.css";\n');
  writeFileSync(join(root, "assets", "app.css"), "body {}\n");
  writeFileSync(
    join(root, ".vite", "manifest.json"),
    JSON.stringify({
      "index.html": {
        file: "assets/app.js",
        isEntry: true,
        css: ["assets/app.css"],
      },
    }),
  );
  return root;
}

function write(root: string, path: string, contents = "x\n"): void {
  const target = join(root, path);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, contents);
}

function staging(): string {
  const parent = mkdtempSync(join(tmpdir(), "conan-private-hosted-stage-"));
  roots.push(parent);
  return join(parent, "payload");
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("private hosted build manifest", () => {
  it("derives sorted upload and response manifests from the Vite root closure", async () => {
    const dist = fixture();

    await expect(inspectBuild(dist)).resolves.toEqual({
      schemaVersion: 1,
      upload: [
        {
          path: "/_headers",
          bytes: 3,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        {
          path: "/assets/app.css",
          bytes: 8,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        {
          path: "/assets/app.js",
          bytes: 20,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        {
          path: "/favicon.svg",
          bytes: 7,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        {
          path: "/index.html",
          bytes: 16,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
      response: [
        {
          path: "/assets/app.css",
          bytes: 8,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        {
          path: "/assets/app.js",
          bytes: 20,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        {
          path: "/favicon.svg",
          bytes: 7,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
        {
          path: "/index.html",
          bytes: 16,
          sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
    });
  });

  it("follows imports, dynamic imports, CSS, and assets transitively", async () => {
    const dist = fixture();
    write(dist, "assets/imported.js", "export {};\n");
    write(dist, "assets/dynamic.js", "export {};\n");
    write(dist, "assets/asset.js", "export {};\n");
    write(dist, "assets/imported.css", "main {}\n");
    write(
      dist,
      ".vite/manifest.json",
      JSON.stringify({
        "index.html": {
          file: "assets/app.js",
          isEntry: true,
          imports: ["assets/imported.js"],
          dynamicImports: ["assets/dynamic.js"],
          css: ["assets/app.css"],
        },
        "assets/imported.js": {
          file: "assets/imported.js",
          css: ["assets/imported.css"],
          assets: ["assets/asset.js"],
        },
        "assets/dynamic.js": { file: "assets/dynamic.js" },
      }),
    );

    const manifests = await inspectBuild(dist);
    expect(manifests.upload.map((entry) => entry.path)).toEqual([
      "/_headers",
      "/assets/app.css",
      "/assets/app.js",
      "/assets/asset.js",
      "/assets/dynamic.js",
      "/assets/imported.css",
      "/assets/imported.js",
      "/favicon.svg",
      "/index.html",
    ]);
    expect(manifests.response.map((entry) => entry.path)).not.toContain(
      "/_headers",
    );
  });

  it("includes the manifest-referenced hashed brand logo", async () => {
    const dist = fixture();
    const logo = "assets/detective-conan-logo-AbC123_-.png";
    write(dist, logo, "brand-logo");
    write(
      dist,
      ".vite/manifest.json",
      JSON.stringify({
        "index.html": {
          file: "assets/app.js",
          isEntry: true,
          css: ["assets/app.css"],
          assets: [logo],
        },
        "src/assets/detective-conan-logo.png": { file: logo },
      }),
    );

    const manifests = await inspectBuild(dist);
    expect(manifests.upload.map((entry) => entry.path)).toContain(`/${logo}`);
  });

  it.each([
    ["source map", "assets/app.js.map"],
    ["environment file", ".env"],
    ["private key", "secrets/private.pem"],
    ["source file", "assets/source.ts"],
    ["png", "assets/card.png"],
    ["jpg", "assets/card.jpg"],
    ["webp", "assets/card.webp"],
    ["Pages worker", "_worker.js"],
    ["Pages functions", "functions/handler.js"],
    ["Pages routes", "_routes.json"],
    ["redirects", "_redirects"],
    ["orphan JavaScript", "assets/orphan.js"],
    ["orphan CSS", "assets/orphan.css"],
    ["orphan entry", "assets/entry.js"],
    ["font asset", "assets/text.woff2"],
  ])("rejects %s", async (_label, path) => {
    const dist = fixture();
    write(dist, path);
    await expect(inspectBuild(dist)).rejects.toThrow();
  });

  it("rejects an empty Pages functions directory", async () => {
    const dist = fixture();
    mkdirSync(join(dist, "functions"));
    await expect(inspectBuild(dist)).rejects.toThrow();
  });

  it("rejects a symlink even when it targets a permitted file", async () => {
    const dist = fixture();
    symlinkSync(
      join(dist, "assets"),
      join(dist, "assets", "linked"),
      "junction",
    );
    await expect(inspectBuild(dist)).rejects.toThrow();
  });

  it("rejects invalid manifest references and a root closure that reaches an asset", async () => {
    const dist = fixture();
    write(dist, "assets/extra.svg", "<svg/>\n");
    write(
      dist,
      ".vite/manifest.json",
      JSON.stringify({
        "index.html": {
          file: "assets/app.js",
          isEntry: true,
          assets: ["assets/extra.svg"],
        },
      }),
    );
    await expect(inspectBuild(dist)).rejects.toThrow();
  });

  it("rejects an unreferenced Vite entry and its file", async () => {
    const dist = fixture();
    write(dist, "assets/entry.js", "export {};\n");
    write(
      dist,
      ".vite/manifest.json",
      JSON.stringify({
        "index.html": {
          file: "assets/app.js",
          isEntry: true,
          css: ["assets/app.css"],
        },
        "assets/entry.js": { file: "assets/entry.js", isEntry: true },
      }),
    );
    await expect(inspectBuild(dist)).rejects.toThrow();
  });

  it("rejects an unvisited manifest key that reuses a reachable file", async () => {
    const dist = fixture();
    write(
      dist,
      ".vite/manifest.json",
      JSON.stringify({
        "index.html": {
          file: "assets/app.js",
          isEntry: true,
          css: ["assets/app.css"],
        },
        hidden: { file: "assets/app.js", isEntry: true },
      }),
    );
    await expect(inspectBuild(dist)).rejects.toThrow(
      "unreachable manifest entry",
    );
  });

  it("rejects files beyond the Pages size limit", async () => {
    const sizeDist = fixture();
    write(sizeDist, "assets/app.js", "x".repeat(25 * 1024 * 1024 + 1));
    await expect(inspectBuild(sizeDist)).rejects.toThrow();
  });

  it("rejects 20,001 expected uploads before creating staging", async () => {
    const dist = fixture();
    const expected = await inspectBuild(dist);
    const oversized = structuredClone(expected);
    oversized.upload = Array.from({ length: 20_001 }, (_, index) => ({
      path: `/assets/${index}.js`,
      bytes: 0,
      sha256: "0".repeat(64),
    })).sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
    await expect(stageBuild(dist, staging(), oversized)).rejects.toThrow(
      "file count exceeds 20,000",
    );
  });

  it("copies only inspected upload bytes to a new absolute repo-external staging directory", async () => {
    const dist = fixture();
    const expected = await inspectBuild(dist);
    const stage = staging();

    await stageBuild(dist, stage, expected);

    expect(relative(stage, join(stage, "_headers"))).toBe("_headers");
    expect(readFileSync(join(stage, "assets", "app.js"), "utf8")).toBe(
      'import "./app.css";\n',
    );
    await expect(inspectBuild(stage)).rejects.toThrow();
    expect(
      (await import("node:fs"))
        .readdirSync(stage, { recursive: true, encoding: "utf8" })
        .map((path) => path.replaceAll("\\", "/"))
        .sort(),
    ).toEqual([
      "_headers",
      "assets",
      "assets/app.css",
      "assets/app.js",
      "favicon.svg",
      "index.html",
    ]);
  });

  it("rejects an existing staging directory instead of reusing it", async () => {
    const dist = fixture();
    const expected = await inspectBuild(dist);
    const stage = staging();
    mkdirSync(stage);
    write(stage, "unrelated.txt");
    await expect(stageBuild(dist, stage, expected)).rejects.toThrow();
  });

  it("rejects relative staging directories", async () => {
    const dist = fixture();
    const expected = await inspectBuild(dist);
    await expect(
      stageBuild(dist, "relative-stage", expected),
    ).rejects.toThrow();
  });

  it("rejects a nonexistent repo-contained stage independently of cwd", async () => {
    const dist = fixture();
    const expected = await inspectBuild(dist);
    const repositoryRoot = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
    );
    const stage = join(
      repositoryRoot,
      `.private-hosted-stage-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const originalCwd = process.cwd();
    const externalCwd = mkdtempSync(
      join(tmpdir(), "conan-private-hosted-cwd-"),
    );
    let stageExistedBeforeCleanup = false;
    roots.push(externalCwd);
    expect(existsSync(stage)).toBe(false);
    process.chdir(externalCwd);
    try {
      await expect(stageBuild(dist, stage, expected)).rejects.toThrow(
        "staging directory must be outside the repository",
      );
    } finally {
      process.chdir(originalCwd);
      stageExistedBeforeCleanup = existsSync(stage);
      if (existsSync(stage)) {
        expect(relative(repositoryRoot, stage).startsWith("..")).toBe(false);
        rmSync(stage, { recursive: true, force: true });
      }
    }
    expect(stageExistedBeforeCleanup).toBe(false);
    expect(existsSync(stage)).toBe(false);
  });

  it("rejects staging bytes that do not match the expected manifest", async () => {
    const dist = fixture();
    const expected = await inspectBuild(dist);
    const stage = staging();
    const altered = structuredClone(expected);
    altered.upload[0] = { ...altered.upload[0]!, bytes: 99 };
    await expect(stageBuild(dist, stage, altered)).rejects.toThrow();
  });

  it("rejects a crafted expected upload before creating staging", async () => {
    const dist = fixture();
    const expected = await inspectBuild(dist);
    const contents = "TOKEN=secret\n";
    write(dist, ".env", contents);
    const crafted = structuredClone(expected);
    const secret = {
      path: "/.env",
      bytes: Buffer.byteLength(contents),
      sha256: createHash("sha256").update(contents).digest("hex"),
    };
    crafted.upload.push(secret);
    crafted.response.push(secret);
    crafted.upload.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
    crafted.response.sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );
    const stage = staging();
    await expect(stageBuild(dist, stage, crafted)).rejects.toThrow(
      "forbidden or orphan file",
    );
    await expect(
      (await import("node:fs/promises")).lstat(stage),
    ).rejects.toThrow();
  });

  it("rejects symlinked inspect and staging source roots", async () => {
    const dist = fixture();
    const linked = join(
      mkdtempSync(join(tmpdir(), "conan-private-hosted-link-")),
      "dist",
    );
    roots.push(join(linked, ".."));
    symlinkSync(dist, linked, "junction");
    await expect(inspectBuild(linked)).rejects.toThrow(
      "dist directory is not a regular directory",
    );
    const expected = await inspectBuild(dist);
    await expect(stageBuild(linked, staging(), expected)).rejects.toThrow(
      "dist directory is not a regular directory",
    );
  });
});
