import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { QaSnapshot } from './gen-docs/gen-qa-trace.js';

const ROOT = process.cwd();
const HASH = /^[a-f0-9]{64}$/;
const QA_ID = /^card:[^:\s]+:[a-f0-9]{64}$/;
const SHARDS = '0123456789abcdef'.split('');
export const ADJUDICATION_STATUSES = ['matched', 'test-missing', 'legacy-unreviewed', 'unmapped', 'mismatch', 'deferred', 'manual-only'] as const;
export type QaAdjudicationStatus = (typeof ADJUDICATION_STATUSES)[number];
export const ADJUDICATION_RESULTS = ['unreviewed', 'aligned', 'implementation-gap', 'test-gap', 'deferred-card', 'rule-conflict', 'needs-manual'] as const;
export type QaAdjudicationResult = (typeof ADJUDICATION_RESULTS)[number];
export const ADJUDICATION_METHODS = ['unreviewed', 'manual-semantic', 'group-equivalent', 'trace-audit'] as const;
export type QaAdjudicationMethod = (typeof ADJUDICATION_METHODS)[number];

export type QaAdjudicationItem = { qaId: string; status: QaAdjudicationStatus; result: QaAdjudicationResult; method: QaAdjudicationMethod; evidence: string[]; noteCodes?: string[] };
export type QaAdjudicationShard = { schemaVersion: 1; shard: string; items: QaAdjudicationItem[] };
export type QaRawPackage = { file: string; sha256: string; cardNumHash: string; cardNumCount: number };
export type QaAdjudicationManifest = {
  schemaVersion: 1;
  snapshot: { normalizedFaqHash: string; itemCount: number; qaIdSetHash: string; itemSetHash: string; answerSetHash: string; conflictSetHash: string };
  rawPackages: QaRawPackage[];
};

function compareOrdinal(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const delta = (a[index]?.codePointAt(0) ?? 0) - (b[index]?.codePointAt(0) ?? 0);
    if (delta) return delta;
  }
  return a.length - b.length;
}

