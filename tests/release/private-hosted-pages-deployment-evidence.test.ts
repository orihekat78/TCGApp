import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPagesDeploymentEvidence,
  validatePagesDeploymentEvidence,
} from "../../scripts/private-hosted/pages-deployment-evidence.ts";
import type { BuildManifests } from "../../scripts/private-hosted/types.ts";

const roots: string[] = [];

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "conan-pages-evidence-"));
  roots.push(root);
  const staging = resolve(root, "staging");
  await mkdir(resolve(staging, "assets"), { recursive: true });
  const files = new Map([
    ["/_headers", "/*\n"],
    ["/_routes.json", '{"version":1,"include":["/api/v1/*"],"exclude":[]}\n'],
    ["/_worker.js", "export default { fetch() {} };\n"],
    ["/assets/app.js", "export const app = true;\n"],
    ["/assets/app.css", ".app{}\n"],
    ["/index.html", "<!doctype html>\n"],
  ]);
  for (const [path, content] of files) {
    await writeFile(resolve(staging, path.slice(1)), content);
  }
  const upload = [...files]
    .map(([path, content]) => ({
      path,
      bytes: Buffer.byteLength(content),
      sha256: sha256(content),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const manifests: BuildManifests = {
    schemaVersion: 1,
    upload,
    response: upload.filter(
      ({ path }) =>
        path !== "/_headers" &&
        path !== "/_routes.json" &&
        path !== "/_worker.js",
    ),
  };
  const config = {
    name: "conan-private-7302df07",
    pages_build_output_dir: "./dist",
    compatibility_date: "2026-08-10",
    d1_databases: [
      {
        binding: "DB",
        database_name: "conan-cloud-data-production",
        database_id: "4ee3b0b4-560a-46b9-9e9f-17dd394fc291",
      },
    ],
    vars: {
      ACCESS_TEAM_DOMAIN:
        "https://steep-mouse-bb22.cloudflareaccess.com",
      ACCESS_AUD:
        "804dd12e524e3dfd51dd950d3db03b610e415e7e5c71f0300f82a0ccd269c007",
      DEPLOYMENT_ENV: "production",
      APP_HOST_KIND: "exact",
      APP_HOST_VALUE: "conan-private-7302df07.pages.dev",
      D1_DATABASE_ID: "4ee3b0b4-560a-46b9-9e9f-17dd394fc291",
    },
  };
  return { staging, manifests, config };
}

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true });
  }
});

describe("Cloudflare Pages deployment evidence", () => {
  it("pins static asset hashes, MIME types, and production worker bindings", async () => {
    const f = await fixture();
    const configText = `${JSON.stringify(f.config, null, 2)}\n`;
    const evidence = await buildPagesDeploymentEvidence({
      stagingDir: f.staging,
      manifests: f.manifests,
      wranglerConfigText: configText,
    });

    expect(evidence).toMatchObject({
      schemaVersion: 1,
      projectName: "conan-private-7302df07",
      productionBranch: "main",
      pagesBuildOutputDir: "dist",
      wranglerConfigSha256: sha256(configText),
      headersPath: "/_headers",
      routesPath: "/_routes.json",
      worker: {
        path: "/_worker.js",
        mainModule: "_worker.js",
        contentType: "application/javascript+module",
        compatibilityDate: "2026-08-10",
        compatibilityFlags: [],
      },
    });
    expect(evidence.assets.map(({ path }) => path)).toEqual([
      "/assets/app.css",
      "/assets/app.js",
      "/index.html",
    ]);
    expect(evidence.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/assets/app.css",
          contentType: "text/css",
          pagesHash: expect.stringMatching(/^[0-9a-f]{32}$/),
        }),
        expect.objectContaining({
          path: "/assets/app.js",
          contentType: "application/javascript",
        }),
        expect.objectContaining({
          path: "/index.html",
          contentType: "text/html",
        }),
      ]),
    );
    expect(evidence.worker.bindings).toEqual([
      {
        name: "ACCESS_TEAM_DOMAIN",
        type: "plain_text",
        text: "https://steep-mouse-bb22.cloudflareaccess.com",
      },
      {
        name: "ACCESS_AUD",
        type: "plain_text",
        text: "804dd12e524e3dfd51dd950d3db03b610e415e7e5c71f0300f82a0ccd269c007",
      },
      { name: "DEPLOYMENT_ENV", type: "plain_text", text: "production" },
      { name: "APP_HOST_KIND", type: "plain_text", text: "exact" },
      {
        name: "APP_HOST_VALUE",
        type: "plain_text",
        text: "conan-private-7302df07.pages.dev",
      },
      {
        name: "D1_DATABASE_ID",
        type: "plain_text",
        text: "4ee3b0b4-560a-46b9-9e9f-17dd394fc291",
      },
      {
        name: "DB",
        type: "d1",
        id: "4ee3b0b4-560a-46b9-9e9f-17dd394fc291",
      },
    ]);
    expect(validatePagesDeploymentEvidence(evidence)).toBe(evidence);
  });

  it.each([
    ["unknown field", (value: any) => (value.extra = true)],
    ["invalid asset SHA", (value: any) => (value.assets[0].sha256 = "0")],
    ["asset path drift", (value: any) => (value.assets[0].path = "/../x")],
    ["binding drift", (value: any) => (value.worker.bindings[0].name = "TOKEN")],
  ])("rejects %s", async (_label, mutate) => {
    const f = await fixture();
    const evidence = await buildPagesDeploymentEvidence({
      stagingDir: f.staging,
      manifests: f.manifests,
      wranglerConfigText: `${JSON.stringify(f.config)}\n`,
    });
    const changed = structuredClone(evidence);
    mutate(changed);
    expect(() => validatePagesDeploymentEvidence(changed)).toThrow();
  });
});
