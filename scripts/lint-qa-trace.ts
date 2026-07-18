import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runGenQaTrace, validateQaSnapshot, validateQaSnapshotAgainstStatus, type QaSnapshot, type QaSnapshotItem, type CoverageStatus } from './gen-docs/gen-qa-trace.js';

const ROOT = process.cwd();
const HASH = /^[a-f0-9]{64}$/;
const STATUSES: readonly CoverageStatus[] = ['matched', 'test-missing', 'legacy-unreviewed', 'unmapped', 'mismatch', 'deferred', 'manual-only'];

export type QaTraceCoverage = {
  total: number;
  statusCounts: Record<CoverageStatus, number>;
  itemStatuses: Record<string, CoverageStatus>;
  allCompliant: boolean;
};

export type QaTraceBaseline = {
  schemaVersion: 1;
  source: { normalizedFaqHash: string; itemSetHash: string; answerSetHash: string; conflictSetHash: string };
  items: QaSnapshotItem[];
  conflicts: NonNullable<QaSnapshot['conflicts']>;
  coverage: QaTraceCoverage;
};

export type QaLintIssue = { code: string; message: string };
export type QaLintResult = { issues: QaLintIssue[]; coverage: QaTraceCoverage; baseline: QaTraceBaseline };

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function sortItems(items: readonly QaSnapshotItem[]): QaSnapshotItem[] {
  return items.map((item) => ({ ...item, cardNums: [...item.cardNums].sort() })).sort((a, b) => a.qaId.localeCompare(b.qaId));
}

function sortConflicts(conflicts: NonNullable<QaSnapshot['conflicts']>): NonNullable<QaSnapshot['conflicts']> {
  return conflicts.map((conflict) => ({ ...conflict, cardNums: [...conflict.cardNums].sort(), answerHashes: [...conflict.answerHashes].sort() }))
    .sort((a, b) => a.qaId.localeCompare(b.qaId));
}

function answerEntries(items: readonly QaSnapshotItem[]): Array<[string, string]> {
  return sortItems(items).map((item) => [`${item.cardId}\u0000${item.sectionHash}\u0000${item.questionHash}`, item.answerHash]);
}

function snapshotSource(snapshot: QaSnapshot): QaTraceBaseline['source'] {
  validateQaSnapshot(snapshot);
  const items = sortItems(snapshot.items);
  const conflicts = sortConflicts(snapshot.conflicts ?? []);
  return {
    normalizedFaqHash: snapshot.normalizedFaqHash,
    itemSetHash: digest(items),
    answerSetHash: digest(answerEntries(items)),
    conflictSetHash: digest(conflicts),
  };
}

function assertCoverage(value: unknown, qaIds?: ReadonlySet<string>): asserts value is QaTraceCoverage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid Q&A coverage');
  const coverage = value as Record<string, unknown>;
  if (Object.keys(coverage).some((key) => !['total', 'statusCounts', 'itemStatuses', 'allCompliant'].includes(key))
    || !Number.isInteger(coverage.total) || typeof coverage.allCompliant !== 'boolean'
    || !coverage.statusCounts || typeof coverage.statusCounts !== 'object'
    || !coverage.itemStatuses || typeof coverage.itemStatuses !== 'object' || Array.isArray(coverage.itemStatuses)) {
    throw new Error('invalid Q&A coverage');
  }
  const counts = coverage.statusCounts as Record<string, unknown>;
  for (const status of STATUSES) if (!Number.isInteger(counts[status]) || Number(counts[status]) < 0) throw new Error(`invalid Q&A coverage count: ${status}`);
  if (Object.keys(counts).some((key) => !STATUSES.includes(key as CoverageStatus))) throw new Error('invalid Q&A coverage status');
  if (STATUSES.reduce((total, status) => total + Number(counts[status]), 0) !== coverage.total) throw new Error('Q&A coverage total mismatch');
  const itemStatuses = coverage.itemStatuses as Record<string, unknown>;
  if (Object.entries(itemStatuses).some(([qaId, status]) => !/^card:[^:\s]+:[a-f0-9]{64}$/.test(qaId) || !STATUSES.includes(status as CoverageStatus))) {
    throw new Error('invalid Q&A coverage item status');
  }
  if (Object.keys(itemStatuses).length !== coverage.total) throw new Error('Q&A coverage item total mismatch');
  const derivedCounts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<CoverageStatus, number>;
  for (const status of Object.values(itemStatuses) as CoverageStatus[]) derivedCounts[status] += 1;
  if (STATUSES.some((status) => derivedCounts[status] !== counts[status])) throw new Error('Q&A coverage item status count mismatch');
  if (qaIds && (Object.keys(itemStatuses).length !== qaIds.size || [...qaIds].some((qaId) => !(qaId in itemStatuses)))) {
    throw new Error('Q&A coverage item identities mismatch');
  }
}

