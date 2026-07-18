import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '../../src/cards/index.js';
import { computeLogicalTextSourceHash, renderHeader } from './lib/header.js';
import { diffMarkdown, writeMarkdown } from './lib/markdown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '../..');
const SNAPSHOT_PATH = resolve(PROJECT_ROOT, '.claude/specs/cards-data/qa-hash-snapshot.json');
const DEFERRED_INDEX_PATH = resolve(PROJECT_ROOT, '.claude/specs/DEFERRED-INDEX.md');
const MANIFEST_PATH = resolve(PROJECT_ROOT, '.claude/auto/qa-manifest.json');
const TRACE_PATH = resolve(PROJECT_ROOT, '.claude/auto/qa-trace.md');
const HASH = /^[a-f0-9]{64}$/;
const QA_ID = /^card:([^:\s]+):([a-f0-9]{64})$/;
const QA_ANNOTATION = /^\s*\/\/\s*qa:\s*(card:[^\s]+)\s*$/;

export interface QaSnapshotItem {
  qaId: string;
  cardId: string;
  cardNums: string[];
  sectionHash: string;
  questionHash: string;
  answerHash: string;
}

export interface QaSnapshot {
  schemaVersion: 1;
  source: { url: string; fetchedAt: string };
  items: QaSnapshotItem[];
  conflicts?: Array<{ qaId: string; cardId: string; cardNums: string[]; answerHashes: string[] }>;
}

export interface QaAnnotation {
  qaId: string;
  path: string;
  line: number;
  kind: 'source' | 'test';
}

type Classification = 'shipped' | 'deferred' | 'missing';
type Issue =
  | { kind: 'missing-test'; qaId: string }
  | { kind: 'duplicate-annotation'; qaId: string; path: string };

export interface QaTraceItem extends QaSnapshotItem {
  classification: Classification;
  sourceRefs: string[];
  testRefs: string[];
}

export interface QaTrace {
  source: QaSnapshot['source'];
  items: QaTraceItem[];
  issues: Issue[];
}

export interface RunOptions { checkOnly: boolean }
export interface RunResult { changedFiles: string[]; totalFiles: number }

function compareOrdinal(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const delta = (a[index]?.codePointAt(0) ?? 0) - (b[index]?.codePointAt(0) ?? 0);
    if (delta !== 0) return delta;
  }
  return a.length - b.length;
}

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[], context: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(`${context} contains disallowed field: ${key}`);
  }
}

function assertHash(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !HASH.test(value)) throw new Error(`invalid ${name}`);
}

/** Reject source-text fields before a tracked snapshot can enter generated output. */
export function validateQaSnapshot(value: unknown): asserts value is QaSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid Q&A snapshot');
  const snapshot = value as Record<string, unknown>;
  assertExactKeys(snapshot, ['schemaVersion', 'source', 'items', 'conflicts'], 'Q&A snapshot');
  if (snapshot.schemaVersion !== 1) throw new Error('unsupported Q&A snapshot schema');
  if (!snapshot.source || typeof snapshot.source !== 'object' || Array.isArray(snapshot.source)) throw new Error('invalid Q&A source');
  assertExactKeys(snapshot.source as Record<string, unknown>, ['url', 'fetchedAt'], 'Q&A source');
  const source = snapshot.source as Record<string, unknown>;
  if (typeof source.url !== 'string' || typeof source.fetchedAt !== 'string') throw new Error('invalid Q&A source metadata');
  if (!Array.isArray(snapshot.items)) throw new Error('invalid Q&A snapshot items');
  for (const candidate of snapshot.items) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('invalid Q&A snapshot item');
    const item = candidate as Record<string, unknown>;
    assertExactKeys(item, ['qaId', 'cardId', 'cardNums', 'sectionHash', 'questionHash', 'answerHash'], 'Q&A snapshot item');
    const qaId = String(item.qaId ?? '');
    if (!QA_ID.test(qaId) || typeof item.cardId !== 'string' || !Array.isArray(item.cardNums) || item.cardNums.some((n) => typeof n !== 'string')) {
      throw new Error('invalid Q&A snapshot item identity');
    }
    assertHash(item.sectionHash, 'sectionHash');
    assertHash(item.questionHash, 'questionHash');
    assertHash(item.answerHash, 'answerHash');
  }
  if (snapshot.conflicts !== undefined) {
    if (!Array.isArray(snapshot.conflicts)) throw new Error('invalid Q&A conflicts');
    for (const candidate of snapshot.conflicts) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('invalid Q&A conflict');
      const conflict = candidate as Record<string, unknown>;
      assertExactKeys(conflict, ['qaId', 'cardId', 'cardNums', 'answerHashes'], 'Q&A conflict');
      if (!QA_ID.test(String(conflict.qaId ?? '')) || typeof conflict.cardId !== 'string' || !Array.isArray(conflict.cardNums) || !Array.isArray(conflict.answerHashes)) {
        throw new Error('invalid Q&A conflict');
      }
      for (const hash of conflict.answerHashes) assertHash(hash, 'conflict answerHash');
    }
  }
}

