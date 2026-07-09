// Track B compiler — corpus 抽出の実 data 整合テスト (.claude/specs/cards-data 直読、.tmp 非依存)。
import { describe, it, expect } from 'vitest';
import path from 'node:path';
const { loadCorpus, dupIds, TEXT_COLS } = require('../../scripts/compiler/tsv-corpus.cjs');

const ROOT = path.resolve(__dirname, '../..');

// cards-data TSV はローカル専用 (2026-07-10 公開リポジトリ化で untrack、56869955)。CI checkout に無い場合 skip。
const corpusAll = loadCorpus(ROOT);

describe.skipIf(corpusAll.length === 0)('compiler/corpus (real TSV)', () => {
  const corpus = corpusAll;
  const byId = new Map(corpus.map((c: { id: string }) => [c.id, c]));

  it('universe 全 printings を取り込む (2026-07-02 実測 2049)', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(2049);
  });

  it('cardNum は corpus 内で一意', () => {
    expect(dupIds(corpus)).toEqual([]);
  });

  it('4 kinds すべて存在する', () => {
    const kinds = new Set(corpus.map((c: { kind: string }) => c.kind));
    expect([...kinds].sort()).toEqual(['case', 'character', 'event', 'partner']);
  });

  it('col10 effect を取り込む (B08004 江戸川コナン)', () => {
    const c = byId.get('B08004') as { texts: Record<string, string> };
    expect(c).toBeDefined();
    expect(c.texts.effect.length).toBeGreaterThan(0);
  });

  it('col12 hirameki を取り込む (D08024 — ヒラメキ漏れ前科 B01075/B01089 の回帰ガード)', () => {
    const c = byId.get('D08024') as { texts: Record<string, string> };
    expect(c.texts.hirameki).toContain('ヒラメキ');
  });

  it('texts は全カードで 4 列とも定義される (空文字含む)', () => {
    for (const c of corpus as Array<{ id: string; texts: Record<string, string> }>) {
      for (const col of TEXT_COLS) expect(typeof c.texts[col], `${c.id}.${col}`).toBe('string');
    }
  });

  it('case は先攻/後攻の必要証拠数を持つ (D08026 = 7/6)', () => {
    const c = byId.get('D08026') as { caseLevels: { first: string; second: string } };
    expect(c.caseLevels).toEqual({ first: '7', second: '6' });
  });
});
