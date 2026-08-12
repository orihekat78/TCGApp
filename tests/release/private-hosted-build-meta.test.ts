import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import {
  buildMetaRelease,
  validateFunctionsBuildEvidence,
  type MetaBuildCommand,
} from "../../scripts/private-hosted/build-meta";

const roots: string[] = [];
const reviewedWranglerConfigHash =
  "310537869a294dac13c08ccb489f2e4138cc193b643076952842cfb95d5a9a17";
const sources = [
  "../src/cloud-data/access-auth.ts",
  "../src/cloud-data/api.ts",
  "../src/cloud-data/contracts.ts",
  "../src/cloud-data/idempotency.ts",
  "../src/cloud-data/identity.ts",
  "../src/cloud-data/rate-limit.ts",
  "../src/cloud-data/repository.ts",
  "../src/cloud-data/request-context.ts",
  "../src/cloud-data/retention.ts",
  "api/v1/[[path]].ts",
];
const dependencies = [
  "../node_modules/jose/dist/webapi/index.js",
  "../node_modules/jose/dist/webapi/jwe/compact/decrypt.js",
  "../node_modules/jose/dist/webapi/jwe/compact/encrypt.js",
  "../node_modules/jose/dist/webapi/jwe/flattened/decrypt.js",
  "../node_modules/jose/dist/webapi/jwe/flattened/encrypt.js",
  "../node_modules/jose/dist/webapi/jwe/general/decrypt.js",
  "../node_modules/jose/dist/webapi/jwe/general/encrypt.js",
  "../node_modules/jose/dist/webapi/jwk/embedded.js",
  "../node_modules/jose/dist/webapi/jwk/thumbprint.js",
  "../node_modules/jose/dist/webapi/jwks/local.js",
  "../node_modules/jose/dist/webapi/jwks/remote.js",
  "../node_modules/jose/dist/webapi/jws/compact/sign.js",
  "../node_modules/jose/dist/webapi/jws/compact/verify.js",
  "../node_modules/jose/dist/webapi/jws/flattened/sign.js",
  "../node_modules/jose/dist/webapi/jws/flattened/verify.js",
  "../node_modules/jose/dist/webapi/jws/general/sign.js",
  "../node_modules/jose/dist/webapi/jws/general/verify.js",
  "../node_modules/jose/dist/webapi/jwt/decrypt.js",
  "../node_modules/jose/dist/webapi/jwt/encrypt.js",
  "../node_modules/jose/dist/webapi/jwt/sign.js",
  "../node_modules/jose/dist/webapi/jwt/unsecured.js",
  "../node_modules/jose/dist/webapi/jwt/verify.js",
  "../node_modules/jose/dist/webapi/key/export.js",
  "../node_modules/jose/dist/webapi/key/generate_key_pair.js",
  "../node_modules/jose/dist/webapi/key/generate_secret.js",
  "../node_modules/jose/dist/webapi/key/import.js",
  "../node_modules/jose/dist/webapi/lib/asn1.js",
  "../node_modules/jose/dist/webapi/lib/base64.js",
  "../node_modules/jose/dist/webapi/lib/buffer_utils.js",
  "../node_modules/jose/dist/webapi/lib/content_encryption.js",
  "../node_modules/jose/dist/webapi/lib/crypto_key.js",
  "../node_modules/jose/dist/webapi/lib/deflate.js",
  "../node_modules/jose/dist/webapi/lib/helpers.js",
  "../node_modules/jose/dist/webapi/lib/invalid_key_input.js",
  "../node_modules/jose/dist/webapi/lib/is_key_like.js",
  "../node_modules/jose/dist/webapi/lib/jwe_algorithms.js",
  "../node_modules/jose/dist/webapi/lib/jwe_decrypt.js",
  "../node_modules/jose/dist/webapi/lib/jwe_encrypt.js",
  "../node_modules/jose/dist/webapi/lib/jwk_to_key.js",
  "../node_modules/jose/dist/webapi/lib/jws_algorithms.js",
  "../node_modules/jose/dist/webapi/lib/jws_sign.js",
  "../node_modules/jose/dist/webapi/lib/jws_verify.js",
  "../node_modules/jose/dist/webapi/lib/jwt_claims_set.js",
  "../node_modules/jose/dist/webapi/lib/key.js",
  "../node_modules/jose/dist/webapi/lib/key_algorithm.js",
  "../node_modules/jose/dist/webapi/lib/key_descriptor.js",
  "../node_modules/jose/dist/webapi/lib/key_management.js",
  "../node_modules/jose/dist/webapi/lib/options.js",
  "../node_modules/jose/dist/webapi/lib/signing.js",
  "../node_modules/jose/dist/webapi/lib/type_checks.js",
  "../node_modules/jose/dist/webapi/util/base64url.js",
  "../node_modules/jose/dist/webapi/util/decode_jwt.js",
  "../node_modules/jose/dist/webapi/util/decode_protected_header.js",
  "../node_modules/jose/dist/webapi/util/errors.js",
  "../node_modules/path-to-regexp/dist.es2015/index.js",
  "../node_modules/wrangler/templates/pages-template-worker.ts",
];
const generatedRoute =
  "../.wrangler/tmp/pages-fixture/functionsRoutes-fixture.mjs";

