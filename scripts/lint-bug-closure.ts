import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ClosureDocument = {
  path: string;
  kind: "ticket" | "changelog";
  content: string;
};

export type ClosureIssue = {
  path: string;
  code:
    | "fixed-commit"
    | "fixed-date"
    | "fixed-rca"
    | "fixed-implementation"
    | "fixed-test"
    | "duplicate-ticket"
    | "scoped-ticket-missing"
    | "changelog-ticket-missing"
    | "changelog-bug-id-invalid"
    | "fixes-ticket-missing"
    | "fixes-ticket-not-fixed"
    | "fixes-ticket-spec-out";
  message: string;
};

type LintOptions = {
  scopedBugIds: ReadonlySet<string>;
  pathIsRegularRepoFile?: (path: string) => boolean;
};

type Ticket = {
  path: string;
  frontmatter: Record<string, string>;
  body: string;
};

const FIXED_STATUS = "修正済";
const SPEC_OUT_STATUS = "仕様外";
const JAPANESE_PLACEHOLDER_RCA =
  /(?:調査中|未調査|未確定|これから調査|TBD|TODO)/i;
const STANDALONE_PLACEHOLDER_RCA =
  /^(?:pending|unknown|n\s*\/\s*a|tbd|todo|-)\.?$/i;
const EVIDENCE_HEADING =
  /^(?:関連ファイル(?:\s|$)|(?:実装|修正|検証)?証拠(?:\s|$)|evidence(?:\s|$))/i;
const IMPLEMENTATION_PATH =
  /^(?:src|meta-app\/src|scripts)\/[\w@./-]+\.(?:[cm]?js|tsx?|css)$/;
const TEST_PATH = /^(?:tests|meta-app\/tests)\/[\w@./-]+\.(?:[cm]?js|tsx?)$/;

export function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};

  const values: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    values[line.slice(0, separator).trim()] = normalizeScalar(
      line.slice(separator + 1),
    );
  }
  return values;
}