export function parseQaAnnotations(content: string, path: string): QaAnnotation[] {
  const kind: QaAnnotation['kind'] = path.startsWith('tests/') ? 'test' : 'source';
  const annotations: QaAnnotation[] = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const match = line.match(QA_ANNOTATION);
    if (!match?.[1] || !QA_ID.test(match[1])) continue;
    annotations.push({ qaId: match[1], path, line: index + 1, kind });
  }
  return annotations;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareOrdinal);
}

function classify(cardId: string, item: QaSnapshotItem, shipped: ReadonlySet<string>, deferred: ReadonlySet<string>): Classification {
  if (shipped.has(cardId) || item.cardNums.some((cardNum) => shipped.has(cardNum))) return 'shipped';
  if (deferred.has(cardId) || item.cardNums.some((cardNum) => deferred.has(cardNum))) return 'deferred';
  return 'missing';
}

export function buildQaTrace(input: {
  snapshot: QaSnapshot;
  files: Array<{ path: string; content: string }>;
  shippedCardIds: ReadonlySet<string>;
  deferredCardIds: ReadonlySet<string>;
}): QaTrace {
  validateQaSnapshot(input.snapshot);
  const snapshotItems = [...input.snapshot.items].sort((a, b) => compareOrdinal(a.qaId, b.qaId));
  const byQaId = new Map(snapshotItems.map((item) => [item.qaId, item]));
  const cardIds = new Set(snapshotItems.map((item) => item.cardId));
  const annotations = input.files
    .flatMap((file) => parseQaAnnotations(file.content, file.path))
    .sort((a, b) => compareOrdinal(a.path, b.path) || a.line - b.line || compareOrdinal(a.qaId, b.qaId));

  for (const annotation of annotations) {
    if (byQaId.has(annotation.qaId)) continue;
    const cardId = annotation.qaId.match(QA_ID)?.[1] ?? '';
    if (cardIds.has(cardId)) throw new Error(`Q&A digest drift for ${cardId}: ${annotation.qaId}`);
    throw new Error(`dangling Q&A annotation for ${cardId}: ${annotation.qaId}`);
  }

  const refs = new Map<string, QaAnnotation[]>();
  for (const annotation of annotations) {
    const current = refs.get(annotation.qaId) ?? [];
    current.push(annotation);
    refs.set(annotation.qaId, current);
  }
  const issues: Issue[] = [];
  const traceItems = snapshotItems.map((item) => {
    const itemRefs = refs.get(item.qaId) ?? [];
    const sourceRefs = sortedUnique(itemRefs.filter((ref) => ref.kind === 'source').map((ref) => `${ref.path}:${ref.line}`));
    const testRefs = sortedUnique(itemRefs.filter((ref) => ref.kind === 'test').map((ref) => `${ref.path}:${ref.line}`));
    if (sourceRefs.length > 0 && testRefs.length === 0) issues.push({ kind: 'missing-test', qaId: item.qaId });
    const sourcePaths = new Set(itemRefs.map((ref) => ref.path));
    for (const path of sourcePaths) {
      if (itemRefs.filter((ref) => ref.path === path).length > 1) issues.push({ kind: 'duplicate-annotation', qaId: item.qaId, path });
    }
    return {
      ...item,
      cardNums: sortedUnique(item.cardNums),
      classification: classify(item.cardId, item, input.shippedCardIds, input.deferredCardIds),
      sourceRefs,
      testRefs,
    };
  });
  issues.sort((a, b) => compareOrdinal(a.qaId, b.qaId) || compareOrdinal(a.kind, b.kind) || ('path' in a && 'path' in b ? compareOrdinal(a.path, b.path) : 0));
  return { source: input.snapshot.source, items: traceItems, issues };
}

function listTsFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) files.push(...listTsFiles(path));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
  }
  return files.sort((a, b) => compareOrdinal(a, b));
}