function validEvidence(
  outputPath = "C:/tmp/worker/index.js",
  wranglerBuildMetadataConfigSha256 = "fixture-raw-config-hash",
) {
  const inputPaths = [...sources, ...dependencies, generatedRoute];
  const inputs = Object.fromEntries(
    inputPaths.map((path) => [path, { bytes: 1, imports: [], format: "esm" }]),
  );
  return {
    metafile: {
      inputs,
      outputs: {
        [outputPath]: {
          imports: [],
          exports: ["default"],
          entryPoint:
            "../node_modules/wrangler/templates/pages-template-worker.ts",
          inputs: Object.fromEntries(
            inputPaths.map((path) => [path, { bytesInOutput: 1 }]),
          ),
          bytes: inputPaths.length,
        },
      },
    },
    buildMetadata: {
      wrangler_config_hash: wranglerBuildMetadataConfigSha256,
      build_output_directory: "dist",
    },
    config: {
      routes: [
        {
          routePath: "/api/v1/:path*",
          mountPath: "/api/v1",
          method: "",
          module: ["api/v1/[[path]].ts:onRequest"],
        },
      ],
      baseURL: "/",
    },
    routes: {
      version: 1,
      description: "Generated by wrangler@4.118.0",
      include: ["/api/v1/*"],
      exclude: [],
    },
    publicRoutes: { version: 1, include: ["/api/v1/*"], exclude: [] },
    wranglerBuildMetadataConfigSha256,
    reviewedWranglerConfigSha256: reviewedWranglerConfigHash,
  };
}

function argument(command: MetaBuildCommand, flag: string): string {
  const index = command.args.indexOf(flag);
  if (index < 0 || !command.args[index + 1]) {
    throw new Error(`missing command argument: ${flag}`);
  }
  return command.args[index + 1]!;
}

async function writeWorkerEvidence(
  command: MetaBuildCommand,
  wranglerConfig: string,
  workerSource = "export default {};\n",
): Promise<void> {
  const outdir = argument(command, "--outdir");
  const rawConfigHash = createHash("sha256")
    .update(wranglerConfig)
    .digest("hex");
  await writeFile(resolve(outdir, "index.js"), workerSource);
  await writeFile(
    argument(command, "--metafile"),
    JSON.stringify(
      validEvidence(resolve(outdir, "index.js"), rawConfigHash).metafile,
    ),
  );
  await writeFile(
    argument(command, "--build-metadata-path"),
    JSON.stringify(
      validEvidence("C:/tmp/worker/index.js", rawConfigHash).buildMetadata,
    ),
  );
  await writeFile(
    argument(command, "--output-config-path"),
    JSON.stringify(validEvidence().config),
  );
  await writeFile(
    argument(command, "--output-routes-path"),
    JSON.stringify(validEvidence().routes),
  );
}