function assertBaseline(value: unknown): asserts value is QaTraceBaseline {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid Q&A trace baseline');
  const baseline = value as Record<string, unknown>;
  if (baseline.schemaVersion !== 1 || !baseline.source || !Array.isArray(baseline.items) || !Array.isArray(baseline.conflicts)) throw new Error('invalid Q&A trace baseline');
  if (Object.keys(baseline).some((key) => !['schemaVersion', 'source', 'items', 'conflicts', 'coverage'].includes(key))) throw new Error('Q&A trace baseline contains disallowed field');
  const source = baseline.source as Record<string, unknown>;
  if (Object.keys(source).some((key) => !['normalizedFaqHash', 'itemSetHash', 'answerSetHash', 'conflictSetHash'].includes(key)) || Object.values(source).some((hash) => typeof hash !== 'string' || !HASH.test(hash))) {
    throw new Error('invalid Q&A trace baseline source hashes');
  }
  validateQaSnapshot({ schemaVersion: 1, source: { url: 'https://baseline.invalid', fetchedAt: 'hash-only' }, normalizedFaqHash: source.normalizedFaqHash, items: baseline.items, conflicts: baseline.conflicts });
  assertCoverage(baseline.coverage, new Set(baseline.items.map((item) => item.qaId)));
}

export function buildQaTraceBaseline(input: { snapshot: QaSnapshot; coverage: QaTraceCoverage }): QaTraceBaseline {
  validateQaSnapshot(input.snapshot);
  assertCoverage(input.coverage, new Set(input.snapshot.items.map((item) => item.qaId)));
  const items = sortItems(input.snapshot.items);
  const conflicts = sortConflicts(input.snapshot.conflicts ?? []);
  return {
    schemaVersion: 1,
    source: snapshotSource(input.snapshot),
    items,
    conflicts,
    coverage: input.coverage,
  };
}

