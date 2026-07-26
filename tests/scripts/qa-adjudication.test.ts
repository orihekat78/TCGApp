import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildQaAdjudication,
  readQaAdjudicationQueue,
  mergeQaAdjudication,
  qaShard,
  writeQaAdjudicationBootstrap,
  type QaAdjudicationManifest,
  type QaAdjudicationShard,
} from '../../scripts/qa-adjudication.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const roots: string[] = [];

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function snapshotItems() {
  return [
    { qaId: `card:one:${HASH_A}`, cardId: 'one', cardNums: ['ONE'], sectionHash: HASH_A, questionHash: HASH_A, answerHash: HASH_A },
    { qaId: `card:two:${HASH_B}`, cardId: 'two', cardNums: ['TWO'], sectionHash: HASH_B, questionHash: HASH_B, answerHash: HASH_B },
  ];
}

function qaIdForShard(cardId: string, shard: string, offset = 0): string {
  for (let index = offset; ; index += 1) {
    const qaId = `card:${cardId}:${hash(`${cardId}:${index}`)}`;
    if (qaShard(qaId) === shard) return qaId;
  }
}

function fixture(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'conan-qa-adjudication-'));
  roots.push(root);
  const data = resolve(root, '.claude/specs/cards-data');
  const snapshot = {
    schemaVersion: 1,
    source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' },
    normalizedFaqHash: HASH_A,
    items: snapshotItems(),
    conflicts: [],
  };
  const status = { schemaVersion: 1, source: snapshot.source, hashes: { normalizedFaq: HASH_A } };
  mkdirSync(data, { recursive: true });
  writeFileSync(resolve(data, 'qa-hash-snapshot.json'), JSON.stringify(snapshot));
  writeFileSync(resolve(data, 'status.json'), JSON.stringify(status));
  mkdirSync(resolve(root, '.claude/rules'), { recursive: true });
  mkdirSync(resolve(root, 'src'), { recursive: true });
  mkdirSync(resolve(root, 'tests'), { recursive: true });
  writeFileSync(resolve(root, '.claude/rules/rule.md'), 'rule evidence\n');
  writeFileSync(resolve(root, 'src/one.ts'), 'export const one = true;\n');
  writeFileSync(resolve(root, 'tests/one.test.ts'), 'expect(one).toBe(true);\n');
  writeFileSync(resolve(root, 'src/generic.ts'), 'export const generic = true;\n');
  writeFileSync(resolve(root, 'tests/generic.test.ts'), 'expect(generic).toBe(true);\n');
  writeFileSync(resolve(root, '.claude/specs/DEFERRED-INDEX.md'), 'one\n');
  return root;
}

