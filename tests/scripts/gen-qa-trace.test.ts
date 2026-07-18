import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildQaTrace,
  parseQaAnnotations,
  runGenQaTrace,
  validateQaSnapshotAgainstStatus,
  validateQaSnapshot,
  type QaSnapshot,
} from '../../scripts/gen-docs/gen-qa-trace';

const QA_A = `card:card-a:${'a'.repeat(64)}`;
const QA_A_DRIFT = `card:card-a:${'b'.repeat(64)}`;
const QA_B = `card:card-b:${'c'.repeat(64)}`;
const CORPUS_HASH = '4'.repeat(64);
const tempRoots: string[] = [];

function snapshot(items: QaSnapshot['items']): QaSnapshot {
  return {
    schemaVersion: 1,
    source: { url: 'https://example.test/official', fetchedAt: '2026-07-18T00:00:00.000Z' },
    normalizedFaqHash: CORPUS_HASH,
    items,
  };
}

function writeStatus(root: string, normalizedFaq = CORPUS_HASH) {
  const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(path.join(dataDir, 'status.json'), JSON.stringify({
    source: { url: 'https://example.test/official', fetchedAt: '2026-07-18T00:00:00.000Z' },
    hashes: { normalizedFaq },
  }));
}

function item(qaId: string, cardId = 'card-a', cardNums = ['B00001']): QaSnapshot['items'][number] {
  return {
    qaId,
    cardId,
    cardNums,
    sectionHash: '1'.repeat(64),
    questionHash: '2'.repeat(64),
    answerHash: '3'.repeat(64),
  };
}

