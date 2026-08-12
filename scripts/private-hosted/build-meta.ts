import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

export type MetaBuildCommand = {
  file: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
};

export type MetaBuildRunner = (
  command: MetaBuildCommand,
) => Promise<{ stdout: string; stderr: string }>;

const execFile = promisify(execFileCallback);
const FUNCTIONS_ENTRY = "functions/api/v1/[[path]].ts";
const REVIEWED_WRANGLER_CONFIG_SHA256 =
  "310537869a294dac13c08ccb489f2e4138cc193b643076952842cfb95d5a9a17";
const FUNCTIONS_SOURCE_INPUTS = [
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
] as const;
const FUNCTIONS_JOSE_INPUTS = [
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
] as const;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function failEvidence(detail: string): never {
  throw new Error(`private hosted build rejected: ${detail}`);
}

function generatedFunctionsRoute(path: string): boolean {
  return /(?:^|\/)\.wrangler\/tmp\/pages-[^/]+\/functionsRoutes-[^/]+\.mjs$/.test(
    path.replaceAll("\\", "/"),
  );
}

function exactJson(value: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    failEvidence(`${label} differs from the reviewed Functions contract`);
  }
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

export function validateFunctionsBuildEvidence(evidence: {
  metafile: unknown;
  buildMetadata: unknown;
  config: unknown;
  routes: unknown;
  publicRoutes: unknown;
  wranglerBuildMetadataConfigSha256: string;
  reviewedWranglerConfigSha256: string;
}): void {
  exactJson(
    evidence.buildMetadata,
    {
      wrangler_config_hash: evidence.wranglerBuildMetadataConfigSha256,
      build_output_directory: "dist",
    },
    "Wrangler build metadata",
  );
  if (evidence.reviewedWranglerConfigSha256 !== REVIEWED_WRANGLER_CONFIG_SHA256) {
    failEvidence("wrangler.json differs from the reviewed release contract");
  }
  exactJson(
    evidence.config,
    {
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
    "Wrangler Functions config",
  );
  exactJson(
    evidence.routes,
    {
      version: 1,
      description: "Generated by wrangler@4.118.0",
      include: ["/api/v1/*"],
      exclude: [],
    },
    "Wrangler Functions routes",
  );
  exactJson(
    evidence.publicRoutes,
    { version: 1, include: ["/api/v1/*"], exclude: [] },
    "deployed Pages routes",
  );

  const metafile = record(evidence.metafile);
  const inputs = record(metafile?.inputs);
  const outputs = record(metafile?.outputs);
  if (!inputs || !outputs) failEvidence("Wrangler metafile is malformed");

  const sourceInputs = Object.keys(inputs)
    .filter(
      (path) => path === "api/v1/[[path]].ts" || path.startsWith("../src/"),
    )
    .sort();
  exactJson(
    sourceInputs,
    [...FUNCTIONS_SOURCE_INPUTS].sort(),
    "Functions source closure",
  );

  const generatedRoutes = Object.keys(inputs).filter(generatedFunctionsRoute);
  if (generatedRoutes.length !== 1) {
    failEvidence("Functions route generator closure is not unique");
  }
  const allowedExactInputs = new Set<string>([
    ...FUNCTIONS_SOURCE_INPUTS,
    ...FUNCTIONS_JOSE_INPUTS,
    "../node_modules/path-to-regexp/dist.es2015/index.js",
    "../node_modules/wrangler/templates/pages-template-worker.ts",
  ]);
  for (const path of Object.keys(inputs)) {
    if (allowedExactInputs.has(path) || generatedFunctionsRoute(path)) {
      continue;
    }
    failEvidence(`unexpected Functions bundle input: ${path}`);
  }
  for (const required of allowedExactInputs) {
    if (!Object.hasOwn(inputs, required)) {
      failEvidence(`required Functions bundle input is missing: ${required}`);
    }
  }

  const generatedRoute = generatedRoutes[0]!;
  for (const input of Object.values(inputs)) {
    const imports = record(input)?.imports;
    if (!Array.isArray(imports))
      failEvidence("Wrangler metafile import is malformed");
    for (const rawImport of imports) {
      const imported = record(rawImport);
      if (!imported || typeof imported.path !== "string") {
        failEvidence("Wrangler metafile import path is malformed");
      }
      if (
        imported.external === true &&
        imported.path !== "<runtime>" &&
        !generatedFunctionsRoute(imported.path)
      ) {
        failEvidence(`unexpected external Functions import: ${imported.path}`);
      }
    }
  }

  const outputEntries = Object.entries(outputs);
  if (
    outputEntries.length !== 1 ||
    !outputEntries[0]![0].replaceAll("\\", "/").endsWith("/index.js")
  ) {
    failEvidence("Wrangler metafile must own exactly one index.js output");
  }
  const output = record(outputEntries[0]![1]);
  if (!output) failEvidence("Wrangler metafile output is malformed");
  exactJson(output.imports, [], "Functions output imports");
  exactJson(output.exports, ["default"], "Functions output exports");
  if (
    output.entryPoint !==
    "../node_modules/wrangler/templates/pages-template-worker.ts"
  ) {
    failEvidence(
      "Functions output entry point is not the reviewed Wrangler template",
    );
  }
  const outputInputs = record(output.inputs);
  if (!outputInputs)
    failEvidence("Functions output contributors are malformed");
  if (!Object.hasOwn(outputInputs, generatedRoute)) {
    failEvidence("Functions output omits the generated route table");
  }
  for (const path of Object.keys(outputInputs)) {
    if (!Object.hasOwn(inputs, path)) {
      failEvidence(
        `Functions output contributor is outside the input closure: ${path}`,
      );
    }
  }
}

async function readJson(path: string, label: string): Promise<unknown> {
  try {
    const entry = await lstat(path);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      failEvidence(`${label} is not a regular file`);
    }
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`private hosted build rejected: ${label} is invalid`, {
      cause: error,
    });
  }
}