function hash(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function assertExactKeys(value: Record<string, unknown>, allowed: readonly string[], context: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${context} contains disallowed field: ${key}`);
}

function assertHash(value: unknown, context: string): asserts value is string {
  if (typeof value !== 'string' || !HASH.test(value)) throw new Error(`invalid ${context}`);
}

/** Local hash-only snapshot guard. Kept here to avoid a runtime import cycle with trace generation. */
function validateSnapshot(value: unknown): asserts value is QaSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid Q&A snapshot');
  const snapshot = value as Record<string, unknown>;
  assertExactKeys(snapshot, ['schemaVersion', 'source', 'normalizedFaqHash', 'items', 'conflicts'], 'Q&A snapshot');
  if (snapshot.schemaVersion !== 1 || !snapshot.source || typeof snapshot.source !== 'object' || Array.isArray(snapshot.source) || !Array.isArray(snapshot.items)) throw new Error('invalid Q&A snapshot');
  const source = snapshot.source as Record<string, unknown>;
  assertExactKeys(source, ['url', 'fetchedAt'], 'Q&A snapshot source');
  if (typeof source.url !== 'string' || !source.url || typeof source.fetchedAt !== 'string' || !source.fetchedAt) throw new Error('invalid Q&A snapshot source');
  assertHash(snapshot.normalizedFaqHash, 'Q&A normalizedFaqHash');
  const ids = new Set<string>();
  for (const candidate of snapshot.items) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('invalid Q&A snapshot item');
    const item = candidate as Record<string, unknown>;
    assertExactKeys(item, ['qaId', 'cardId', 'cardNums', 'sectionHash', 'questionHash', 'answerHash'], 'Q&A snapshot item');
    if (typeof item.qaId !== 'string' || !QA_ID.test(item.qaId) || typeof item.cardId !== 'string' || !Array.isArray(item.cardNums) || item.cardNums.some((cardNum) => typeof cardNum !== 'string') || ids.has(item.qaId)) throw new Error('invalid Q&A snapshot item');
    ids.add(item.qaId);
    assertHash(item.sectionHash, 'Q&A sectionHash');
    assertHash(item.questionHash, 'Q&A questionHash');
    assertHash(item.answerHash, 'Q&A answerHash');
  }
  if (snapshot.conflicts !== undefined && !Array.isArray(snapshot.conflicts)) throw new Error('invalid Q&A conflicts');
}

export function qaShard(qaId: string): string {
  return hash(qaId)[0]!;
}

function qaIdSetHash(qaIds: readonly string[]): string {
  return hash([...qaIds].sort(compareOrdinal).join('\n'));
}

function snapshotHashes(snapshot: QaSnapshot): QaAdjudicationManifest['snapshot'] {
  const items = [...snapshot.items].map((item) => ({ ...item, cardNums: [...item.cardNums].sort(compareOrdinal) })).sort((a, b) => compareOrdinal(a.qaId, b.qaId));
  const conflicts = [...(snapshot.conflicts ?? [])].map((conflict) => ({ ...conflict, cardNums: [...conflict.cardNums].sort(compareOrdinal), answerHashes: [...conflict.answerHashes].sort(compareOrdinal) })).sort((a, b) => compareOrdinal(a.qaId, b.qaId));
  return {
    normalizedFaqHash: snapshot.normalizedFaqHash,
    itemCount: items.length,
    qaIdSetHash: qaIdSetHash(items.map((item) => item.qaId)),
    itemSetHash: hash(JSON.stringify(items)),
    answerSetHash: hash(JSON.stringify(items.map((item) => [`${item.cardId}\u0000${item.sectionHash}\u0000${item.questionHash}`, item.answerHash]))),
    conflictSetHash: hash(JSON.stringify(conflicts)),
  };
}

function assertStatus(value: unknown, context: string): asserts value is QaAdjudicationStatus {
  if (!ADJUDICATION_STATUSES.includes(value as QaAdjudicationStatus)) throw new Error(`invalid adjudication status: ${context}`);
}

function assertResult(value: unknown, context: string): asserts value is QaAdjudicationResult {
  if (!ADJUDICATION_RESULTS.includes(value as QaAdjudicationResult)) throw new Error(`invalid adjudication result: ${context}`);
}

function assertMethod(value: unknown, context: string): asserts value is QaAdjudicationMethod {
  if (!ADJUDICATION_METHODS.includes(value as QaAdjudicationMethod)) throw new Error(`invalid adjudication method: ${context}`);
}

function validateRawPackages(value: unknown): asserts value is QaRawPackage[] {
  if (!Array.isArray(value)) throw new Error('invalid adjudication raw packages');
  const names = new Set<string>();
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('invalid adjudication raw package');
    const item = candidate as Record<string, unknown>;
    assertExactKeys(item, ['file', 'sha256', 'cardNumHash', 'cardNumCount'], 'adjudication raw package');
    if (typeof item.file !== 'string' || !/^[a-z0-9-]+-api\.json$/.test(item.file) || names.has(item.file)) throw new Error('invalid adjudication raw package file');
    names.add(item.file);
    assertHash(item.sha256, 'adjudication raw package sha256');
    assertHash(item.cardNumHash, 'adjudication raw package cardNumHash');
    if (!Number.isInteger(item.cardNumCount) || Number(item.cardNumCount) < 0) throw new Error('invalid adjudication raw package cardNumCount');
  }
}

export function validateQaAdjudicationManifest(value: unknown): asserts value is QaAdjudicationManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid Q&A adjudication manifest');
  const manifest = value as Record<string, unknown>;
  assertExactKeys(manifest, ['schemaVersion', 'snapshot', 'rawPackages'], 'Q&A adjudication manifest');
  if (manifest.schemaVersion !== 1 || !manifest.snapshot || typeof manifest.snapshot !== 'object' || Array.isArray(manifest.snapshot)) throw new Error('invalid Q&A adjudication manifest');
  const snapshot = manifest.snapshot as Record<string, unknown>;
  assertExactKeys(snapshot, ['normalizedFaqHash', 'itemCount', 'qaIdSetHash', 'itemSetHash', 'answerSetHash', 'conflictSetHash'], 'Q&A adjudication manifest snapshot');
  assertHash(snapshot.normalizedFaqHash, 'adjudication normalizedFaqHash');
  assertHash(snapshot.qaIdSetHash, 'adjudication qaIdSetHash');
  assertHash(snapshot.itemSetHash, 'adjudication itemSetHash');
  assertHash(snapshot.answerSetHash, 'adjudication answerSetHash');
  assertHash(snapshot.conflictSetHash, 'adjudication conflictSetHash');
  if (!Number.isInteger(snapshot.itemCount) || Number(snapshot.itemCount) < 0) throw new Error('invalid adjudication itemCount');
  validateRawPackages(manifest.rawPackages);
}

export function validateQaAdjudicationShard(value: unknown): asserts value is QaAdjudicationShard {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid Q&A adjudication shard');
  const shard = value as Record<string, unknown>;
  assertExactKeys(shard, ['schemaVersion', 'shard', 'items'], 'Q&A adjudication shard');
  if (shard.schemaVersion !== 1 || typeof shard.shard !== 'string' || !SHARDS.includes(shard.shard) || !Array.isArray(shard.items)) throw new Error('invalid Q&A adjudication shard');
  let previous = '';
  const ids = new Set<string>();
  for (const candidate of shard.items) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('invalid Q&A adjudication item');
    const item = candidate as Record<string, unknown>;
    assertExactKeys(item, ['qaId', 'status', 'result', 'method', 'evidence', 'noteCodes'], 'Q&A adjudication item');
    if (typeof item.qaId !== 'string' || !QA_ID.test(item.qaId) || qaShard(item.qaId) !== shard.shard) throw new Error(`invalid adjudication shard membership: ${String(item.qaId)}`);
    assertStatus(item.status, item.qaId);
    assertResult(item.result, item.qaId);
    assertMethod(item.method, item.qaId);
    const evidence = item.evidence;
    if (!Array.isArray(evidence) || evidence.some((reference) => typeof reference !== 'string' || !/^(?:rules|src|tests|deferred):[A-Za-z0-9_./#:-]+$/.test(reference))) throw new Error(`invalid adjudication evidence: ${item.qaId}`);
    if (new Set(evidence).size !== evidence.length || [...evidence].sort(compareOrdinal).some((reference, index) => reference !== evidence[index])) throw new Error(`non-canonical adjudication evidence: ${item.qaId}`);
    const noteCodes = item.noteCodes;
    if (noteCodes !== undefined && (!Array.isArray(noteCodes) || noteCodes.some((code) => typeof code !== 'string' || !/^[A-Z][A-Z0-9-]*$/.test(code)) || new Set(noteCodes).size !== noteCodes.length || [...noteCodes].sort(compareOrdinal).some((code, index) => code !== noteCodes[index]))) throw new Error(`invalid adjudication noteCodes: ${item.qaId}`);
    if (item.result === 'unreviewed') {
      if (item.status !== 'legacy-unreviewed' || item.method !== 'unreviewed' || evidence.length || noteCodes?.length) throw new Error(`unreviewed adjudication must remain empty and legacy: ${item.qaId}`);
    } else if (item.method === 'unreviewed' || evidence.length === 0) {
      throw new Error(`reviewed adjudication requires controlled method and evidence: ${item.qaId}`);
    }
    if (item.status !== 'legacy-unreviewed' && item.result === 'unreviewed') throw new Error(`reviewed coverage requires adjudication result: ${item.qaId}`);
    if (ids.has(item.qaId)) throw new Error(`duplicate adjudication qaId: ${item.qaId}`);
    ids.add(item.qaId);
    if (previous && compareOrdinal(previous, item.qaId) >= 0) throw new Error(`non-canonical adjudication order: ${item.qaId}`);
    previous = item.qaId;
  }
}

export function buildQaAdjudication(input: { snapshot: QaSnapshot; rawPackages: QaRawPackage[] }): { manifest: QaAdjudicationManifest; shards: QaAdjudicationShard[] } {
  validateSnapshot(input.snapshot);
  validateRawPackages(input.rawPackages);
  const qaIds = input.snapshot.items.map((item) => item.qaId).sort(compareOrdinal);
  return {
    manifest: {
      schemaVersion: 1,
      snapshot: snapshotHashes(input.snapshot),
      rawPackages: [...input.rawPackages].sort((a, b) => compareOrdinal(a.file, b.file)),
    },
    shards: SHARDS.map((shard) => ({
      schemaVersion: 1,
      shard,
      items: qaIds.filter((qaId) => qaShard(qaId) === shard).map((qaId) => ({ qaId, status: 'legacy-unreviewed', result: 'unreviewed', method: 'unreviewed', evidence: [] })),
    })),
  };
}

function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(`missing tracked file: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function pathAt(root: string, ...parts: string[]): string {
  return resolve(root, '.claude/specs/qa-adjudication', ...parts);
}

function rawPackageMetadata(root: string): QaRawPackage[] {
  const rawRoot = resolve(root, '.claude/specs/cards-data/_raw');
  if (!existsSync(rawRoot)) return [];
  return readdirSync(rawRoot).filter((file) => file.endsWith('-api.json')).sort(compareOrdinal).map((file) => {
    const bytes = readFileSync(resolve(rawRoot, file));
    const raw: unknown = JSON.parse(bytes.toString('utf8'));
    if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { data?: unknown }).data)) throw new Error(`invalid local raw package: ${file}`);
    const cardNums = (raw as { data: unknown[] }).data.map((card) => String((card as { card_num?: unknown })?.card_num ?? '').trim());
    if (cardNums.some((cardNum) => !cardNum)) throw new Error(`invalid local raw card number: ${file}`);
    return { file, sha256: hash(bytes), cardNumHash: hash(cardNums.sort(compareOrdinal).join('\n')), cardNumCount: cardNums.length };
  });
}

