import { Buffer } from "node:buffer";
import { lstat, readFile, readdir } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

export type ReleaseBasicFinding = {
  file: string;
  code: "embedded-secret" | "external-destination";
  detail: string;
};

const MODULE_REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
// Deliberately bounded: final text artifacts and literal destinations only.
// Runtime-computed values remain in the optional advanced boundary audit.
const APPROVED_DESTINATION_PREFIXES = [
  "https://www.takaratomy.co.jp/products/conan-cardgame/storage/card/",
  "https://react.dev/errors/",
];
const APPROVED_EXACT_DESTINATIONS = new Set([
  "https://www.takaratomy.co.jp",
  "https://www.takaratomy.co.jp/products/conan-cardgame/",
  "https://bit.ly/3cXEKWf",
  "http://www.w3.org/1998/Math/MathML",
  "http://www.w3.org/1999/xlink",
  "http://www.w3.org/2000/svg",
  "http://www.w3.org/XML/1998/namespace",
]);
const DESTINATION =
  /(?:(?:https?|wss?):)?\/\/(?:[^\s"'`<>\\(){}@/:;]+(?::[^\s"'`<>\\(){}@/;]*)?@)?(?:\[[0-9A-Fa-f:.]+\]|localhost|[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)(?::\d+)?(?:\/[^\s"'`<>\\(){}\];]*)?/g;
const SECRET_MARKERS: Array<[RegExp, string]> = [
  [/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i, "private key"],
  [
    /(?:Authorization|authorization)["']?\s*[:=]\s*["']Bearer\s+[^\s"'\\]{16,}/i,
    "bearer token",
  ],
  [
    /(?:Authorization|authorization)["']?\s*[:=]\s*["']Basic\s+[A-Za-z0-9+/=]{16,}/i,
    "basic credential",
  ],
  [
    /(?:CLOUDFLARE_API_TOKEN|CF_API_TOKEN|access_token|api_token|auth_token)["']?\s*[:=]\s*["']?[^\s"'&#\r\n]{16,}/i,
    "API token",
  ],
  [
    /(?:CF-Access-Client-Secret|CF_ACCESS_CLIENT_SECRET)["']?\s*[:=]\s*["']?[^\s"'&#,}\r\n]{16,}/i,
    "Cloudflare Access client secret",
  ],
  [/(?:https?|wss?):\/\/[^\s"'@/:]+:[^\s"'@]{8,}@/i, "URL credential"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{30,}\b/, "GitHub token"],
  [/\bxox(?:a|b|p|r|s)-[A-Za-z0-9-]{20,}\b/, "Slack token"],
];

function displayPath(label: string, root: string, path: string): string {
  const child = relative(root, path).split(sep).join("/");
  return child ? `${label}/${child}` : label;
}

function normalizedLiteralText(source: string): string {
  return source
    .replace(/\\(?:x3a|u003a)/gi, ":")
    .replace(/\\(?:x2f|u002f|\/)/gi, "/")
    .replace(/&(?:sol|#47|#x2f);/gi, "/")
    .replace(/\b((?:https?|wss?):)\\+/gi, "$1//");
}

function decodeUtf16Be(bytes: Buffer): string {
  if (bytes.length % 2 !== 0) {
    throw new Error("basic release scan rejected: malformed UTF-16BE artifact");
  }
  const swapped = Buffer.allocUnsafe(bytes.length);
  for (let index = 0; index < bytes.length; index += 2) {
    swapped[index] = bytes[index + 1]!;
    swapped[index + 1] = bytes[index]!;
  }
  return swapped.toString("utf16le");
}

function artifactText(bytes: Buffer): string {
  if (
    bytes.subarray(0, 4).equals(Buffer.from([0xff, 0xfe, 0x00, 0x00])) ||
    bytes.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0xfe, 0xff]))
  ) {
    throw new Error(
      "basic release scan rejected: UTF-32 artifact is unsupported",
    );
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString("utf16le");
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16Be(bytes.subarray(2));
  }
  const sampleLength = Math.min(bytes.length - (bytes.length % 2), 4096);
  if (sampleLength >= 4) {
    let evenNul = 0;
    let oddNul = 0;
    for (let index = 0; index < sampleLength; index += 2) {
      if (bytes[index] === 0) evenNul += 1;
      if (bytes[index + 1] === 0) oddNul += 1;
    }
    const pairs = sampleLength / 2;
    if (oddNul / pairs > 0.3 && evenNul / pairs < 0.1) {
      return bytes.toString("utf16le");
    }
    if (evenNul / pairs > 0.3 && oddNul / pairs < 0.1) {
      return decodeUtf16Be(bytes);
    }
  }
  return bytes.toString("utf8");
}

async function releaseTextFiles(
  repositoryRoot: string,
  artifactDirectory = resolve(repositoryRoot, "dist"),
): Promise<Array<{ file: string; source: string }>> {
  const artifactRoot = resolve(artifactDirectory);
  const label =
    artifactRoot === resolve(repositoryRoot, "dist")
      ? "dist"
      : basename(artifactRoot);
  const artifactStat = await lstat(artifactRoot).catch(() => {
    throw new Error(`basic release scan rejected: ${label} is missing`);
  });
  if (!artifactStat.isDirectory() || artifactStat.isSymbolicLink()) {
    throw new Error(
      `basic release scan rejected: ${label} must be a regular directory`,
    );
  }
  const files: Array<{ file: string; source: string }> = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(
          `basic release scan rejected: symbolic link: ${displayPath(label, artifactRoot, path)}`,
        );
      }
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile()) {
        files.push({
          file: displayPath(label, artifactRoot, path),
          source: artifactText(await readFile(path)),
        });
      }
    }
  };
  await visit(artifactRoot);
  files.sort((left, right) => left.file.localeCompare(right.file));
  return files;
}

export async function scanReleaseSecrets(
  root: string,
  artifactDirectory = resolve(root, "dist"),
): Promise<ReleaseBasicFinding[]> {
  const findings: ReleaseBasicFinding[] = [];
  for (const { file, source } of await releaseTextFiles(
    resolve(root),
    artifactDirectory,
  )) {
    const normalized = normalizedLiteralText(source);
    for (const [marker, label] of SECRET_MARKERS) {
      if (marker.test(normalized))
        findings.push({ file, code: "embedded-secret", detail: label });
    }
  }
  return findings;
}

function parsedDestination(value: string): URL | undefined {
  try {
    return new URL(value.startsWith("//") ? `https:${value}` : value);
  } catch {
    return undefined;
  }
}

function approvedDestination(value: string): boolean {
  const parsed = parsedDestination(value);
  if (!parsed || parsed.username || parsed.password) return false;
  const pathname = parsed.pathname === "/" ? "" : parsed.pathname;
  const withoutQuery = `${parsed.protocol}//${parsed.host}${pathname}`;
  return (
    APPROVED_EXACT_DESTINATIONS.has(withoutQuery) ||
    APPROVED_DESTINATION_PREFIXES.some((allowed) =>
      withoutQuery.startsWith(allowed),
    )
  );
}

function destinationDetail(value: string): string {
  const parsed = parsedDestination(value);
  if (!parsed) return "unparseable external destination";
  const prefix = value.startsWith("//") ? "" : parsed.protocol;
  return `${prefix}//${parsed.host}`;
}

export async function scanReleaseDestinations(
  root: string,
  artifactDirectory = resolve(root, "dist"),
): Promise<ReleaseBasicFinding[]> {
  const findings: ReleaseBasicFinding[] = [];
  for (const { file, source } of await releaseTextFiles(
    resolve(root),
    artifactDirectory,
  )) {
    const destinations = [
      ...new Set(normalizedLiteralText(source).match(DESTINATION) ?? []),
    ].sort();
    for (const destination of destinations) {
      if (!approvedDestination(destination)) {
        findings.push({
          file,
          code: "external-destination",
          detail: destinationDetail(destination),
        });
      }
    }
  }
  return findings;
}

async function cli(): Promise<void> {
  const check = process.argv[2];
  if (
    process.argv.length !== 3 ||
    !["secrets", "destinations"].includes(check ?? "")
  ) {
    throw new Error("usage: audit-release-basics.ts <secrets|destinations>");
  }
  const configuredArtifact = process.env.PRIVATE_HOSTED_ARTIFACT_DIR;
  if (configuredArtifact && !isAbsolute(configuredArtifact)) {
    throw new Error("PRIVATE_HOSTED_ARTIFACT_DIR must be absolute");
  }
  const artifactDirectory =
    configuredArtifact ?? resolve(MODULE_REPOSITORY_ROOT, "dist");
  const findings =
    check === "secrets"
      ? await scanReleaseSecrets(MODULE_REPOSITORY_ROOT, artifactDirectory)
      : await scanReleaseDestinations(
          MODULE_REPOSITORY_ROOT,
          artifactDirectory,
        );
  process.stdout.write(
    `${JSON.stringify({ schemaVersion: 1, ok: findings.length === 0, findings }, null, 2)}\n`,
  );
  if (findings.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await cli();
}