async function buildWithWranglerConfig(wranglerConfig: string): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "conan-build-meta-eol-"));
  roots.push(root);
  await mkdir(resolve(root, "node_modules/vite/bin"), { recursive: true });
  await mkdir(resolve(root, "node_modules/wrangler/bin"), { recursive: true });
  await mkdir(resolve(root, "functions/api/v1"), { recursive: true });
  await writeFile(resolve(root, "node_modules/vite/bin/vite.js"), "// vite");
  await writeFile(
    resolve(root, "node_modules/wrangler/bin/wrangler.js"),
    "// wrangler",
  );
  await writeFile(resolve(root, "functions/api/v1/[[path]].ts"), "export {};");
  await writeFile(resolve(root, "wrangler.json"), wranglerConfig);

  await buildMetaRelease(root, async (command) => {
    if (command.args.includes("build") && command.args.includes("--manifest")) {
      await mkdir(resolve(root, "dist"), { recursive: true });
      await writeFile(
        resolve(root, "dist/_routes.json"),
        JSON.stringify({ version: 1, include: ["/api/v1/*"], exclude: [] }),
      );
      return { stdout: "vite\n", stderr: "" };
    }

    const outdir = argument(command, "--outdir");
    const rawConfigHash = createHash("sha256")
      .update(wranglerConfig)
      .digest("hex");
    await writeFile(resolve(outdir, "index.js"), "export default {};\n");
    await writeFile(
      argument(command, "--metafile"),
      JSON.stringify(
        validEvidence(resolve(outdir, "index.js"), rawConfigHash).metafile,
      ),
    );
    await writeFile(
      argument(command, "--build-metadata-path"),
      JSON.stringify(validEvidence("C:/tmp/worker/index.js", rawConfigHash).buildMetadata),
    );
    await writeFile(
      argument(command, "--output-config-path"),
      JSON.stringify(validEvidence().config),
    );
    await writeFile(
      argument(command, "--output-routes-path"),
      JSON.stringify(validEvidence().routes),
    );
    return { stdout: "worker\n", stderr: "" };
  });
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("private hosted Meta release build", () => {
  it("rejects a release build without a regular Pages Functions entry", async () => {
    const root = await mkdtemp(join(tmpdir(), "conan-build-meta-missing-"));
    roots.push(root);
    await mkdir(resolve(root, "node_modules/vite/bin"), { recursive: true });
    await writeFile(resolve(root, "node_modules/vite/bin/vite.js"), "// vite");

    await expect(
      buildMetaRelease(root, async () => ({ stdout: "vite\n", stderr: "" })),
    ).rejects.toThrow(/Pages Functions entry is missing/);
  });

  it("accepts only the reviewed Functions route and source closure", () => {
    expect(() => validateFunctionsBuildEvidence(validEvidence())).not.toThrow();

    const widened = structuredClone(validEvidence());
    widened.routes.include = ["/*"];
    expect(() => validateFunctionsBuildEvidence(widened)).toThrow(
      /Functions routes differs/,
    );

    const extraSource = structuredClone(validEvidence());
    extraSource.metafile.inputs["../src/cloud-data/unreviewed.ts"] = {
      bytes: 1,
      imports: [],
      format: "esm",
    };
    expect(() => validateFunctionsBuildEvidence(extraSource)).toThrow(
      /Functions source closure differs/,
    );

    const unreviewedJoseInput = structuredClone(validEvidence());
    unreviewedJoseInput.metafile.inputs[
      "../node_modules/jose/dist/webapi/unreviewed.js"
    ] = {
      bytes: 1,
      imports: [],
      format: "esm",
    };
    expect(() => validateFunctionsBuildEvidence(unreviewedJoseInput)).toThrow(
      /unexpected Functions bundle input/,
    );
  });

  it("rejects config drift and output contributors outside the input closure", () => {
    const configDrift = structuredClone(validEvidence());
    configDrift.buildMetadata.wrangler_config_hash = "drift";
    expect(() => validateFunctionsBuildEvidence(configDrift)).toThrow(
      /build metadata differs/,
    );

    const escapedContributor = structuredClone(validEvidence());
    const output = Object.values(escapedContributor.metafile.outputs)[0]!;
    output.inputs["../node_modules/unreviewed/index.js"] = { bytesInOutput: 1 };
    expect(() => validateFunctionsBuildEvidence(escapedContributor)).toThrow(
      /outside the input closure/,
    );
  });

  it("accepts reviewed Wrangler JSON across line endings but rejects content drift", async () => {
    const reviewed = (await readFile(resolve(process.cwd(), "wrangler.json"), "utf8"))
      .replaceAll("\r\n", "\n");
    const mixed = reviewed
      .split("\n")
      .map((line, index, lines) =>
        index === lines.length - 1
          ? line
          : `${line}${index % 2 === 0 ? "\r\n" : "\n"}`,
      )
      .join("");

    for (const lineEndingVariant of [
      reviewed,
      reviewed.replaceAll("\n", "\r\n"),
      mixed,
    ]) {
      await expect(buildWithWranglerConfig(lineEndingVariant)).resolves.toBeUndefined();
    }

    await expect(
      buildWithWranglerConfig(
        reviewed.replace('"DEPLOYMENT_ENV": "production"', '"DEPLOYMENT_ENV": "staging"'),
      ),
    ).rejects.toThrow(/wrangler.json differs from the reviewed release contract/);
  });

  it("builds from one external reviewed snapshot when the repo config changes during Wrangler", async () => {
    const root = await mkdtemp(join(tmpdir(), "conan-build-meta-snapshot-"));
    roots.push(root);
    await mkdir(resolve(root, "node_modules/vite/bin"), { recursive: true });
    await mkdir(resolve(root, "node_modules/wrangler/bin"), { recursive: true });
    await mkdir(resolve(root, "functions/api/v1"), { recursive: true });
    await writeFile(resolve(root, "node_modules/vite/bin/vite.js"), "// vite");
    await writeFile(
      resolve(root, "node_modules/wrangler/bin/wrangler.js"),
      "// wrangler",
    );
    await writeFile(resolve(root, "functions/api/v1/[[path]].ts"), "export {};");
    const reviewed = await readFile(resolve(process.cwd(), "wrangler.json"), "utf8");
    const drifted = reviewed.replace(
      '"DEPLOYMENT_ENV": "production"',
      '"DEPLOYMENT_ENV": "staging"',
    );
    const repoConfigPath = resolve(root, "wrangler.json");
    await writeFile(repoConfigPath, reviewed);

    await buildMetaRelease(root, async (command) => {
      if (command.args.includes("build") && command.args.includes("--manifest")) {
        await mkdir(resolve(root, "dist"), { recursive: true });
        await writeFile(
          resolve(root, "dist/_routes.json"),
          JSON.stringify({ version: 1, include: ["/api/v1/*"], exclude: [] }),
        );
        return { stdout: "vite\n", stderr: "" };
      }

      await writeFile(repoConfigPath, drifted);
      try {
        const snapshotPath = argument(command, "--config");
        const snapshotRelative = relative(root, snapshotPath);
        expect(
          snapshotRelative.startsWith("..") || isAbsolute(snapshotRelative),
        ).toBe(true);
        const snapshot = await readFile(snapshotPath, "utf8");
        expect(snapshot).toBe(reviewed);
        await writeWorkerEvidence(
          command,
          snapshot,
          snapshot.includes('"DEPLOYMENT_ENV": "staging"')
            ? 'export default "staging";\n'
            : 'export default "production";\n',
        );
      } finally {
        await writeFile(repoConfigPath, reviewed);
      }
      return { stdout: "worker\n", stderr: "" };
    });

    expect(await readFile(resolve(root, "dist/_worker.js"), "utf8")).toBe(
      'export default "production";\n',
    );
  });

  it("rejects a child-modified Wrangler snapshot before publishing", async () => {
    const root = await mkdtemp(join(tmpdir(), "conan-build-meta-snapshot-tamper-"));
    roots.push(root);
    await mkdir(resolve(root, "node_modules/vite/bin"), { recursive: true });
    await mkdir(resolve(root, "node_modules/wrangler/bin"), { recursive: true });
    await mkdir(resolve(root, "functions/api/v1"), { recursive: true });
    await writeFile(resolve(root, "node_modules/vite/bin/vite.js"), "// vite");
    await writeFile(
      resolve(root, "node_modules/wrangler/bin/wrangler.js"),
      "// wrangler",
    );
    await writeFile(resolve(root, "functions/api/v1/[[path]].ts"), "export {};");
    const reviewed = await readFile(resolve(process.cwd(), "wrangler.json"), "utf8");
    await writeFile(resolve(root, "wrangler.json"), reviewed);

    await expect(
      buildMetaRelease(root, async (command) => {
        if (command.args.includes("build") && command.args.includes("--manifest")) {
          await mkdir(resolve(root, "dist"), { recursive: true });
          await writeFile(
            resolve(root, "dist/_routes.json"),
            JSON.stringify({ version: 1, include: ["/api/v1/*"], exclude: [] }),
          );
          return { stdout: "vite\n", stderr: "" };
        }

        const snapshotPath = argument(command, "--config");
        const snapshot = await readFile(snapshotPath, "utf8");
        await writeWorkerEvidence(command, snapshot);
        await writeFile(snapshotPath, `${snapshot}\n`);
        return { stdout: "worker\n", stderr: "" };
      }),
    ).rejects.toThrow(/Wrangler config snapshot changed during build/);
    await expect(
      readFile(resolve(root, "dist/_worker.js")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("builds Vite then copies only the validated raw Wrangler index", async () => {
    const root = await mkdtemp(join(tmpdir(), "conan-build-meta-test-"));
    roots.push(root);
    await mkdir(resolve(root, "node_modules/vite/bin"), { recursive: true });
    await mkdir(resolve(root, "node_modules/wrangler/bin"), {
      recursive: true,
    });
    await mkdir(resolve(root, "functions/api/v1"), { recursive: true });
    await writeFile(resolve(root, "node_modules/vite/bin/vite.js"), "// vite");
    await writeFile(
      resolve(root, "node_modules/wrangler/bin/wrangler.js"),
      "// wrangler",
    );
    await writeFile(
      resolve(root, "functions/api/v1/[[path]].ts"),
      "export {};",
    );
    await writeFile(
      resolve(root, "wrangler.json"),
      await readFile(resolve(process.cwd(), "wrangler.json")),
    );
    const rawConfigHash = createHash("sha256")
      .update(await readFile(resolve(root, "wrangler.json")))
      .digest("hex");

    const seen: MetaBuildCommand[] = [];
    const result = await buildMetaRelease(root, async (command) => {
      seen.push(command);
      if (
        command.args.includes("build") &&
        command.args.includes("--manifest")
      ) {
        await mkdir(resolve(root, "dist"), { recursive: true });
        await writeFile(
          resolve(root, "dist/_routes.json"),
          JSON.stringify({ version: 1, include: ["/api/v1/*"], exclude: [] }),
        );
        return { stdout: "vite\n", stderr: "" };
      }

      const outdir = argument(command, "--outdir");
      await writeFile(resolve(outdir, "index.js"), "export default {};\n");
      await writeFile(
        argument(command, "--metafile"),
        JSON.stringify(
          validEvidence(resolve(outdir, "index.js"), rawConfigHash).metafile,
        ),
      );
      await writeFile(
        argument(command, "--build-metadata-path"),
        JSON.stringify(
          validEvidence("C:/tmp/worker/index.js", rawConfigHash).buildMetadata,
        ),
      );
      await writeFile(
        argument(command, "--output-config-path"),
        JSON.stringify(validEvidence().config),
      );
      await writeFile(
        argument(command, "--output-routes-path"),
        JSON.stringify(validEvidence().routes),
      );
      return { stdout: "worker\n", stderr: "" };
    });

    expect(result).toEqual({ stdout: "vite\nworker\n", stderr: "" });
    expect(seen).toHaveLength(2);
    expect(seen[1]?.args).toEqual(
      expect.arrayContaining([
        "pages",
        "functions",
        "build",
        "functions",
        "--outdir",
        "--metafile",
        "--build-metadata-path",
        "--output-config-path",
        "--output-routes-path",
        "--minify",
      ]),
    );
    expect(await readFile(resolve(root, "dist/_worker.js"), "utf8")).toBe(
      "export default {};\n",
    );
  });
});
