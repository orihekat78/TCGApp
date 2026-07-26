import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import type { QaSnapshot } from './gen-docs/gen-qa-trace.js';

const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const SOURCE_CORPUS_CACHE = new Map<string, string>();
const HASH = /^[a-f0-9]{64}$/;
const QA_ID = /^card:[^:\s]+:[a-f0-9]{64}$/;
const SHARDS = '0123456789abcdef'.split('');
export const ADJUDICATION_STATUSES = ['matched', 'test-missing', 'legacy-unreviewed', 'unmapped', 'mismatch', 'deferred', 'manual-only'] as const;
export type QaAdjudicationStatus = (typeof ADJUDICATION_STATUSES)[number];
export const ADJUDICATION_RESULTS = ['unreviewed', 'aligned', 'implementation-gap', 'test-gap', 'deferred-card', 'rule-conflict', 'needs-manual'] as const;
export type QaAdjudicationResult = (typeof ADJUDICATION_RESULTS)[number];
export const ADJUDICATION_METHODS = ['unreviewed', 'manual-semantic', 'group-equivalent', 'trace-audit'] as const;
export type QaAdjudicationMethod = (typeof ADJUDICATION_METHODS)[number];
const COMPATIBLE_STATUS: Readonly<Record<QaAdjudicationResult, ReadonlySet<QaAdjudicationStatus>>> = {
  unreviewed: new Set(['legacy-unreviewed']),
  aligned: new Set(['matched']),
  'test-gap': new Set(['test-missing']),
  'implementation-gap': new Set(['mismatch', 'unmapped']),
  'deferred-card': new Set(['deferred']),
  'rule-conflict': new Set(['manual-only']),
  'needs-manual': new Set(['manual-only']),
};

export type QaAdjudicationItem = { qaId: string; answerHash: string; status: QaAdjudicationStatus; result: QaAdjudicationResult; method: QaAdjudicationMethod; evidence: string[]; noteCodes?: string[] };
export type QaAdjudicationShard = { schemaVersion: 1; shard: string; items: QaAdjudicationItem[] };
export type QaRawPackage = { file: string; sha256: string; cardNumHash: string; cardNumCount: number };
export type QaAdjudicationManifest = {
  schemaVersion: 1;
  snapshot: { normalizedFaqHash: string; itemCount: number; qaIdSetHash: string; itemSetHash: string; answerSetHash: string; conflictSetHash: string };
  rawPackages: QaRawPackage[];
};
export type QaAdjudicationQueueItem = {
  qaId: string;
  cardId: string;
  sectionHash: string;
  questionHash: string;
  answerHash: string;
  evidence: string[];
  candidateGroup: { key: string; size: number };
  groupEquivalentEligible: boolean;
};
export type QaAdjudicationQueue = { total: number; unreviewedCount: number; shards: Array<{ shard: string; unreviewedCount: number; items: QaAdjudicationQueueItem[] }> };

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
    assertExactKeys(item, ['qaId', 'answerHash', 'status', 'result', 'method', 'evidence', 'noteCodes'], 'Q&A adjudication item');
    if (typeof item.qaId !== 'string' || !QA_ID.test(item.qaId) || qaShard(item.qaId) !== shard.shard) throw new Error(`invalid adjudication shard membership: ${String(item.qaId)}`);
    assertHash(item.answerHash, `adjudication answerHash: ${item.qaId}`);
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
    if (!COMPATIBLE_STATUS[item.result].has(item.status)) throw new Error(`incompatible adjudication status/result: ${item.qaId}`);
    if (ids.has(item.qaId)) throw new Error(`duplicate adjudication qaId: ${item.qaId}`);
    ids.add(item.qaId);
    if (previous && compareOrdinal(previous, item.qaId) >= 0) throw new Error(`non-canonical adjudication order: ${item.qaId}`);
    previous = item.qaId;
  }
}

