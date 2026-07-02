// Track B compiler — oracle の実 data 受入テスト (B0 完了条件を回帰化)。
// shipped = ALL_CARDS 直 import (.tmp 非依存、CI 可。import ~5s は BUG-077 と同様 timeout 20s 内)。
// 不変条件 (Track A がカードを増やしても成立し続けるもののみ pin):
//   1. 全 shipped id が corpus に解決される (noCorpus=0 — grounding 完全性)
//   2. production 0 件で mismatch=0
//   3. production 0 件で match は vanilla (印字テキスト全列空) のみ — text-bearing refuse 率 100%
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { ALL_CARDS } from '../../src/cards/index.js';
const { loadCorpus } = require('../../scripts/compiler/tsv-corpus.cjs');
const { canonicalCard } = require('../../scripts/compiler/canonical.cjs');
const { runOracle } = require('../../scripts/compiler/oracle.cjs');

const ROOT = path.resolve(__dirname, '../..');

describe('compiler/oracle (real data, production 0 件)', () => {
  const corpus = loadCorpus(ROOT);
  const shipped = ALL_CARDS.map((d) => canonicalCard(d));
  const report = runOracle(corpus, shipped, []);
  const byId = new Map(corpus.map((c: { id: string }) => [c.id, c]));

  it('全 shipped が corpus で判定される (noCorpus=0)', () => {
    expect(report.buckets.noCorpus).toEqual([]);
    expect(report.totals.judged).toBe(shipped.length);
  });

  it('silent mismatch 0 (G1 の恒常成立形)', () => {
    expect(report.buckets.mismatch).toEqual([]);
  });

  it('match は vanilla のみ = text-bearing カードの refuse 率 100%', () => {
    const baseId = (id: string) => id.replace(/P\d*$/, '');
    for (const id of report.buckets.match as string[]) {
      const entry = (byId.get(id) || byId.get(baseId(id))) as { texts: Record<string, string> };
      const joined = Object.values(entry.texts).join('');
      expect(joined, `match ${id} は vanilla のはず`).toBe('');
    }
  });

  it('実装済/残の実測を報告する (情報 assert: 2026-07-02 時点 shipped 1509 / unshipped 540)', () => {
    expect(report.totals.shipped).toBeGreaterThanOrEqual(1509);
    expect(report.totals.shipped + report.totals.unshipped).toBeGreaterThanOrEqual(2049);
  });
});
