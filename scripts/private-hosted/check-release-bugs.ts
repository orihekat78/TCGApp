import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUG_FILE = /^BUG-\d{3}\.md$/;
const BUG_ID = /^BUG-\d{3}$/;
const SEVERITIES = new Set(["重大", "高", "中", "低", "軽微"]);
const BLOCKING_SEVERITIES = new Set(["重大", "高"]);
const RESOLVED_STATUSES = new Set(["修正済", "仕様外"]);

export type ReleaseBugSummary = {
  id: string;
  title: string;
  severity: string;
  status: string;
};

export type ReleaseBugGate = {
  schemaVersion: 1;
  ok: boolean;
  blockers: ReleaseBugSummary[];
  knownLimitations: ReleaseBugSummary[];
};

export type BugDocument = { path: string; content: string };

function fail(message: string): never {
  throw new Error(`private hosted bug gate rejected: ${message}`);
}

export function parseBugFrontmatter(
  path: string,
  content: string,
): ReleaseBugSummary {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) fail(`${path}: frontmatter is missing`);
  const fields = new Map<string, string>();
  for (const line of match[1]!.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (fields.has(key)) fail(`${path}: duplicate frontmatter field ${key}`);
    fields.set(key, value);
  }
  const id = fields.get("id") ?? fail(`${path}: id is missing`);
  const title = fields.get("title") ?? fail(`${path}: title is missing`);
  const severity = fields.get("severity") ?? fail(`${path}: severity is missing`);
  const status = fields.get("status") ?? fail(`${path}: status is missing`);
  if (!BUG_ID.test(id)) fail(`${path}: id is invalid`);
  const expectedId = basename(path, ".md");
  if (BUG_FILE.test(basename(path)) && id !== expectedId) {
    fail(`${path}: id ${id} does not match ${expectedId}`);
  }
  if (!title) fail(`${path}: title is empty`);
  if (!SEVERITIES.has(severity)) fail(`${path}: severity is invalid`);
  if (!status) fail(`${path}: status is empty`);
  return { id, title, severity, status };
}

export function evaluateReleaseBugs(
  documents: readonly BugDocument[],
): ReleaseBugGate {
  const records = documents.map(({ path, content }) =>
    parseBugFrontmatter(path, content),
  );
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.id)) fail(`duplicate bug id ${record.id}`);
    ids.add(record.id);
  }
  const unresolved = records
    .filter((record) => !RESOLVED_STATUSES.has(record.status))
    .sort((left, right) => left.id.localeCompare(right.id));
  const blockers = unresolved.filter((record) =>
    BLOCKING_SEVERITIES.has(record.severity),
  );
  const knownLimitations = unresolved.filter(
    (record) => !BLOCKING_SEVERITIES.has(record.severity),
  );
  return {
    schemaVersion: 1,
    ok: blockers.length === 0,
    blockers,
    knownLimitations,
  };
}

export function serializeBugGate(gate: ReleaseBugGate): string {
  return `${JSON.stringify(gate, null, 2)}\n`;
}

export async function checkReleaseBugs(repoRoot: string): Promise<ReleaseBugGate> {
  const directory = resolve(repoRoot, ".claude", "bugs");
  const files = (await readdir(directory))
    .filter((name) => BUG_FILE.test(name))
    .sort();
  if (files.length === 0) fail("no BUG-XXX.md records found");
  const documents = await Promise.all(
    files.map(async (name) => ({
      path: resolve(directory, name),
      content: await readFile(resolve(directory, name), "utf8"),
    })),
  );
  return evaluateReleaseBugs(documents);
}

export async function runReleaseBugGateCli(repoRoot = process.cwd()): Promise<void> {
  const result = await checkReleaseBugs(repoRoot);
  process.stdout.write(serializeBugGate(result));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runReleaseBugGateCli();
}