function validateLocalRaw(root: string, expected: readonly QaRawPackage[]): void {
  const found = rawPackageMetadata(root);
  const actual = new Map(found.map((item) => [item.file, item]));
  for (const pkg of expected) {
    const current = actual.get(pkg.file);
    if (!current) throw new Error(`local raw package missing: ${pkg.file}`);
    if (current.sha256 !== pkg.sha256 || current.cardNumHash !== pkg.cardNumHash || current.cardNumCount !== pkg.cardNumCount) throw new Error(`local raw package drift: ${pkg.file}`);
  }
  if (actual.size !== expected.length) throw new Error('local raw package set drift');
}

export function mergeQaAdjudication(options: { root?: string; check?: boolean; requireReviewed?: boolean; withLocalRaw?: boolean } = {}): { manifest: QaAdjudicationManifest; statuses: Record<string, QaAdjudicationStatus>; results: Record<string, QaAdjudicationResult>; allAdjudicated: boolean } {
  const root = resolve(options.root ?? ROOT);
  const snapshot = readJson(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'));
  validateSnapshot(snapshot);
  const manifest = readJson(pathAt(root, 'manifest.json'));
  validateQaAdjudicationManifest(manifest);
  const shards = SHARDS.map((name) => {
    const shard = readJson(pathAt(root, `${name}.json`));
    validateQaAdjudicationShard(shard);
    if (shard.shard !== name) throw new Error(`adjudication shard filename mismatch: ${name}`);
    return shard;
  });
  const items = shards.flatMap((shard) => shard.items);
  const expectedIds = snapshot.items.map((item) => item.qaId).sort(compareOrdinal);
  const actualIds = items.map((item) => item.qaId).sort(compareOrdinal);
  if (actualIds.length !== expectedIds.length || actualIds.some((qaId, index) => qaId !== expectedIds[index])) throw new Error('adjudication shard union does not match tracked snapshot exactly once');
  const expectedSnapshot = snapshotHashes(snapshot);
  if (JSON.stringify(manifest.snapshot) !== JSON.stringify(expectedSnapshot)) throw new Error('adjudication manifest aggregate snapshot hash drift');
  if (options.withLocalRaw) validateLocalRaw(root, manifest.rawPackages);
  const statuses = Object.fromEntries(items.map((item) => [item.qaId, item.status]));
  const results = Object.fromEntries(items.map((item) => [item.qaId, item.result]));
  const allAdjudicated = items.every((item) => item.result !== 'unreviewed' && item.result !== 'needs-manual');
  if (options.requireReviewed && (!allAdjudicated || items.some((item) => item.status === 'legacy-unreviewed'))) throw new Error('unreviewed, needs-manual, or legacy-unreviewed adjudications remain; --require-reviewed failed');
  return { manifest, statuses, results, allAdjudicated };
}

function writeBootstrap(root: string): void {
  const snapshot = readJson(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'));
  validateSnapshot(snapshot);
  const built = buildQaAdjudication({ snapshot, rawPackages: rawPackageMetadata(root) });
  mkdirSync(pathAt(root), { recursive: true });
  writeFileSync(pathAt(root, 'manifest.json'), `${JSON.stringify(built.manifest, null, 2)}\n`);
  for (const shard of built.shards) writeFileSync(pathAt(root, `${shard.shard}.json`), `${JSON.stringify(shard, null, 2)}\n`);
}

function main(): void {
  try {
    const bootstrap = process.argv.includes('--bootstrap');
    if (bootstrap) writeBootstrap(ROOT);
    const result = mergeQaAdjudication({ root: ROOT, check: process.argv.includes('--check'), requireReviewed: process.argv.includes('--require-reviewed'), withLocalRaw: process.argv.includes('--with-local-raw') });
    process.stdout.write(`[qa:adjudication] items=${Object.keys(result.statuses).length} all-adjudicated=${result.allAdjudicated}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