describe('gen-qa-trace', () => {
  it('collects exact qa annotations from source and tests with ordinal references', () => {
    expect(parseQaAnnotations('  // qa: ' + QA_A + '\n', 'src/engine/flow.ts')).toEqual([
      { qaId: QA_A, path: 'src/engine/flow.ts', line: 1, kind: 'source' },
    ]);
    expect(parseQaAnnotations('// qa: not-an-id\n', 'tests/flow.test.ts')).toEqual([]);
  });

  it('collects exact annotations from TSX source and tests, without scanning other extensions', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-tsx-'));
    tempRoots.push(root);
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
    writeStatus(root);
    writeFileSync(path.join(dataDir, 'qa-hash-snapshot.json'), JSON.stringify(snapshot([item(QA_A)])));
    mkdirSync(path.join(root, 'src'), { recursive: true });
    mkdirSync(path.join(root, 'tests'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'trace.tsx'), `// qa: ${QA_A}`);
    writeFileSync(path.join(root, 'tests', 'trace.test.tsx'), `// qa: ${QA_A}`);
    writeFileSync(path.join(root, 'src', 'ignored.mts'), `// qa: ${QA_A}`);

    runGenQaTrace({ checkOnly: false }, root);

    const manifest = JSON.parse(readFileSync(path.join(root, '.claude', 'auto', 'qa-manifest.json'), 'utf8'));
    expect(manifest.items[0]).toMatchObject({
      sourceRefs: ['src/trace.tsx:1'],
      testRefs: ['tests/trace.test.tsx:1'],
    });
  });

  it('reports a dangling annotation when its card has no snapshot entry', () => {
    expect(() => buildQaTrace({
      snapshot: snapshot([item(QA_A)]),
      files: [{ path: 'src/engine/flow.ts', content: `// qa: card:absent:${'d'.repeat(64)}` }],
      shippedCardIds: new Set(['card-a']),
      deferredCardIds: new Set(),
    })).toThrow(/dangling Q&A annotation.*absent/);
  });

  it('reports digest drift when an annotation retains a known card ID with a stale QA digest', () => {
    expect(() => buildQaTrace({
      snapshot: snapshot([item(QA_A)]),
      files: [{ path: 'src/cards/a.ts', content: `// qa: ${QA_A_DRIFT}` }],
      shippedCardIds: new Set(['card-a']),
      deferredCardIds: new Set(),
    })).toThrow(/Q&A digest drift.*card-a/);
  });

  it('keeps source-only matches as a missing-test issue and permits shared engine references', () => {
    const trace = buildQaTrace({
      snapshot: snapshot([item(QA_A)]),
      files: [{ path: 'src/engine/flow/shared.ts', content: `// qa: ${QA_A}` }],
      shippedCardIds: new Set(['card-a']),
      deferredCardIds: new Set(),
    });

    expect(trace.items[0]).toMatchObject({ classification: 'shipped', sourceRefs: ['src/engine/flow/shared.ts:1'], testRefs: [] });
    expect(trace.issues).toEqual([{ kind: 'missing-test', qaId: QA_A }]);
  });

  it('coalesces multiple printings, preserves duplicate annotations, and classifies deferred or missing cards', () => {
    const trace = buildQaTrace({
      snapshot: snapshot([
        item(QA_A, 'card-a', ['B00002', 'B00001']),
        item(QA_B, 'card-b', ['C00001']),
      ]),
      files: [
        { path: 'src/cards/a.ts', content: `// qa: ${QA_A}\n// qa: ${QA_A}` },
        { path: 'tests/cards/a.test.ts', content: `// qa: ${QA_A}` },
      ],
      shippedCardIds: new Set(),
      deferredCardIds: new Set(['card-b']),
    });

    expect(trace.items.map((entry) => [entry.qaId, entry.cardNums, entry.classification])).toEqual([
      [QA_A, ['B00001', 'B00002'], 'missing'],
      [QA_B, ['C00001'], 'deferred'],
    ]);
    expect(trace.items[0]?.sourceRefs).toEqual(['src/cards/a.ts:1', 'src/cards/a.ts:2']);
    expect(trace.issues).toContainEqual({ kind: 'duplicate-annotation', qaId: QA_A, path: 'src/cards/a.ts' });
  });

  it('rejects question or answer bodies and unknown fields from tracked snapshots', () => {
    expect(() => validateQaSnapshot({
      ...snapshot([item(QA_A)]),
      items: [{ ...item(QA_A), question: 'official question body' }],
    })).toThrow(/disallowed field.*question/);
    expect(() => validateQaSnapshot({
      ...snapshot([item(QA_A)]),
      items: [{ ...item(QA_A), answer: 'official answer body' }],
    })).toThrow(/disallowed field.*answer/);
  });

  it('creates the tracked source snapshot from FAQ-shaped raw entries without retaining non-Q&A notes', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-snapshot-'));
    tempRoots.push(root);
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
    mkdirSync(path.join(dataDir, '_raw'), { recursive: true });
    writeFileSync(path.join(dataDir, '_raw', 'ct-p01-api.json'), JSON.stringify({ data: [
      { card_num: 'B00001', card_id: 'card-a', q_a: 'Q: Kept only as a hash\nA: Yes' },
      { card_num: 'B00002', card_id: 'card-b', q_a: 'editorial source note, not Q&A' },
    ] }));

    const { normalizedFaqMetadata } = require('../../scripts/cards/cards-data-status.cjs');
    const normalizedFaq = createHash('sha256').update(JSON.stringify(normalizedFaqMetadata(root))).digest('hex');
    writeStatus(root, normalizedFaq);
    const { buildQaHashSnapshot } = require('../../scripts/cards/write-qa-hash-snapshot.cjs');
    const result = buildQaHashSnapshot(root);

    expect(result.items).toHaveLength(1);
    expect(result.normalizedFaqHash).toBe(normalizedFaq);
    expect(JSON.stringify(result)).not.toContain('Kept only as a hash');
    expect(JSON.stringify(result)).not.toContain('editorial source note');
  });

  it('refuses to overwrite a hash snapshot when raw Q&A and tracked status disagree', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-stale-status-'));
    tempRoots.push(root);
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
    mkdirSync(path.join(dataDir, '_raw'), { recursive: true });
    writeFileSync(path.join(dataDir, '_raw', 'ct-p01-api.json'), JSON.stringify({ data: [
      { card_num: 'B00001', card_id: 'card-a', q_a: 'Q: Hash mismatch\nA: Refuse write' },
    ] }));
    writeStatus(root, '0'.repeat(64));
    const output = path.join(dataDir, 'qa-hash-snapshot.json');
    writeFileSync(output, 'keep-existing-snapshot');

    const { writeQaHashSnapshot } = require('../../scripts/cards/write-qa-hash-snapshot.cjs');
    expect(() => writeQaHashSnapshot(root)).toThrow(/normalized FAQ hash mismatch/);
    expect(readFileSync(output, 'utf8')).toBe('keep-existing-snapshot');
  });

  it('rejects tracked aggregate drift without requiring ignored raw data', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-clean-drift-'));
    tempRoots.push(root);
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
    writeStatus(root, '0'.repeat(64));
    writeFileSync(path.join(dataDir, 'qa-hash-snapshot.json'), JSON.stringify(snapshot([item(QA_A)])));

    expect(() => runGenQaTrace({ checkOnly: true }, root)).toThrow(/normalized FAQ hash drift/);
    expect(() => validateQaSnapshotAgainstStatus(snapshot([item(QA_A)]), { hashes: { normalizedFaq: '0'.repeat(64) } })).toThrow(/normalized FAQ hash drift/);
  });

  it('pins the approved 2026-07-18 hash-only official snapshot and rejects body-shaped fields', () => {
    const tracked = JSON.parse(readFileSync(path.resolve('.claude/specs/cards-data/qa-hash-snapshot.json'), 'utf8'));

    validateQaSnapshot(tracked);
    expect(tracked.source).toEqual({
      url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
      fetchedAt: '2026-07-18T05:51:08.0459736Z',
    });
    expect(tracked.items).toHaveLength(2650);
    expect(JSON.stringify(tracked)).not.toMatch(/"(?:question|answer|q_a|qAndA|section)"\s*:/);
  });
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});