function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(`missing tracked file: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readCoverage(manifest: unknown, qaIds: ReadonlySet<string>): QaTraceCoverage {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('invalid Q&A manifest');
  const coverage = (manifest as { coverage?: unknown }).coverage;
  assertCoverage(coverage, qaIds);
  return coverage;
}

function push(issues: QaLintIssue[], code: string, message: string): void {
  issues.push({ code, message });
}

function compareSnapshots(baseline: QaTraceBaseline, snapshot: QaSnapshot, issues: QaLintIssue[]): void {
  const current = snapshotSource(snapshot);
  if (new Set(snapshot.items.map((item) => item.qaId)).size !== snapshot.items.length) push(issues, 'qa-collision', 'tracked Q&A snapshot contains duplicate identifiers');
  if (current.normalizedFaqHash !== baseline.source.normalizedFaqHash) push(issues, 'source-hash-drift', 'normalized official Q&A aggregate hash changed');
  if (current.itemSetHash !== baseline.source.itemSetHash) push(issues, 'item-set-drift', 'tracked Q&A item hash set changed');
  if (current.conflictSetHash !== baseline.source.conflictSetHash) push(issues, 'conflict-drift', 'tracked Q&A collision/conflict set changed');
  const before = new Map(baseline.items.map((item) => [item.qaId, item]));
  const after = new Map(snapshot.items.map((item) => [item.qaId, item]));
  for (const qaId of after.keys()) if (!before.has(qaId)) push(issues, 'qa-added', `new tracked Q&A item: ${qaId}`);
  for (const qaId of before.keys()) if (!after.has(qaId)) push(issues, 'qa-removed', `removed tracked Q&A item: ${qaId}`);
  const previousAnswers = new Map(answerEntries(baseline.items));
  const currentAnswers = new Map(answerEntries(snapshot.items));
  for (const [key, answerHash] of currentAnswers) if (previousAnswers.has(key) && previousAnswers.get(key) !== answerHash) push(issues, 'answer-hash-drift', `official Q&A answer digest changed: ${key}`);
}

function compareCoverage(baseline: QaTraceCoverage, current: QaTraceCoverage, issues: QaLintIssue[]): void {
  if (current.total !== baseline.total) push(issues, 'coverage-total-drift', 'Q&A coverage total changed');
  const burden = (coverage: QaTraceCoverage): number =>
    coverage.statusCounts['legacy-unreviewed']
    + coverage.statusCounts['manual-only']
    + 2 * (coverage.statusCounts['test-missing'] + coverage.statusCounts.unmapped + coverage.statusCounts.mismatch + coverage.statusCounts.deferred);
  if (current.statusCounts.matched < baseline.statusCounts.matched || burden(current) > burden(baseline)) push(issues, 'coverage-worsened', 'Q&A coverage regressed from the approved baseline');
  const severity: Record<CoverageStatus, number> = {
    matched: 0,
    'legacy-unreviewed': 1,
    'manual-only': 1,
    'test-missing': 2,
    unmapped: 2,
    mismatch: 2,
    deferred: 2,
  };
  for (const [qaId, before] of Object.entries(baseline.itemStatuses)) {
    const after = current.itemStatuses[qaId];
    if (after && severity[after] > severity[before]) {
      push(issues, 'coverage-item-worsened', `Q&A coverage regressed for ${qaId}: ${before} -> ${after}`);
    }
  }
}

export function lintQaTrace(options: { root?: string; requireAll?: boolean; checkGenerated?: boolean } = {}): QaLintResult {
  const root = resolve(options.root ?? ROOT);
  const dataDir = resolve(root, '.claude/specs/cards-data');
  const snapshot = readJson(resolve(dataDir, 'qa-hash-snapshot.json'));
  validateQaSnapshot(snapshot);
  validateQaSnapshotAgainstStatus(snapshot, readJson(resolve(dataDir, 'status.json')));
  const baseline = readJson(resolve(root, '.claude/specs/qa-trace-baseline.json'));
  assertBaseline(baseline);
  const coverage = readCoverage(readJson(resolve(root, '.claude/auto/qa-manifest.json')), new Set(snapshot.items.map((item) => item.qaId)));
  const issues: QaLintIssue[] = [];
  if ((snapshot.conflicts ?? []).length > 0) push(issues, 'qa-conflict', 'tracked Q&A snapshot contains unresolved answer conflicts');
  compareSnapshots(baseline, snapshot, issues);
  compareCoverage(baseline.coverage, coverage, issues);
  if (options.checkGenerated) {
    const result = runGenQaTrace({ checkOnly: true }, root);
    if (result.changedFiles.length) push(issues, 'generated-docs-drift', `generated Q&A artifacts are stale: ${result.changedFiles.join(', ')}`);
  }
  if (options.requireAll && !coverage.allCompliant) push(issues, 'require-all', 'Q&A coverage is not all compliant');
  return { issues, coverage, baseline };
}

/** Regenerate the tracked hash-only review baseline after an intentional, reviewed source update. */
export function writeQaTraceBaseline(root = ROOT): QaTraceBaseline {
  const projectRoot = resolve(root);
  const dataDir = resolve(projectRoot, '.claude/specs/cards-data');
  const snapshot = readJson(resolve(dataDir, 'qa-hash-snapshot.json'));
  validateQaSnapshot(snapshot);
  validateQaSnapshotAgainstStatus(snapshot, readJson(resolve(dataDir, 'status.json')));
  const baseline = buildQaTraceBaseline({
    snapshot,
    coverage: readCoverage(readJson(resolve(projectRoot, '.claude/auto/qa-manifest.json')), new Set(snapshot.items.map((item) => item.qaId))),
  });
  writeFileSync(resolve(projectRoot, '.claude/specs/qa-trace-baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`);
  return baseline;
}

export function lintExitCode(result: QaLintResult): 0 | 1 {
  return result.issues.length === 0 ? 0 : 1;
}

function writeReport(root: string, result: QaLintResult): void {
  const reportPath = resolve(root, '.claude/reports/qa-coverage-lint-current.json');
  mkdirSync(resolve(root, '.claude/reports'), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({ coverage: result.coverage, issues: result.issues }, null, 2)}\n`);
}

function main(): void {
  const root = ROOT;
  try {
    if (process.argv.includes('--write-baseline')) {
      const baseline = writeQaTraceBaseline(root);
      process.stdout.write(`[lint:qa] wrote hash-only baseline items=${baseline.items.length}\n`);
      return;
    }
    const result = lintQaTrace({ root, requireAll: process.argv.includes('--require-all'), checkGenerated: true });
    writeReport(root, result);
    for (const issue of result.issues) process.stderr.write(`[lint:qa] ${issue.code}: ${issue.message}\n`);
    process.stdout.write(`[lint:qa] issues=${result.issues.length} all-compliant=${result.coverage.allCompliant}\n`);
    process.exitCode = lintExitCode(result);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
