import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildQaTraceBaseline,
  lintExitCode,
  lintQaTrace,
  type QaTraceBaseline,
} from '../../scripts/lint-qa-trace';

const roots: string[] = [];
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function item(id: string, answerHash = HASH_C) {
  return {
    qaId: `card:${id}:${HASH_A}`,
    cardId: id,
    cardNums: [`B${id.padStart(5, '0')}`],
    sectionHash: HASH_A,
    questionHash: HASH_B,
    answerHash,
  };
}

function coverageFor(items: ReturnType<typeof item>[], statuses: Record<string, QaTraceBaseline['coverage']['itemStatuses'][string]>) {
  const statusCounts = { matched: 0, 'test-missing': 0, 'legacy-unreviewed': 0, unmapped: 0, mismatch: 0, deferred: 0, 'manual-only': 0 } as QaTraceBaseline['coverage']['statusCounts'];
  for (const status of Object.values(statuses)) statusCounts[status] += 1;
  return { total: items.length, statusCounts, itemStatuses: statuses, allCompliant: items.length > 0 && statusCounts.matched === items.length };
}

function fixture(options: {
  baselineItems?: ReturnType<typeof item>[];
  currentItems?: ReturnType<typeof item>[];
  baselineCoverage?: QaTraceBaseline['coverage'];
  coverage?: QaTraceBaseline['coverage'];
  baselineConflicts?: unknown[];
  conflicts?: unknown[];
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'conan-lint-qa-'));
  roots.push(root);
  const data = join(root, '.claude', 'specs', 'cards-data');
  const auto = join(root, '.claude', 'auto');
  mkdirSync(data, { recursive: true });
  mkdirSync(auto, { recursive: true });
  const baselineItems = options.baselineItems ?? [item('1')];
  const baselineCoverage = options.baselineCoverage ?? coverageFor(baselineItems, Object.fromEntries(baselineItems.map((entry) => [entry.qaId, 'legacy-unreviewed'])));
  const currentItems = options.currentItems ?? baselineItems;
  const coverage = options.coverage ?? coverageFor(currentItems, Object.fromEntries(currentItems.map((entry) => [entry.qaId, 'legacy-unreviewed'])));
  const snapshot = {
    schemaVersion: 1,
    source: { url: 'https://example.test/cards', fetchedAt: '2026-07-18T00:00:00.000Z' },
    normalizedFaqHash: hash(JSON.stringify(baselineItems)),
    items: currentItems,
    conflicts: options.conflicts ?? options.baselineConflicts ?? [],
  };
  const baseline = buildQaTraceBaseline({ snapshot: { ...snapshot, items: baselineItems, conflicts: options.baselineConflicts ?? [] }, coverage: baselineCoverage });
  writeFileSync(join(data, 'qa-hash-snapshot.json'), JSON.stringify(snapshot));
  writeFileSync(join(data, 'status.json'), JSON.stringify({
    source: snapshot.source,
    hashes: { normalizedFaq: snapshot.normalizedFaqHash },
  }));
  writeFileSync(join(root, '.claude', 'specs', 'qa-trace-baseline.json'), JSON.stringify(baseline));
  writeFileSync(join(auto, 'qa-manifest.json'), JSON.stringify({ schemaVersion: 1, items: snapshot.items, coverage }));
  return { root, baseline, snapshot };
}

describe('lint-qa-trace', () => {
  it('accepts the reviewed legacy baseline but require-all fails it', () => {
    const { root } = fixture();
    expect(lintQaTrace({ root }).issues).toEqual([]);
    expect(lintExitCode(lintQaTrace({ root }))).toBe(0);
    expect(lintExitCode(lintQaTrace({ root, requireAll: true }))).toBe(1);
  });

  it('rejects aggregate hash, added, removed, and answer hash drift', () => {
    const added = fixture({ currentItems: [item('1'), item('2')] });
    expect(lintQaTrace({ root: added.root }).issues.map((issue) => issue.code)).toContain('qa-added');

    const removed = fixture({ currentItems: [] });
    expect(lintQaTrace({ root: removed.root }).issues.map((issue) => issue.code)).toContain('qa-removed');

    const answerChanged = fixture({ currentItems: [item('1', HASH_A)] });
    expect(lintQaTrace({ root: answerChanged.root }).issues.map((issue) => issue.code)).toContain('answer-hash-drift');

    const aggregate = fixture();
    const snapshotPath = join(aggregate.root, '.claude', 'specs', 'cards-data', 'qa-hash-snapshot.json');
    const statusPath = join(aggregate.root, '.claude', 'specs', 'cards-data', 'status.json');
    const snapshot = { ...aggregate.snapshot, normalizedFaqHash: HASH_B };
    writeFileSync(snapshotPath, JSON.stringify(snapshot));
    writeFileSync(statusPath, JSON.stringify({ source: snapshot.source, hashes: { normalizedFaq: HASH_B } }));
    expect(lintQaTrace({ root: aggregate.root }).issues.map((issue) => issue.code)).toContain('source-hash-drift');
  });

  it('rejects a collision or conflict added after the reviewed baseline', () => {
    const collision = fixture({ currentItems: [item('1'), item('1')] });
    expect(() => lintQaTrace({ root: collision.root })).toThrow('duplicate Q&A snapshot identifier');

    const conflict = fixture();
    const snapshotPath = join(conflict.root, '.claude', 'specs', 'cards-data', 'qa-hash-snapshot.json');
    writeFileSync(snapshotPath, JSON.stringify({
      ...conflict.snapshot,
      conflicts: [{ qaId: `card:1:${HASH_A}`, cardId: '1', cardNums: ['B00001'], answerHashes: [HASH_A, HASH_C] }],
    }));
    expect(lintQaTrace({ root: conflict.root }).issues.map((issue) => issue.code)).toContain('conflict-drift');
  });

  it('rejects an unresolved conflict even when it was copied into the baseline', () => {
    const conflict = { qaId: `card:1:${HASH_A}`, cardId: '1', cardNums: ['B00001'], answerHashes: [HASH_A, HASH_C] };
    const { root } = fixture({ baselineConflicts: [conflict], conflicts: [conflict] });
    expect(lintQaTrace({ root }).issues.map((issue) => issue.code)).toContain('qa-conflict');
  });

  it('rejects worsened coverage and accepts a matched improvement', () => {
    const one = [item('1')];
    const worse = fixture({ coverage: coverageFor(one, { [one[0]!.qaId]: 'test-missing' }) });
    expect(lintQaTrace({ root: worse.root }).issues.map((issue) => issue.code)).toContain('coverage-worsened');

    const improved = fixture({ coverage: coverageFor(one, { [one[0]!.qaId]: 'matched' }) });
    expect(lintQaTrace({ root: improved.root }).issues).toEqual([]);
  });

  it('rejects a per-item coverage regression even when aggregate counts are unchanged', () => {
    const baselineItems = [item('1'), item('2')];
    const baselineCoverage = coverageFor(baselineItems, {
      [baselineItems[0]!.qaId]: 'matched',
      [baselineItems[1]!.qaId]: 'legacy-unreviewed',
    });
    const currentCoverage = coverageFor(baselineItems, {
      [baselineItems[0]!.qaId]: 'legacy-unreviewed',
      [baselineItems[1]!.qaId]: 'matched',
    });
    const { root } = fixture({ baselineItems, baselineCoverage, coverage: currentCoverage });

    expect(lintQaTrace({ root }).issues.map((issue) => issue.code)).toContain('coverage-item-worsened');
  });
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