function loadTrackedSnapshot(): QaSnapshot {
  if (!existsSync(SNAPSHOT_PATH)) throw new Error('missing tracked Q&A hash snapshot; run npm run cards:qa-snapshot with local raw data');
  const snapshot: unknown = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  validateQaSnapshot(snapshot);
  return snapshot;
}

function loadDeferredCardIds(): Set<string> {
  if (!existsSync(DEFERRED_INDEX_PATH)) return new Set();
  return new Set(readFileSync(DEFERRED_INDEX_PATH, 'utf8').match(/\b[A-Z]\d{5}(?:P\d*)?\b/g) ?? []);
}

function loadShippedCardIds(): Set<string> {
  const ids = new Set<string>();
  for (const card of ALL_CARDS) {
    ids.add(card.id);
    for (const no of card.no.split('/')) ids.add(no);
  }
  return ids;
}

function manifest(trace: QaTrace): string {
  return `${JSON.stringify({ schemaVersion: 1, ...trace }, null, 2)}\n`;
}

function renderTrace(trace: QaTrace): string {
  const sourceHash = computeLogicalTextSourceHash([
    { logicalPath: '.claude/specs/cards-data/qa-hash-snapshot.json', content: JSON.stringify(trace.source) + JSON.stringify(trace.items) },
  ]);
  const header = renderHeader({
    title: 'Official Q&A hash-only trace',
    generator: 'scripts/gen-docs/gen-qa-trace.ts',
    regenerateCmd: 'npm run docs:qa-trace',
    sourceFiles: [],
    sourceHash,
    description: 'Tracked Q&A identifiers and digests only. Official question and answer bodies are intentionally excluded.',
  });
  const counts = new Map<Classification, number>([['shipped', 0], ['deferred', 0], ['missing', 0]]);
  for (const item of trace.items) counts.set(item.classification, (counts.get(item.classification) ?? 0) + 1);
  const lines = [
    '## Source',
    '',
    `- URL: ${trace.source.url}`,
    `- Fetched: ${trace.source.fetchedAt}`,
    '',
    '## Classification',
    '',
    `- shipped: ${counts.get('shipped') ?? 0}`,
    `- deferred: ${counts.get('deferred') ?? 0}`,
    `- missing: ${counts.get('missing') ?? 0}`,
    '',
    '## Trace',
    '',
    '| QA ID | Card | Printings | Status | Source refs | Test refs |',
    '| --- | --- | --- | --- | --- | --- |',
    ...trace.items.map((item) => `| \`${item.qaId}\` | \`${item.cardId}\` | ${item.cardNums.map((n) => `\`${n}\``).join(', ')} | ${item.classification} | ${item.sourceRefs.length} | ${item.testRefs.length} |`),
    '',
    '## Issues',
    '',
    ...(trace.issues.length === 0 ? ['- none'] : trace.issues.map((issue) => `- ${issue.kind}: \`${issue.qaId}\`${'path' in issue ? ` (${issue.path})` : ''}`)),
    '',
  ];
  return header + lines.join('\n');
}

function diffText(path: string, expected: string): boolean {
  return !existsSync(path) || readFileSync(path, 'utf8').replace(/\r\n?/g, '\n') !== expected.replace(/\r\n?/g, '\n');
}

function writeJson(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value, 'utf8');
}

export function runGenQaTrace(options: RunOptions): RunResult {
  const snapshot = loadTrackedSnapshot();
  const files = [...listTsFiles(resolve(PROJECT_ROOT, 'src')), ...listTsFiles(resolve(PROJECT_ROOT, 'tests'))]
    .map((path) => ({ path: relative(PROJECT_ROOT, path).replaceAll('\\', '/'), content: readFileSync(path, 'utf8') }));
  const trace = buildQaTrace({ snapshot, files, shippedCardIds: loadShippedCardIds(), deferredCardIds: loadDeferredCardIds() });
  const changed: string[] = [];
  const json = manifest(trace);
  if (diffText(MANIFEST_PATH, json)) {
    if (!options.checkOnly) writeJson(MANIFEST_PATH, json);
    changed.push(MANIFEST_PATH);
  }
  const markdown = renderTrace(trace);
  if (diffMarkdown(TRACE_PATH, markdown).changed) {
    if (!options.checkOnly) writeMarkdown(TRACE_PATH, markdown);
    changed.push(TRACE_PATH);
  }
  return { changedFiles: changed, totalFiles: 2 };
}
