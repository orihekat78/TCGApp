// Track B compiler — mined 文法 rule 集の実 data 受入テスト (B1 完了条件 = G1 を回帰化)。
// shipped = ALL_CARDS 直 import (.tmp 非依存、CI 可)。
//
// ⚠ Track A への注意: このテストが「mismatch=0」で fail した場合、新カードの印字行が既存 rule と
// 同一 key なのに DSL が異なる = 文法と実装の発散 (意図的アラーム)。対処は
//   (a) node scripts/compiler/tsv-corpus.cjs && npx tsx scripts/compiler/dump-shipped.ts &&
//       node scripts/compiler/mine.cjs で rule 再採掘 (conflict なら該当 key は自動で rule 化拒否 = refuse 降格)
//   (b) 新カード実装側の DSL を既存 exemplar と揃える
// のどちらか。line-rules.json の手編集は禁止 (mine.cjs 生成物)。
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { ALL_CARDS } from '../../src/cards/index.js';
const { loadCorpus, TEXT_COLS } = require('../../scripts/compiler/tsv-corpus.cjs');
const { canonicalCard } = require('../../scripts/compiler/canonical.cjs');
const { runOracle } = require('../../scripts/compiler/oracle.cjs');
const { loadProductions } = require('../../scripts/compiler/productions.cjs');

const ROOT = path.resolve(__dirname, '../..');
const RULES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/compiler/rules/line-rules.json'), 'utf8'));
const EXCEPTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/compiler/rules/exceptions.json'), 'utf8'));

describe('compiler/mined-rules (real data)', () => {
  const corpus = loadCorpus(ROOT);
  const corpusIds = new Set(corpus.map((c: { id: string }) => c.id));
  const shipped = ALL_CARDS.map((d) => canonicalCard(d));
  const report = runOracle(corpus, shipped, loadProductions());

  it('G1: silent mismatch 0 (mined 文法 + 例外リスト適用で全 shipped を再現 or refuse)', () => {
    expect(report.buckets.mismatch).toEqual([]);
  });

  it('文法が実際に発火している (match は vanilla 52 を大きく超える)', () => {
    // 2026-07-02 B1 実測 1161/1509 → B3-1 意味射影正規化 (N1-N5) 後 1244/1515。Track A のカード追加で match は
    // 増えることはあっても既存 match が消えることはない (rules/exceptions は static、既存カードも static)。
    expect(report.totals.match).toBeGreaterThanOrEqual(1244);
  });

  it('全 shipped が判定される (match+refuse+mismatch = judged, noCorpus=0)', () => {
    expect(report.buckets.noCorpus).toEqual([]);
    expect(report.totals.judged).toBe(shipped.length);
  });

  it('rule payload に closure marker が漏れていない (custom TS は rule 化禁止)', () => {
    for (const r of RULES.rules) {
      expect(JSON.stringify(r), `rule ${r.key}`).not.toContain('<closure>');
    }
  });

  it('rule key は kind|col 形式で well-formed、全 rule に exemplar がある', () => {
    const kinds = new Set(['character', 'event', 'partner', 'case']);
    for (const r of RULES.rules) {
      const [kind, col] = r.key.split('|');
      expect(kinds.has(kind), `rule ${r.key}: kind`).toBe(true);
      expect(TEXT_COLS.includes(col), `rule ${r.key}: col`).toBe(true);
      expect(r.exemplars.length, `rule ${r.key}: exemplars`).toBeGreaterThanOrEqual(1);
      const payloads = [r.ability, r.abilities, r.keywords].filter(Boolean);
      expect(payloads.length, `rule ${r.key}: payload はちょうど 1 種`).toBe(1);
    }
  });

  it('exceptions.json の id は corpus に実在する', () => {
    for (const c of EXCEPTIONS.cards) {
      expect(corpusIds.has(c.id), `exception ${c.id}`).toBe(true);
      expect(c.reason.length).toBeGreaterThan(0);
    }
  });
}, 60_000);
