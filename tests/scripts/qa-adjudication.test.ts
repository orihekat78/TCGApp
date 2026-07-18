import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildQaAdjudication,
  mergeQaAdjudication,
  qaShard,
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
  return root;
}

function writeShard(root: string, shard: string, items: QaAdjudicationShard['items']): void {
  const path = resolve(root, '.claude/specs/qa-adjudication', `${shard}.json`);
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, shard, items }, null, 2)}\n`);
}

describe('Q&A adjudication shards', () => {
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
      ? { ...entry, status: 'matched', result: 'aligned', method: 'manual-semantic', evidence: ['rules:25-qa-effects-resolution.md#case-1'], noteCodes: ['ENGINE-ALIGNED'] }
      : entry));
    expect(() => mergeQaAdjudication({ root, check: true })).not.toThrow();
  });
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
