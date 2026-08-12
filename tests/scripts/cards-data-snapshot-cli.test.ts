import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGenQaTrace } from '../../scripts/gen-docs/gen-qa-trace.js';
import {
  mergeQaAdjudication,
  readQaAdjudicationQueue,
} from '../../scripts/qa-adjudication.js';

const ROOT = path.resolve(__dirname, '../..');
const { acquireCardsDataWriteLock, releaseCardsDataWriteLock } = require('../../scripts/cards/official-api.cjs');

describe('cards-data reader CLIs', () => {
  const fixtures: string[] = [];

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
  });

  it('rejects a corpus read while a cards-data root swap owns the write lock', () => {
    const catalog = mkdtempSync(path.join(tmpdir(), 'conan-snapshot-cli-'));
    fixtures.push(catalog);
    mkdirSync(path.join(catalog, 'ct-p10'), { recursive: true });
    writeFileSync(
      path.join(catalog, 'ct-p10', 'character.tsv'),
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA\nB10097\t1\tfixture\tblue\t1\t1000\t1000\tC\t\t\t\t\t\t\t\t\t\n',
    );

    const lock = acquireCardsDataWriteLock(catalog);
    try {
      expect(() => execFileSync(process.execPath, ['scripts/compiler/tsv-corpus.cjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, CONAN_CARDS_DATA_DIR: catalog },
      })).toThrow(/cards-data write lock is already held/);
    } finally {
      expect(releaseCardsDataWriteLock(catalog, lock)).toBe(true);
    }
  });

  it('blocks every exported multi-file Q&A reader behind the shared snapshot gate', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-snapshot-qa-'));
    fixtures.push(root);
    const catalog = path.join(root, '.claude', 'specs', 'cards-data');
    mkdirSync(catalog, { recursive: true });
    const lock = acquireCardsDataWriteLock(catalog);

    try {
      expect(() => readQaAdjudicationQueue({ root })).toThrow(/cards-data write lock is already held/);
      expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/cards-data write lock is already held/);
      expect(() => runGenQaTrace({ checkOnly: true }, root)).toThrow(/cards-data write lock is already held/);
    } finally {
      expect(releaseCardsDataWriteLock(catalog, lock)).toBe(true);
    }
  });

  it('rejects ground while a cards-data root swap owns the write lock', () => {
    const catalog = mkdtempSync(path.join(tmpdir(), 'conan-ground-snapshot-cli-'));
    fixtures.push(catalog);
    mkdirSync(path.join(catalog, 'ct-p10'), { recursive: true });
    writeFileSync(
      path.join(catalog, 'ct-p10', 'character.tsv'),
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA\nB10097\t1\tfixture\tblue\t1\t1000\t1000\tC\t\t\t\t\t\t\t\t\t\n',
    );

    const lock = acquireCardsDataWriteLock(catalog);
    try {
      expect(() => execFileSync(process.execPath, ['scripts/ground-dossier.cjs', 'B10097'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, CONAN_CARDS_DATA_DIR: catalog },
      })).toThrow(/cards-data write lock is already held/);
    } finally {
      expect(releaseCardsDataWriteLock(catalog, lock)).toBe(true);
    }
  });

});