function writeShard(root: string, shard: string, items: QaAdjudicationShard['items']): void {
  const path = resolve(root, '.claude/specs/qa-adjudication', `${shard}.json`);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, shard, items }, null, 2)}\n`);
}

function runCli(root: string, ...args: string[]) {
  return spawnSync(process.execPath, [resolve(process.cwd(), 'node_modules/tsx/dist/cli.mjs'), resolve(process.cwd(), 'scripts/qa-adjudication.ts'), ...args], { cwd: root, encoding: 'utf8' });
}

describe('Q&A adjudication shards', () => {
  it('builds a deterministic hash-only queue with per-shard unreviewed counts', () => {
    const root = fixture();
    const sameShard = qaShard(`card:one:${HASH_A}`);
    const items = [
      { qaId: qaIdForShard('B01001', sameShard), cardId: 'B01001', cardNums: ['B01001'], sectionHash: HASH_A, questionHash: HASH_A, answerHash: HASH_A },
      { qaId: qaIdForShard('B01002', sameShard, 1), cardId: 'B01002', cardNums: ['B01002'], sectionHash: HASH_A, questionHash: HASH_A, answerHash: HASH_A },
      { qaId: qaIdForShard('B01003', 'f'), cardId: 'B01003', cardNums: ['B01003'], sectionHash: HASH_B, questionHash: HASH_A, answerHash: HASH_A },
      { qaId: qaIdForShard('B01004', sameShard), cardId: 'B01004', cardNums: ['B01004'], sectionHash: HASH_B, questionHash: HASH_A, answerHash: HASH_A },
    ];
    const snapshot = { schemaVersion: 1 as const, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items, conflicts: [] };
    writeFileSync(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'), JSON.stringify(snapshot));
    const built = buildQaAdjudication({ snapshot, rawPackages: [] });
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((item) => item.qaId === items[1]!.qaId
      ? { ...item, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: ['src:src/one.ts:1'] }
      : item));

    const queue = readQaAdjudicationQueue({ root });
    expect(queue.total).toBe(4);
    expect(queue.unreviewedCount).toBe(3);
    expect(queue.shards.map((entry) => entry.shard)).toEqual('0123456789abcdef'.split(''));
    expect(queue.shards.flatMap((entry) => entry.items).map((item) => item.qaId)).toEqual(built.shards.flatMap((entry) => entry.items).map((item) => item.qaId));
    expect(queue.shards.find((entry) => entry.shard === sameShard)?.unreviewedCount).toBe(2);
    const grouped = queue.shards.flatMap((entry) => entry.items).filter((item) => item.cardId === 'B01001' || item.cardId === 'B01002');
    expect(grouped.map((item) => item.candidateGroup.size)).toEqual([2, 2]);
    expect(grouped.map((item) => item.groupEquivalentEligible)).toEqual([true, true]);
    expect(queue.shards.flatMap((entry) => entry.items).filter((item) => item.cardId === 'B01003' || item.cardId === 'B01004').map((item) => item.groupEquivalentEligible)).toEqual([false, false]);
    for (const item of queue.shards.flatMap((entry) => entry.items)) {
      expect(item).toEqual(expect.objectContaining({
        qaId: expect.stringMatching(/^card:[^:\s]+:[a-f0-9]{64}$/),
        cardId: expect.stringMatching(/^[A-Z0-9]+$/),
        sectionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        questionHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        answerHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        evidence: expect.any(Array),
      }));
      expect(item.evidence.every((reference) => /^(?:rules|src|tests|deferred):/.test(reference) && !/https?:\/\/|_raw\//i.test(reference))).toBe(true);
    }
    expect(JSON.stringify(queue)).not.toMatch(/"(?:question|answer|section|url|path|raw)"\s*:/i);
  });

  it('emits JSON for --queue and fails closed without queue stdout for invalid argument combinations', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    for (const shard of built.shards) writeShard(root, shard.shard, shard.items);

    const valid = runCli(root, '--queue');
    expect(valid.status).toBe(0);
    expect(() => JSON.parse(valid.stdout)).not.toThrow();
    expect(JSON.parse(valid.stdout)).toEqual(expect.objectContaining({ total: 2, unreviewedCount: 2 }));
    for (const args of [['--queue', '--check'], ['--queue', '--with-local-raw'], ['--bootstrap', '--check'], ['--unknown'], ['--queue', '--queue']]) {
      const invalid = runCli(root, ...args);
      expect(invalid.status).not.toBe(0);
      expect(invalid.stdout).toBe('');
    }
  });
  it('assigns each Q&A identifier to the first hex character of its SHA-256 digest', () => {
    expect(qaShard(`card:one:${HASH_A}`)).toBe(hash(`card:one:${HASH_A}`)[0]);
  });

  it('builds exactly sixteen canonical hash-only shards with the full snapshot union once', () => {
    const result = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    expect(result.shards.map((shard) => shard.shard)).toEqual('0123456789abcdef'.split(''));
    expect(result.shards.flatMap((shard) => shard.items).map((item) => item.qaId).sort()).toEqual(snapshotItems().map((item) => item.qaId).sort());
    expect(result.shards.flatMap((shard) => shard.items).every((item) => item.status === 'legacy-unreviewed' && item.result === 'unreviewed' && item.method === 'unreviewed' && item.evidence.length === 0)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/"(?:question|answer|section)"\s*:/i);
  });

  it('merges tracked shards in canonical order and freezes snapshot aggregate hashes', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    for (const shard of built.shards) writeShard(root, shard.shard, shard.items);
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), `${JSON.stringify(built.manifest, null, 2)}\n`);

    const merged = mergeQaAdjudication({ root, check: true });
    expect(merged.statuses).toEqual(Object.fromEntries(snapshotItems().map((item) => [item.qaId, 'legacy-unreviewed'])));
    expect(merged.results).toEqual(Object.fromEntries(snapshotItems().map((item) => [item.qaId, 'unreviewed'])));
    expect(merged.manifest.snapshot.itemCount).toBe(2);
    expect(merged.manifest.snapshot.qaIdSetHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects unknown, source-text-like, mis-sharded, duplicate, and unreviewed records', () => {
    const root = fixture();
    const qaId = snapshotItems()[0]!.qaId;
    const shard = qaShard(qaId);
    const manifest: QaAdjudicationManifest = {
      schemaVersion: 1,
      snapshot: { normalizedFaqHash: HASH_A, itemCount: 2, qaIdSetHash: hash('wrong'), itemSetHash: HASH_A, answerSetHash: HASH_A, conflictSetHash: HASH_A },
      rawPackages: [],
    };
    mkdirSync(resolve(root, '.claude/specs/qa-adjudication'), { recursive: true });
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(manifest));
    for (const name of '0123456789abcdef') writeShard(root, name, name === shard ? [{ qaId, status: 'legacy-unreviewed', result: 'unreviewed', method: 'unreviewed', evidence: [], question: 'forbidden' } as never] : []);
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/disallowed field|aggregate/i);
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    for (const clean of built.shards) writeShard(root, clean.shard, clean.items);
    expect(() => mergeQaAdjudication({ root, check: true, requireReviewed: true })).toThrow(/legacy-unreviewed|reviewed/i);
  });

  it('does not require ignored raw data unless local verification is requested', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [{ file: 'pkg-api.json', sha256: HASH_A, cardNumHash: HASH_B, cardNumCount: 1 }] });
    for (const shard of built.shards) writeShard(root, shard.shard, shard.items);
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).not.toThrow();
    expect(() => mergeQaAdjudication({ root, check: true, withLocalRaw: true })).toThrow(/local raw package missing/i);
  });

  it('requires controlled evidence for every reviewed individual ruling without storing official text', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[0]!.qaId;
    const shard = qaShard(qaId);
    for (const file of built.shards) {
      writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId
        ? { ...entry, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: [] }
        : entry));
    }
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/evidence/i);

    const reviewed = built.shards.find((entry) => entry.shard === shard)!;
    writeShard(root, shard, reviewed.items.map((entry) => entry.qaId === qaId
      ? { ...entry, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: ['rules:.claude/rules/rule.md:1', 'src:src/one.ts:1', 'tests:tests/one.test.ts:1'], noteCodes: ['ENGINE-ALIGNED'] }
      : entry));
    expect(() => mergeQaAdjudication({ root, check: true })).not.toThrow();
  });

  it.each([
    ['aligned', 'matched'],
    ['test-gap', 'test-missing'],
    ['implementation-gap', 'mismatch'],
    ['deferred-card', 'deferred'],
    ['rule-conflict', 'manual-only'],
    ['needs-manual', 'manual-only'],
  ] as const)('requires %s to use trace status %s', (result, status) => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[0]!.qaId;
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId
      ? { ...entry, result, status: status === 'matched' ? 'test-missing' : 'matched', method: 'manual-semantic', evidence: ['rules:.claude/rules/rule.md:1'] }
      : entry));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/status.*result|compatib/i);
  });

  it('resolves only category-correct existing evidence lines and rejects arbitrary anchors', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[0]!.qaId;
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId
      ? { ...entry, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: ['rules:.claude/rules/rule.md:1', 'src:src/one.ts:1', 'tests:tests/one.test.ts:1'] }
      : entry));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).not.toThrow();
    const shard = built.shards.find((file) => file.items.some((entry) => entry.qaId === qaId))!;
    writeShard(root, shard.shard, shard.items.map((entry) => entry.qaId === qaId
      ? { ...entry, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: ['rules:../secret.md:1'] }
      : entry));
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/evidence|path/i);
  });

  it.each([
    ['aligned', 'matched', ['src:src/one.ts:1']],
    ['test-gap', 'test-missing', ['src:src/one.ts:1', 'tests:tests/one.test.ts:1']],
    ['deferred-card', 'deferred', ['deferred:two']],
    ['rule-conflict', 'manual-only', ['src:src/one.ts:1']],
    ['needs-manual', 'manual-only', ['src:src/one.ts:1']],
  ] as const)('rejects invalid %s evidence category set', (result, status, evidence) => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[0]!.qaId;
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId
      ? { ...entry, result, status, method: 'manual-semantic', evidence }
      : entry));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/requires|deferred|evidence/i);
  });

  it('pins each ruling to its snapshot answer hash', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[0]!.qaId;
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId ? { ...entry, answerHash: HASH_B } : entry));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/answer hash drift/i);
  });

  it('refuses to overwrite existing rulings unless force explicitly resets the shards', () => {
    const root = fixture();
    writeQaAdjudicationBootstrap(root);
    expect(() => writeQaAdjudicationBootstrap(root)).toThrow(/already exist/i);
    writeQaAdjudicationBootstrap(root, true);
    expect(mergeQaAdjudication({ root, check: true }).results).toEqual(Object.fromEntries(snapshotItems().map((item) => [item.qaId, 'unreviewed'])));
  });

  it('rejects a raw package/snapshot splice during optional local raw verification', () => {
    const root = fixture();
    const rawDir = resolve(root, '.claude/specs/cards-data/_raw');
    mkdirSync(rawDir, { recursive: true });
    const raw = JSON.stringify({ data: [] });
    writeFileSync(resolve(rawDir, 'pkg-api.json'), raw);
    const built = buildQaAdjudication({
      snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] },
      rawPackages: [{ file: 'pkg-api.json', sha256: hash(raw), cardNumHash: hash(''), cardNumCount: 0 }],
    });
    for (const file of built.shards) writeShard(root, file.shard, file.items);
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true, withLocalRaw: true })).toThrow(/normalized FAQ hash mismatch|raw Q&A snapshot drift/i);
  });

  it('rejects generic manual-semantic proof that is not bound to the reviewed card', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[0]!.qaId;
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId
      ? { ...entry, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: ['src:src/generic.ts:1', 'tests:tests/generic.test.ts:1'] }
      : entry));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/card-bound|card context/i);
  });

  it('allows unmapped implementation gaps only for absent non-deferred cards with rules proof', () => {
    const root = fixture();
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[1]!.qaId;
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId
      ? { ...entry, status: 'unmapped', result: 'implementation-gap', method: 'manual-semantic', evidence: ['rules:.claude/rules/rule.md:1'], noteCodes: ['UNIMPLEMENTED-CARD'] }
      : entry));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).not.toThrow();
  });

  it('rejects group-equivalent when matching question/answer hashes have different section hashes', () => {
    const root = fixture();
    const items = [
      { qaId: `card:B01001:${HASH_A}`, cardId: 'B01001', cardNums: ['B01001'], sectionHash: HASH_A, questionHash: HASH_A, answerHash: HASH_A },
      { qaId: `card:B01002:${HASH_B}`, cardId: 'B01002', cardNums: ['B01002'], sectionHash: HASH_B, questionHash: HASH_A, answerHash: HASH_A },
    ];
    const snapshot = { schemaVersion: 1 as const, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items, conflicts: [] };
    writeFileSync(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'), JSON.stringify(snapshot));
    writeFileSync(resolve(root, 'src/B01001.ts'), 'export const B01001 = true;\n');
    const built = buildQaAdjudication({ snapshot, rawPackages: [] });
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === items[0]!.qaId
      ? { ...entry, status: 'matched', result: 'aligned', method: 'group-equivalent', evidence: ['src:src/B01001.ts:1', 'tests:tests/generic.test.ts:1'] }
      : entry));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/group-equivalent requires multiple/i);
  });

  it('rejects trace-audit from strict reviewed mode even with reviewed result/status', () => {
    const root = fixture();
    writeFileSync(resolve(root, 'src/two.ts'), 'export const two = true;\n');
    writeFileSync(resolve(root, 'tests/two.test.ts'), 'expect(two).toBe(true);\n');
    const built = buildQaAdjudication({ snapshot: { schemaVersion: 1, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: snapshotItems(), conflicts: [] }, rawPackages: [] });
    const qaId = snapshotItems()[0]!.qaId;
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === qaId
      ? { ...entry, status: 'matched', result: 'aligned', method: 'trace-audit', evidence: ['src:src/one.ts:1', 'tests:tests/one.test.ts:1'] }
      : { ...entry, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: ['src:src/two.ts:1', 'tests:tests/two.test.ts:1'] }));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true, requireReviewed: true })).toThrow(/trace-audit/i);
  });

  it('requires group-equivalent aligned assertions to name an exact representative, not generic or prefix text', () => {
    const root = fixture();
    const items = [
      { qaId: `card:B01001:${HASH_A}`, cardId: 'B01001', cardNums: ['B01001'], sectionHash: HASH_A, questionHash: HASH_A, answerHash: HASH_A },
      { qaId: `card:B01002:${HASH_B}`, cardId: 'B01002', cardNums: ['B01002'], sectionHash: HASH_A, questionHash: HASH_A, answerHash: HASH_A },
    ];
    const snapshot = { schemaVersion: 1 as const, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items, conflicts: [] };
    writeFileSync(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'), JSON.stringify(snapshot));
    writeFileSync(resolve(root, 'src/B01001.ts'), 'export const B01001 = true;\n');
    writeFileSync(resolve(root, 'tests/member.test.ts'), 'expect(B01001).toBe(true);\n');
    const built = buildQaAdjudication({ snapshot, rawPackages: [] });
    const write = (test: string) => { for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => entry.qaId === items[0]!.qaId ? { ...entry, status: 'matched', result: 'aligned', method: 'group-equivalent', evidence: ['src:src/B01001.ts:1', `tests:tests/${test}:1`] } : entry)); };
    write('member.test.ts'); writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true })).not.toThrow();
    writeFileSync(resolve(root, 'tests/member.test.ts'), 'expect(B010010).toBe(true);\n');
    expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/member-bound/i);
  });

  it('accepts a unique deferred-card manual-semantic ruling under strict review without source evidence', () => {
    const root = fixture();
    const item = snapshotItems()[0]!;
    const snapshot = { schemaVersion: 1 as const, source: { url: 'https://example.invalid', fetchedAt: '2026-07-19' }, normalizedFaqHash: HASH_A, items: [item], conflicts: [] };
    writeFileSync(resolve(root, '.claude/specs/cards-data/qa-hash-snapshot.json'), JSON.stringify(snapshot));
    const built = buildQaAdjudication({ snapshot, rawPackages: [] });
    for (const file of built.shards) writeShard(root, file.shard, file.items.map((entry) => ({ ...entry, status: 'deferred', result: 'deferred-card', method: 'manual-semantic', evidence: ['deferred:one'] })));
    writeFileSync(resolve(root, '.claude/specs/qa-adjudication/manifest.json'), JSON.stringify(built.manifest));
    expect(() => mergeQaAdjudication({ root, check: true, requireReviewed: true })).not.toThrow();
  });
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
