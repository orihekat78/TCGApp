import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildQaTrace,
  parseQaAnnotations,
  runGenQaTrace,
  validateQaCoverageOverrides,
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

  it('materializes exhaustive coverage counts and never calls legacy-unreviewed output compliant', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-coverage-counts-'));
    tempRoots.push(root);
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
    writeStatus(root);
    writeFileSync(path.join(dataDir, 'qa-hash-snapshot.json'), JSON.stringify(snapshot([item(QA_A), item(QA_B, 'card-b')])));
    mkdirSync(path.join(root, 'src'), { recursive: true });
    mkdirSync(path.join(root, 'tests'), { recursive: true });
    writeFileSync(path.join(root, 'src', 'a.ts'), `// qa: ${QA_A}`);
    writeFileSync(path.join(root, 'tests', 'a.test.ts'), `// qa: ${QA_A}`);

    runGenQaTrace({ checkOnly: false }, root);

    const manifest = JSON.parse(readFileSync(path.join(root, '.claude', 'auto', 'qa-manifest.json'), 'utf8'));
    const report = readFileSync(path.join(root, '.claude', 'auto', 'qa-trace.md'), 'utf8');
    const nonblockingReport = JSON.parse(readFileSync(path.join(root, '.claude', 'reports', 'qa-coverage-current.json'), 'utf8'));
    expect(manifest.coverage).toEqual({
      total: 2,
      statusCounts: { matched: 1, 'test-missing': 0, 'legacy-unreviewed': 1, unmapped: 0, mismatch: 0, deferred: 0, 'manual-only': 0 },
      itemStatuses: { [QA_A]: 'matched', [QA_B]: 'legacy-unreviewed' },
      allCompliant: false,
    });
    expect(nonblockingReport.coverage).toEqual(manifest.coverage);
    expect(report).toContain('- all-compliant: false');
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

  it('keeps shipped state separate from exact annotation coverage', () => {
    const trace = buildQaTrace({
      snapshot: snapshot([
        item(QA_A, 'card-a'),
        item(QA_B, 'card-b'),
        item(`card:card-c:${'d'.repeat(64)}`, 'card-c'),
      ]),
      files: [
        { path: 'src/cards/a.ts', content: `// qa: ${QA_A}` },
        { path: 'tests/cards/a.test.ts', content: `// qa: ${QA_A}` },
        { path: 'src/cards/b.ts', content: `// qa: ${QA_B}` },
        { path: 'src/cards/c.ts', content: 'card-c is mentioned here, but without an exact Q&A annotation.' },
      ],
      shippedCardIds: new Set(['card-a', 'card-b', 'card-c']),
      deferredCardIds: new Set(),
    });

    expect(trace.items.map((entry) => [entry.classification, entry.coverageStatus])).toEqual([
      ['shipped', 'matched'],
      ['shipped', 'test-missing'],
      ['shipped', 'legacy-unreviewed'],
    ]);
  });

  it('keeps a test-only exact annotation legacy-unreviewed without a missing-test issue', () => {
    const trace = buildQaTrace({
      snapshot: snapshot([item(QA_A)]),
      files: [{ path: 'tests/cards/a.test.ts', content: `// qa: ${QA_A}` }],
      shippedCardIds: new Set(['card-a']),
      deferredCardIds: new Set(),
    });

    expect(trace.items[0]).toMatchObject({
      classification: 'shipped',
      coverageStatus: 'legacy-unreviewed',
      sourceRefs: [],
      testRefs: ['tests/cards/a.test.ts:1'],
    });
    expect(trace.issues).toEqual([]);
    expect(trace.coverage.statusCounts['legacy-unreviewed']).toBe(1);
  });

  it('does not count a plain card ID mention as coverage', () => {
    const trace = buildQaTrace({
      snapshot: snapshot([item(QA_A)]),
      files: [{ path: 'src/cards/a.ts', content: 'card-a is mentioned, but this is not a Q&A annotation.' }],
      shippedCardIds: new Set(['card-a']),
      deferredCardIds: new Set(),
    });

    expect(trace.items[0]).toMatchObject({ coverageStatus: 'legacy-unreviewed', sourceRefs: [], testRefs: [] });
  });

  it('requires live BUG/DEFER records and manual evidence for exceptional coverage overrides', () => {
    const overrides = {
      schemaVersion: 1,
      overrides: [
        { qaId: QA_A, status: 'mismatch', reason: 'Reviewed against the current implementation.', bugId: 'BUG-001' },
        { qaId: QA_B, status: 'deferred', reason: 'Implementation is intentionally deferred.', deferId: 'DEFER-QA-POST-ID' },
      ],
    } as const;

    expect(() => validateQaCoverageOverrides(overrides, new Set([QA_A, QA_B]), {
      bugIds: new Set(), deferIds: new Set(['DEFER-QA-POST-ID']), ruleRefIds: new Set(['qa-22-community-index']),
    })).toThrow(/dangling BUG override.*BUG-001/);
    expect(() => validateQaCoverageOverrides({
      schemaVersion: 1,
      overrides: [{ qaId: QA_A, status: 'manual-only', reason: 'Requires a human interaction.', manualSteps: [] }],
    }, new Set([QA_A]), {
      bugIds: new Set(['BUG-001']), deferIds: new Set(['DEFER-QA-POST-ID']), ruleRefIds: new Set(['qa-22-community-index']),
    })).toThrow(/manual-only override requires ruleRefs and non-empty manualSteps/);
    expect(() => validateQaCoverageOverrides({
      schemaVersion: 1,
      overrides: [{ qaId: QA_A, status: 'manual-only', reason: 'Requires a human interaction.', ruleRefs: ['qa-22-community-index'], manualSteps: [] }],
    }, new Set([QA_A]), {
      bugIds: new Set(['BUG-001']), deferIds: new Set(['DEFER-QA-POST-ID']), ruleRefIds: new Set(['qa-22-community-index']),
    })).toThrow(/manual-only override requires ruleRefs and non-empty manualSteps/);
    expect(validateQaCoverageOverrides(overrides, new Set([QA_A, QA_B]), {
      bugIds: new Set(['BUG-001']), deferIds: new Set(['DEFER-QA-POST-ID']), ruleRefIds: new Set(['qa-22-community-index']),
    }).get(QA_A)).toMatchObject({ status: 'mismatch', bugId: 'BUG-001' });
  });

  it('rejects a dangling DEFER override without another invalid field', () => {
    expect(() => validateQaCoverageOverrides({
      schemaVersion: 1,
      overrides: [{ qaId: QA_A, status: 'deferred', reason: 'Implementation is intentionally deferred.', deferId: 'DEFER-UNKNOWN' }],
    }, new Set([QA_A]), {
      bugIds: new Set(), deferIds: new Set(['DEFER-QA-POST-ID']), ruleRefIds: new Set(),
    })).toThrow(/dangling DEFER override.*DEFER-UNKNOWN/);
  });

  it('rejects an unknown override status without another invalid field', () => {
    expect(() => validateQaCoverageOverrides({
      schemaVersion: 1,
      overrides: [{ qaId: QA_A, status: 'unknown', reason: 'Reviewed.' }],
    }, new Set([QA_A]), {
      bugIds: new Set(), deferIds: new Set(), ruleRefIds: new Set(),
    })).toThrow(/stale coverage override status/);
  });

  it('rejects a blank override reason without another invalid field', () => {
    expect(() => validateQaCoverageOverrides({
      schemaVersion: 1,
      overrides: [{ qaId: QA_A, status: 'deferred', reason: '  ', deferId: 'DEFER-QA-POST-ID' }],
    }, new Set([QA_A]), {
      bugIds: new Set(), deferIds: new Set(['DEFER-QA-POST-ID']), ruleRefIds: new Set(),
    })).toThrow(/override requires a reason/);
  });

  it('rejects stale unmapped overrides once an exact production annotation exists', () => {
    expect(() => buildQaTrace({
      snapshot: snapshot([item(QA_A)]),
      files: [{ path: 'src/cards/a.ts', content: `// qa: ${QA_A}` }],
      shippedCardIds: new Set(['card-a']),
      deferredCardIds: new Set(),
      coverageOverrides: new Map([[QA_A, { qaId: QA_A, status: 'unmapped', reason: 'No mapping at review time.' }]]),
    })).toThrow(/stale unmapped override/);
  });

  it('applies the reviewed override decision table without treating card IDs as coverage', () => {
    const QA_C = `card:card-c:${'d'.repeat(64)}`;
    const QA_D = `card:card-d:${'e'.repeat(64)}`;
    const overrides = validateQaCoverageOverrides({
      schemaVersion: 1,
      overrides: [
        { qaId: QA_A, status: 'mismatch', reason: 'Implementation differs.', bugId: 'BUG-001' },
        { qaId: QA_B, status: 'deferred', reason: 'Awaiting the engine family.', deferId: 'DEFER-QA-POST-ID' },
        { qaId: QA_C, status: 'manual-only', reason: 'Requires a human interaction.', ruleRefs: ['qa-22-community-index'], manualSteps: ['Use the specified interaction path.'] },
        { qaId: QA_D, status: 'unmapped', reason: 'Reviewed; no production mapping exists.' },
      ],
    }, new Set([QA_A, QA_B, QA_C, QA_D]), {
      bugIds: new Set(['BUG-001']), deferIds: new Set(['DEFER-QA-POST-ID']), ruleRefIds: new Set(['qa-22-community-index']),
    });
    const trace = buildQaTrace({
      snapshot: snapshot([item(QA_A), item(QA_B, 'card-b'), item(QA_C, 'card-c'), item(QA_D, 'card-d')]),
      files: [
        { path: 'src/cards/a.ts', content: `// qa: ${QA_A}` },
        { path: 'src/cards/c.ts', content: `// qa: ${QA_C}` },
        { path: 'src/cards/d.ts', content: 'card-d is only mentioned, never annotated.' },
      ],
      shippedCardIds: new Set(['card-a', 'card-b', 'card-c', 'card-d']),
      deferredCardIds: new Set(),
      coverageOverrides: overrides,
    });

    expect(trace.items.map((entry) => entry.coverageStatus)).toEqual(['mismatch', 'deferred', 'manual-only', 'unmapped']);
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

  it('rejects a mismatched or duplicate Q&A identifier before baseline generation', () => {
    expect(() => validateQaSnapshot(snapshot([item(QA_A, 'card-b')]))).toThrow(/snapshot item identity/);
    expect(() => validateQaSnapshot(snapshot([item(QA_A), item(QA_A, 'card-a', ['B00002'])]))).toThrow(/duplicate Q&A snapshot identifier/);
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

  it('refuses to overwrite a hash snapshot when status provenance is empty', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-missing-source-'));
    tempRoots.push(root);
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
    mkdirSync(path.join(dataDir, '_raw'), { recursive: true });
    writeFileSync(path.join(dataDir, '_raw', 'ct-p01-api.json'), JSON.stringify({ data: [
      { card_num: 'B00001', card_id: 'card-a', q_a: 'Q: Require provenance\nA: Refuse write' },
    ] }));
    const { normalizedFaqMetadata } = require('../../scripts/cards/cards-data-status.cjs');
    const normalizedFaq = createHash('sha256').update(JSON.stringify(normalizedFaqMetadata(root))).digest('hex');
    writeFileSync(path.join(dataDir, 'status.json'), JSON.stringify({
      source: { url: '', fetchedAt: '' },
      hashes: { normalizedFaq },
    }));
    const output = path.join(dataDir, 'qa-hash-snapshot.json');
    writeFileSync(output, 'keep-existing-snapshot');

    const { writeQaHashSnapshot } = require('../../scripts/cards/write-qa-hash-snapshot.cjs');
    expect(() => writeQaHashSnapshot(root)).toThrow(/source URL and fetchedAt/);
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

  it('rejects missing status provenance in a clean trace generator run', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-qa-clean-missing-source-'));
    tempRoots.push(root);
    const dataDir = path.join(root, '.claude', 'specs', 'cards-data');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, 'status.json'), JSON.stringify({ hashes: { normalizedFaq: CORPUS_HASH } }));
    writeFileSync(path.join(dataDir, 'qa-hash-snapshot.json'), JSON.stringify(snapshot([item(QA_A)])));

    expect(() => runGenQaTrace({ checkOnly: true }, root)).toThrow(/status source URL and fetchedAt/);
  });

  it('pins the approved 2026-07-18 hash-only official snapshot and rejects body-shaped fields', () => {
    const tracked = JSON.parse(readFileSync(path.resolve('.claude/specs/cards-data/qa-hash-snapshot.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(path.resolve('.claude/auto/qa-manifest.json'), 'utf8'));

    validateQaSnapshot(tracked);
    expect(tracked.source).toEqual({
      url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
      fetchedAt: '2026-07-18T05:51:08.0459736Z',
    });
    expect(tracked.items).toHaveLength(2914);
    expect(tracked.conflicts).toEqual([]);
    expect(manifest.coverage.total).toBe(2914);
    expect(Object.values(manifest.coverage.statusCounts).reduce((total: number, count: unknown) => total + Number(count), 0)).toBe(2914);
    expect(JSON.stringify(tracked)).not.toMatch(/"(?:question|answer|q_a|qAndA|section)"\s*:/);
  });
});

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});