function assertEvidencePath(root: string, category: 'rules' | 'src' | 'tests', path: string, line: string): { content: string; path: string } {
  if (!/^[1-9]\d*$/.test(line) || path.includes('..') || path.includes('\\')) throw new Error(`invalid adjudication evidence path: ${category}:${path}:${line}`);
  const allowed = category === 'rules'
    ? /^\.claude\/rules\/[^/]+\.md$/.test(path)
    : category === 'src'
      ? /^src\/(?:[^/]+\/)*[^/]+\.tsx?$/.test(path)
      : /^tests\/(?:[^/]+\/)*[^/]+\.tsx?$/.test(path);
  if (!allowed) throw new Error(`invalid adjudication evidence category path: ${category}:${path}`);
  const target = resolve(root, path);
  if (relative(root, target).startsWith('..') || !existsSync(target)) throw new Error(`missing adjudication evidence target: ${category}:${path}`);
  const lines = readFileSync(target, 'utf8').replace(/\r\n?/g, '\n').split('\n');
  const cited = lines[Number(line) - 1] ?? '';
  if (!cited.trim()) throw new Error(`blank adjudication evidence line: ${category}:${path}:${line}`);
  if (category === 'tests' && !/\b(?:expect\s*\(|assert(?:\s*\(|\.))/.test(cited)) throw new Error(`test evidence must contain assertion: ${path}:${line}`);
  return { content: lines.slice(Math.max(0, Number(line) - 13), Number(line) + 12).join('\n'), path };
}

function sourceMentionsCard(root: string, item: QaSnapshot['items'][number]): boolean {
  const corpus = SOURCE_CORPUS_CACHE.get(root) ?? (() => {
    const visit = (dir: string): string[] => !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return visit(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [path, readFileSync(path, 'utf8')].join('\n') : [];
  });
    const value = visit(resolve(root, 'src')).join('\n');
    SOURCE_CORPUS_CACHE.set(root, value);
    return value;
  })();
  return [item.cardId, ...item.cardNums].some((value) => containsIdentifier(corpus, value));
}

function containsIdentifier(text: string, value: string): boolean {
  return new RegExp(`(?<![A-Za-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`).test(text);
}

function deferredIndexMentions(root: string, cardId: string): boolean {
  const index = resolve(root, '.claude/specs/DEFERRED-INDEX.md');
  return existsSync(index) && containsIdentifier(readFileSync(index, 'utf8'), cardId);
}

function validateReviewedEvidence(root: string, item: QaAdjudicationItem, snapshotItem: QaSnapshot['items'][number], snapshot: QaSnapshot): void {
  if (item.result === 'unreviewed') return;
  const resolved = item.evidence.map((reference) => {
    const match = reference.match(/^(rules|src|tests):(.+):(\d+)$/);
    if (match?.[1] && match[2] && match[3]) return assertEvidencePath(root, match[1] as 'rules' | 'src' | 'tests', match[2], match[3]);
    const deferred = reference.match(/^deferred:([^:\s]+)$/);
    if (!deferred?.[1] || deferred[1] !== snapshotItem.cardId) throw new Error(`invalid adjudication evidence reference: ${reference}`);
    const index = resolve(root, '.claude/specs/DEFERRED-INDEX.md');
    if (!existsSync(index) || !deferredIndexMentions(root, deferred[1])) throw new Error(`missing deferred adjudication evidence: ${deferred[1]}`);
    return { content: deferred[1], path: 'deferred' };
  });
  const has = (category: 'rules' | 'src' | 'tests' | 'deferred') => item.evidence.some((reference) => reference.startsWith(`${category}:`));
  if (item.result === 'aligned' && (!has('src') || !has('tests'))) throw new Error(`aligned adjudication requires src and assertion-test evidence: ${item.qaId}`);
  if (item.result === 'test-gap' && (!has('src') || has('tests'))) throw new Error(`test-gap adjudication requires src evidence and no test evidence: ${item.qaId}`);
  if (item.result === 'implementation-gap' && item.status !== 'unmapped' && !has('src')) throw new Error(`implementation-gap adjudication requires src evidence: ${item.qaId}`);
  if (item.result === 'deferred-card' && (item.evidence.length !== 1 || item.evidence[0] !== `deferred:${snapshotItem.cardId}`)) throw new Error(`deferred-card adjudication requires exactly matching deferred evidence: ${item.qaId}`);
  if ((item.result === 'rule-conflict' || item.result === 'needs-manual') && !has('rules')) throw new Error(`rule adjudication requires rules evidence: ${item.qaId}`);
  const context = [snapshotItem.cardId, ...snapshotItem.cardNums];
  const boundTo = (reference: { content: string; path: string }, values: readonly string[]) => values.some((value) => containsIdentifier(reference.path, value) || containsIdentifier(reference.content, value));
  const sourceBound = resolved.some((reference) => reference.path.startsWith('src/') && boundTo(reference, context));
  const testBound = resolved.some((reference) => reference.path.startsWith('tests/') && boundTo(reference, context));
  const unmapped = item.result === 'implementation-gap' && item.status === 'unmapped';
  if (unmapped) {
    if (has('src') || has('tests') || !has('rules') || !item.noteCodes?.includes('UNIMPLEMENTED-CARD') || sourceMentionsCard(root, snapshotItem) || deferredIndexMentions(root, snapshotItem.cardId)) throw new Error(`unmapped implementation-gap requires absent non-deferred card and UNIMPLEMENTED-CARD evidence: ${item.qaId}`);
  } else if (item.method === 'manual-semantic' && item.result !== 'deferred-card' && !sourceBound) {
    throw new Error(`manual-semantic requires card-bound source evidence: ${item.qaId}`);
  }
  if (item.result === 'aligned' && item.method !== 'group-equivalent' && !testBound) throw new Error(`aligned adjudication requires card-bound assertion test evidence: ${item.qaId}`);
  if (item.method !== 'group-equivalent') return;
  const equivalent = snapshot.items.filter((candidate) => candidate.sectionHash === snapshotItem.sectionHash && candidate.questionHash === snapshotItem.questionHash && candidate.answerHash === snapshotItem.answerHash);
  if (equivalent.length < 2) throw new Error(`group-equivalent requires multiple Q&A items: ${item.qaId}`);
  const groupIds = equivalent.flatMap((candidate) => [candidate.cardId, ...candidate.cardNums]);
  if (item.result === 'aligned' && !resolved.some((reference) => reference.path.startsWith('tests/') && boundTo(reference, groupIds))) throw new Error(`group-equivalent aligned requires member-bound assertion test evidence: ${item.qaId}`);
  if (!sourceBound && !resolved.some((reference) => reference.path === 'deferred')) throw new Error(`group-equivalent requires card-context evidence: ${item.qaId}`);
}

export function buildQaAdjudication(input: { snapshot: QaSnapshot; rawPackages: QaRawPackage[] }): { manifest: QaAdjudicationManifest; shards: QaAdjudicationShard[] } {
  validateSnapshot(input.snapshot);
  validateRawPackages(input.rawPackages);
  return {
    manifest: {
      schemaVersion: 1,
      snapshot: snapshotHashes(input.snapshot),
      rawPackages: [...input.rawPackages].sort((a, b) => compareOrdinal(a.file, b.file)),
    },
    shards: SHARDS.map((shard) => ({
      schemaVersion: 1,
      shard,
      items: input.snapshot.items.filter((item) => qaShard(item.qaId) === shard).sort((a, b) => compareOrdinal(a.qaId, b.qaId)).map((item) => ({ qaId: item.qaId, answerHash: item.answerHash, status: 'legacy-unreviewed', result: 'unreviewed', method: 'unreviewed', evidence: [] })),
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

/** Read-only hash-only work queue. Does not touch ignored raw data or adjudication files. */
export function readQaAdjudicationQueue(options: { root?: string } = {}): QaAdjudicationQueue {
  const root = resolve(options.root ?? ROOT);
  const snapshot = readJson(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'));
  validateSnapshot(snapshot);
  const shards = SHARDS.map((name) => {
    const shard = readJson(pathAt(root, `${name}.json`));
    validateQaAdjudicationShard(shard);
    if (shard.shard !== name) throw new Error(`adjudication shard filename mismatch: ${name}`);
    return shard;
  });
  const shardItems = shards.flatMap((shard) => shard.items);
  const snapshotById = new Map(snapshot.items.map((item) => [item.qaId, item]));
  const expectedIds = [...snapshotById.keys()].sort(compareOrdinal);
  const actualIds = shardItems.map((item) => item.qaId).sort(compareOrdinal);
  if (actualIds.length !== expectedIds.length || actualIds.some((qaId, index) => qaId !== expectedIds[index])) throw new Error('adjudication shard union does not match tracked snapshot exactly once');
  const groups = new Map<string, QaSnapshot['items']>();
  for (const item of snapshot.items) {
    const key = hash(`${item.sectionHash}\u0000${item.questionHash}\u0000${item.answerHash}`);
    const members = groups.get(key) ?? [];
    members.push(item);
    groups.set(key, members);
  }
  const queueShards = shards.map((shard) => {
    const items = shard.items.map((adjudication) => {
      const snapshotItem = snapshotById.get(adjudication.qaId);
      if (!snapshotItem || adjudication.answerHash !== snapshotItem.answerHash) throw new Error(`adjudication answer hash drift: ${adjudication.qaId}`);
      const key = hash(`${snapshotItem.sectionHash}\u0000${snapshotItem.questionHash}\u0000${snapshotItem.answerHash}`);
      const members = groups.get(key)!;
      return {
        qaId: snapshotItem.qaId,
        cardId: snapshotItem.cardId,
        sectionHash: snapshotItem.sectionHash,
        questionHash: snapshotItem.questionHash,
        answerHash: snapshotItem.answerHash,
        evidence: [...adjudication.evidence],
        candidateGroup: { key, size: members.length },
        groupEquivalentEligible: members.length >= 2 && members.every((member) => qaShard(member.qaId) === shard.shard),
      };
    });
    return { shard: shard.shard, unreviewedCount: shard.items.filter((item) => item.result === 'unreviewed').length, items };
  });
  return { total: shardItems.length, unreviewedCount: shardItems.filter((item) => item.result === 'unreviewed').length, shards: queueShards };
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

/** Rebuild the hash-only snapshot from ignored raw data so package hashes cannot be spliced from another corpus. */
function validateLocalRawSnapshot(root: string, snapshot: QaSnapshot): void {
  const { buildQaHashSnapshot } = require('./cards/write-qa-hash-snapshot.cjs') as { buildQaHashSnapshot: (projectRoot: string) => QaSnapshot };
  const rebuilt = buildQaHashSnapshot(root);
  if (JSON.stringify(rebuilt) !== JSON.stringify(snapshot)) throw new Error('local raw Q&A snapshot drift');
}

export function mergeQaAdjudication(options: { root?: string; check?: boolean; requireReviewed?: boolean; withLocalRaw?: boolean } = {}): { manifest: QaAdjudicationManifest; statuses: Record<string, QaAdjudicationStatus>; results: Record<string, QaAdjudicationResult>; methods: Record<string, QaAdjudicationMethod>; evidence: Record<string, string[]>; allAdjudicated: boolean } {
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
  const snapshotById = new Map(snapshot.items.map((item) => [item.qaId, item]));
  for (const item of items) {
    const snapshotItem = snapshotById.get(item.qaId)!;
    if (item.answerHash !== snapshotItem.answerHash) throw new Error(`adjudication answer hash drift: ${item.qaId}`);
    validateReviewedEvidence(root, item, snapshotItem, snapshot);
  }
  const expectedSnapshot = snapshotHashes(snapshot);
  if (JSON.stringify(manifest.snapshot) !== JSON.stringify(expectedSnapshot)) throw new Error('adjudication manifest aggregate snapshot hash drift');
  if (options.withLocalRaw) {
    validateLocalRaw(root, manifest.rawPackages);
    validateLocalRawSnapshot(root, snapshot);
  }
  const statuses = Object.fromEntries(items.map((item) => [item.qaId, item.status]));
  const results = Object.fromEntries(items.map((item) => [item.qaId, item.result]));
  const methods = Object.fromEntries(items.map((item) => [item.qaId, item.method]));
  const evidence = Object.fromEntries(items.map((item) => [item.qaId, item.evidence]));
  const allAdjudicated = items.every((item) => item.result !== 'unreviewed' && item.result !== 'needs-manual');
  if (options.requireReviewed && (!allAdjudicated || items.some((item) => item.status === 'legacy-unreviewed' || (item.method !== 'manual-semantic' && item.method !== 'group-equivalent')))) throw new Error('unreviewed, needs-manual, trace-audit, or legacy-unreviewed adjudications remain; --require-reviewed failed');
  return { manifest, statuses, results, methods, evidence, allAdjudicated };
}

export function writeQaAdjudicationBootstrap(root: string, force = false): void {
  if (existsSync(pathAt(root, 'manifest.json')) && !force) throw new Error('adjudication shards already exist; use --force only for initial/reset bootstrap');
  const snapshot = readJson(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'));
  validateSnapshot(snapshot);
  const built = buildQaAdjudication({ snapshot, rawPackages: rawPackageMetadata(root) });
  mkdirSync(pathAt(root), { recursive: true });
  writeFileSync(pathAt(root, 'manifest.json'), `${JSON.stringify(built.manifest, null, 2)}\n`);
  for (const shard of built.shards) writeFileSync(pathAt(root, `${shard.shard}.json`), `${JSON.stringify(shard, null, 2)}\n`);
}

function main(): void {
  try {
    const args = process.argv.slice(2);
    const exact = (...expected: string[]) => args.length === expected.length && args.every((arg, index) => arg === expected[index]);
    if (exact('--queue')) {
      process.stdout.write(`${JSON.stringify(readQaAdjudicationQueue({ root: ROOT }))}\n`);
      return;
    }
    if (exact('--bootstrap') || exact('--bootstrap', '--force')) {
      writeQaAdjudicationBootstrap(ROOT, args.includes('--force'));
      const result = mergeQaAdjudication({ root: ROOT });
      process.stdout.write(`[qa:adjudication] items=${Object.keys(result.statuses).length} all-adjudicated=${result.allAdjudicated}\n`);
      return;
    }
    if (exact('--check') || exact('--check', '--require-reviewed') || exact('--check', '--with-local-raw') || exact('--check', '--with-local-raw', '--require-reviewed')) {
      const result = mergeQaAdjudication({ root: ROOT, check: true, requireReviewed: args.includes('--require-reviewed'), withLocalRaw: args.includes('--with-local-raw') });
      process.stdout.write(`[qa:adjudication] items=${Object.keys(result.statuses).length} all-adjudicated=${result.allAdjudicated}\n`);
      return;
    }
    throw new Error('invalid Q&A adjudication CLI arguments');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