function buildEnvironment(): NodeJS.ProcessEnv {
  return {
    SystemRoot: process.env.SystemRoot,
    SYSTEMROOT: process.env.SYSTEMROOT,
    WINDIR: process.env.WINDIR,
    COMSPEC:
      process.platform === "win32"
        ? "C:\\Windows\\System32\\cmd.exe"
        : undefined,
    PATHEXT: process.platform === "win32" ? ".COM;.EXE;.BAT;.CMD" : undefined,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    CI: "1",
    NODE_ENV: "production",
  };
}

async function systemRunner(
  command: MetaBuildCommand,
): Promise<{ stdout: string; stderr: string }> {
  return execFile(command.file, command.args, {
    cwd: command.cwd,
    env: command.env,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function regularExecutable(path: string, label: string): Promise<void> {
  const entry = await lstat(path).catch(() => undefined);
  if (!entry?.isFile() || entry.isSymbolicLink()) {
    throw new Error(`private hosted build rejected: local ${label} is missing`);
  }
}

export async function buildMetaRelease(
  repoRoot: string,
  run: MetaBuildRunner = systemRunner,
): Promise<{ stdout: string; stderr: string }> {
  const root = resolve(repoRoot);
  const vite = resolve(root, "node_modules/vite/bin/vite.js");
  await regularExecutable(vite, "Vite executable");
  const output = await run({
    file: process.execPath,
    args: [
      vite,
      "build",
      "--manifest",
      "--config",
      "vite.config.private-hosted.ts",
    ],
    cwd: root,
    env: buildEnvironment(),
  });

  const functionsEntry = resolve(root, FUNCTIONS_ENTRY);
  const functionsEntryInfo = await lstat(functionsEntry).catch(() => undefined);
  if (!functionsEntryInfo?.isFile() || functionsEntryInfo.isSymbolicLink()) {
    failEvidence("Pages Functions entry is missing or not a regular file");
  }

  const wrangler = resolve(root, "node_modules/wrangler/bin/wrangler.js");
  await regularExecutable(wrangler, "Wrangler executable");
  const wranglerConfig = await readFile(resolve(root, "wrangler.json"));
  const wranglerConfigSha256 = createHash("sha256")
    .update(wranglerConfig)
    .digest("hex");
  const reviewedWranglerConfigSha256 = createHash("sha256")
    .update(normalizeLineEndings(wranglerConfig.toString("utf8")))
    .digest("hex");
  if (reviewedWranglerConfigSha256 !== REVIEWED_WRANGLER_CONFIG_SHA256) {
    failEvidence("wrangler.json differs from the reviewed release contract");
  }

  const controlDirectory = await mkdtemp(
    join(tmpdir(), "conan-private-build-control-"),
  );
  const workerDirectory = await mkdtemp(
    join(tmpdir(), "conan-private-worker-build-"),
  );
  try {
    const wranglerConfigSnapshotPath = resolve(
      controlDirectory,
      "wrangler.json",
    );
    await writeFile(wranglerConfigSnapshotPath, wranglerConfig, {
      flag: "wx",
      mode: 0o600,
    });
    const metafilePath = resolve(workerDirectory, "metafile.json");
    const buildMetadataPath = resolve(workerDirectory, "build-metadata.json");
    const configPath = resolve(workerDirectory, "config.json");
    const routesPath = resolve(workerDirectory, "routes.json");
    const workerOutput = await run({
      file: process.execPath,
      args: [
        wrangler,
        "pages",
        "functions",
        "build",
        "functions",
        "--config",
        wranglerConfigSnapshotPath,
        "--outdir",
        workerDirectory,
        "--metafile",
        metafilePath,
        "--build-metadata-path",
        buildMetadataPath,
        "--output-config-path",
        configPath,
        "--output-routes-path",
        routesPath,
        "--project-directory",
        ".",
        "--build-output-directory",
        "dist",
        "--compatibility-date",
        "2026-08-10",
        "--minify",
      ],
      cwd: root,
      env: buildEnvironment(),
    });
    const wranglerConfigSnapshot = await readFile(
      wranglerConfigSnapshotPath,
    ).catch(() => undefined);
    if (!wranglerConfigSnapshot?.equals(wranglerConfig)) {
      failEvidence("Wrangler config snapshot changed during build");
    }
    const workerPath = resolve(workerDirectory, "index.js");
    const workerEntry = await lstat(workerPath).catch(() => undefined);
    if (!workerEntry?.isFile() || workerEntry.isSymbolicLink()) {
      throw new Error(
        "private hosted build rejected: compiled Pages worker is missing",
      );
    }
    validateFunctionsBuildEvidence({
      metafile: await readJson(metafilePath, "Wrangler metafile"),
      buildMetadata: await readJson(
        buildMetadataPath,
        "Wrangler build metadata",
      ),
      config: await readJson(configPath, "Wrangler Functions config"),
      routes: await readJson(routesPath, "Wrangler Functions routes"),
      publicRoutes: await readJson(
        resolve(root, "dist/_routes.json"),
        "deployed Pages routes",
      ),
      wranglerBuildMetadataConfigSha256: wranglerConfigSha256,
      reviewedWranglerConfigSha256,
    });
    await writeFile(
      resolve(root, "dist/_worker.js"),
      await readFile(workerPath),
      {
        flag: "wx",
      },
    );
    return {
      stdout: `${output.stdout}${workerOutput.stdout}`,
      stderr: `${output.stderr}${workerOutput.stderr}`,
    };
  } finally {
    await Promise.all([
      rm(controlDirectory, { recursive: true, force: true }),
      rm(workerDirectory, { recursive: true, force: true }),
    ]);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 2) {
    throw new Error("private hosted build rejected: arguments are forbidden");
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const result = await buildMetaRelease(root);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
}