function normalizeScalar(raw: string): string {
  let quote: "'" | '"' | null = null;
  let value = raw.trim();
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === "'" || character === '"') && quote === null) {
      quote = character;
    } else if (character === quote) {
      quote = null;
    } else if (
      character === "#" &&
      quote === null &&
      (index === 0 || /\s/.test(value[index - 1]))
    ) {
      value = value.slice(0, index).trim();
      break;
    }
  }
  if (
    value.length >= 2 &&
    ((value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"')))
  ) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function bodyAfterFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
}

function isStatus(value: string | undefined, status: string): boolean {
  return (
    value === status ||
    value?.startsWith(`${status} `) === true ||
    value?.startsWith(`${status}(`) === true
  );
}

function section(body: string, headingPattern: RegExp): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex(
    (line) =>
      /^##\s+/.test(line) && headingPattern.test(line.replace(/^##\s+/, "")),
  );
  if (start < 0) return null;
  const endOffset = lines
    .slice(start + 1)
    .findIndex((line) => /^##\s+/.test(line));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start, end).join("\n").trim();
}

function evidenceSections(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const result: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^##\s+/.test(lines[index])) continue;
    const heading = lines[index].replace(/^##\s+/, "");
    if (!EVIDENCE_HEADING.test(heading)) continue;
    const endOffset = lines
      .slice(index + 1)
      .findIndex((line) => /^##\s+/.test(line));
    const end = endOffset < 0 ? lines.length : index + 1 + endOffset;
    result.push(lines.slice(index + 1, end).join("\n"));
    index = end - 1;
  }
  return result;
}

function collectEvidencePaths(body: string, pattern: RegExp): string[] {
  const paths = evidenceSections(body).flatMap((evidence) =>
    evidence
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*[-*]\s+`([^`\r\n]+)`\s*$/)?.[1])
      .filter((candidate): candidate is string => candidate !== undefined),
  );
  return paths.filter(
    (candidate) =>
      pattern.test(candidate) &&
      !candidate.startsWith("/") &&
      !candidate
        .split("/")
        .some((part) => part === "" || part === ".." || part === "."),
  );
}

function hasSubstantiveRca(rca: string | null): boolean {
  if (!rca) return false;
  const [heading, ...contentLines] = rca.split(/\r?\n/);
  const content = contentLines.join("\n").trim();
  const prose = content
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    JAPANESE_PLACEHOLDER_RCA.test(heading) ||
    JAPANESE_PLACEHOLDER_RCA.test(content)
  ) {
    return false;
  }
  if (STANDALONE_PLACEHOLDER_RCA.test(prose)) return false;
  return prose.length >= 12;
}

function parseChangelogBugReferences(content: string): string[] {
  const frontmatter =
    content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";
  const bugsField =
    frontmatter.match(/(?:^|\r?\n)bugs:\s*([\s\S]*?)(?=\r?\n[\w-]+:|$)/)?.[1] ??
    "";
  return [...bugsField.matchAll(/\bBUG-[A-Za-z0-9-]+\b/g)].map(
    (match) => match[0],
  );
}

function validateFixedTicket(
  ticket: Ticket,
  pathIsRegularRepoFile?: (path: string) => boolean,
): ClosureIssue[] {
  const issues: ClosureIssue[] = [];
  const { frontmatter, body, path } = ticket;
  if (!isStatus(frontmatter.status, FIXED_STATUS)) return issues;

  if (!/^[0-9a-f]{7,40}$/i.test(frontmatter.commit ?? "")) {
    issues.push({
      path,
      code: "fixed-commit",
      message: "status=修正済には実装commitの7〜40桁hex hashが必要です。",
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.date_fixed ?? "")) {
    issues.push({
      path,
      code: "fixed-date",
      message: "status=修正済にはYYYY-MM-DD形式のdate_fixedが必要です。",
    });
  }

  const rca = section(body, /^(?:RCA|Root Cause|原因)/i);
  if (!hasSubstantiveRca(rca)) {
    issues.push({
      path,
      code: "fixed-rca",
      message: "status=修正済には調査済みの具体的なRCA節が必要です。",
    });
  }

  const implementationPaths = collectEvidencePaths(body, IMPLEMENTATION_PATH);
  if (
    implementationPaths.length === 0 ||
    (pathIsRegularRepoFile && !implementationPaths.some(pathIsRegularRepoFile))
  ) {
    issues.push({
      path,
      code: "fixed-implementation",
      message: "status=修正済には存在する実装pathの証拠が必要です。",
    });
  }

  const testPaths = collectEvidencePaths(body, TEST_PATH);
  if (
    testPaths.length === 0 ||
    (pathIsRegularRepoFile && !testPaths.some(pathIsRegularRepoFile))
  ) {
    issues.push({
      path,
      code: "fixed-test",
      message: "status=修正済には存在するtest pathの証拠が必要です。",
    });
  }

  return issues;
}

export function lintBugClosure(
  documents: readonly ClosureDocument[],
  options: LintOptions,
): ClosureIssue[] {
  const issues: ClosureIssue[] = [];
  const tickets = new Map<string, Ticket>();

  for (const document of documents) {
    if (document.kind !== "ticket") continue;
    const frontmatter = parseFrontmatter(document.content);
    const id = frontmatter.id;
    if (!id) continue;
    if (tickets.has(id)) {
      if (options.scopedBugIds.has(id)) {
        issues.push({
          path: document.path,
          code: "duplicate-ticket",
          message: `${id}のticketが重複しています。`,
        });
      }
      continue;
    }
    tickets.set(id, {
      path: document.path,
      frontmatter,
      body: bodyAfterFrontmatter(document.content),
    });
  }

  for (const [id, ticket] of tickets) {
    if (options.scopedBugIds.has(id)) {
      issues.push(
        ...validateFixedTicket(ticket, options.pathIsRegularRepoFile),
      );
    }
  }
  for (const id of options.scopedBugIds) {
    if (!tickets.has(id)) {
      issues.push({
        path: `.claude/bugs/${id}.md`,
        code: "scoped-ticket-missing",
        message: `${id}のticketを読めません。`,
      });
    }
  }

  for (const document of documents) {
    if (document.kind !== "changelog") continue;
    const frontmatter = parseFrontmatter(document.content);
    const references = parseChangelogBugReferences(document.content);
    const isFixes = frontmatter.category === "fixes";
    const isHardeningEntry =
      document.path.replaceAll("\\", "/") ===
      ".claude/changelog-entries/2026-07-16-01-you-vs-cpu-hardening.md";
    if (!isHardeningEntry && !isFixes) continue;

    for (const id of references) {
      if (!/^BUG-\d{3}$/.test(id)) {
        issues.push({
          path: document.path,
          code: "changelog-bug-id-invalid",
          message: `changelogのBUG ID "${id}"はBUG-000形式ではありません。`,
        });
        continue;
      }
      const ticket = tickets.get(id);
      if (!ticket) {
        issues.push({
          path: document.path,
          code: isFixes ? "fixes-ticket-missing" : "changelog-ticket-missing",
          message: `changelogが参照する${id}のticketを読めません。`,
        });
      } else if (
        isFixes &&
        isStatus(ticket.frontmatter.status, SPEC_OUT_STATUS)
      ) {
        issues.push({
          path: document.path,
          code: "fixes-ticket-spec-out",
          message: `仕様外の${id}をfixes entryへ掲載できません。`,
        });
      } else if (
        isFixes &&
        !isStatus(ticket.frontmatter.status, FIXED_STATUS)
      ) {
        issues.push({
          path: document.path,
          code: "fixes-ticket-not-fixed",
          message: `${id}はstatus=修正済ではないためfixes entryへ掲載できません。`,
        });
      }
    }
  }

  return issues;
}

type WaveManifest = { bugs?: Array<{ id?: string }> };

export function createRegularRepoFilePredicate(
  rootDir: string,
): (relativePath: string) => boolean {
  const rootRealPath = realpathSync.native(rootDir);
  return (relativePath: string): boolean => {
    if (
      isAbsolute(relativePath) ||
      relativePath.includes("\\") ||
      relativePath
        .split("/")
        .some((part) => part === "" || part === ".." || part === ".")
    ) {
      return false;
    }
    try {
      const candidateRealPath = realpathSync.native(
        resolve(rootRealPath, relativePath),
      );
      const fromRoot = relative(rootRealPath, candidateRealPath);
      if (
        fromRoot === ".." ||
        fromRoot.startsWith("../") ||
        fromRoot.startsWith("..\\") ||
        isAbsolute(fromRoot)
      ) {
        return false;
      }
      return statSync(candidateRealPath).isFile();
    } catch {
      return false;
    }
  };
}

export function runBugClosureLint(rootDir = process.cwd()): ClosureIssue[] {
  const manifestPath = resolve(
    rootDir,
    ".claude/specs/you-vs-cpu-hardening-wave-manifest.json",
  );
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as WaveManifest;
  const scopedBugIds = new Set(
    (manifest.bugs ?? [])
      .map((bug) => bug.id)
      .filter((id): id is string => typeof id === "string"),
  );

  const documents: ClosureDocument[] = [];
  const bugsDir = resolve(rootDir, ".claude/bugs");
  for (const file of readdirSync(bugsDir)
    .filter((name) => /^BUG-\d{3}\.md$/.test(name))
    .sort()) {
    const relativePath = `.claude/bugs/${file}`;
    documents.push({
      path: relativePath,
      kind: "ticket",
      content: readFileSync(resolve(bugsDir, file), "utf8"),
    });
  }

  const entriesDir = resolve(rootDir, ".claude/changelog-entries");
  for (const file of readdirSync(entriesDir)
    .filter((name) => name.endsWith(".md"))
    .sort()) {
    const relativePath = `.claude/changelog-entries/${file}`;
    documents.push({
      path: relativePath,
      kind: "changelog",
      content: readFileSync(resolve(entriesDir, file), "utf8"),
    });
  }

  return lintBugClosure(documents, {
    scopedBugIds,
    pathIsRegularRepoFile: createRegularRepoFilePredicate(rootDir),
  });
}

function main(): void {
  const issues = runBugClosureLint();
  for (const issue of issues)
    console.error(`[ERROR] ${issue.path}: ${issue.message} (${issue.code})`);
  console.log(`[lint-bug-closure] errors=${issues.length}`);
  if (issues.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main();
