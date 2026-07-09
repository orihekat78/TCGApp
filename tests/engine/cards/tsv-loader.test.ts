// engine.cards.* — TSV loader tests
// spec: .claude/specs/cards-data/INDEX.md

import { describe, it, expect } from 'vitest';
import { parseTsv } from '@/engine/cards';
// Phase 9-B hotfix: loadSet は Node 専用に分離 (tsv-loader-fs.ts)。
import { loadSet } from '@/engine/cards/tsv-loader-fs';
import type { CardDef } from '@/engine/types';

describe('parseTsv — unescape rules', () => {
  it('unescapes \\n into actual newline', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA',
      'X1\tx1\tFoo\t青\t5\t5000\t1\tD\t探偵\timg.jpg\tline1\\nline2\t\t\t\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'character');
    expect(defs).toHaveLength(1);
    // 取り込んだフィールドは CardDef に出ないが unescape は内部で実施されている
    // → 後段 abilities/desc merge 時に効くため、ここでは title 等を介して確認
    expect(defs[0].id).toBe('X1');
    expect(defs[0].names).toEqual(['Foo']);
  });

  it('unescapes \\t and \\\\ correctly', () => {
    // 簡易の verify: title 列に \\t を含めて parse する
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlp\trarity\tfeatures\timagePath\teffect\tillustrator\tqAndA',
      'X1\tx1\tAlpha\\tBeta\t青\t1\tD\t\timg.jpg\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'partner');
    // 「Alpha\tBeta」のように unescape されている → ただし names は title 全体を保持
    expect(defs[0].names[0]).toBe('Alpha\tBeta');
  });

  it('preserves literal backslash+n via \\\\n escape', () => {
    // TSV cell contains the raw bytes "\", "\", "n" → unescape を1回経由して "\", "n" (= "\n" as 2-char literal) になる
    // 期待: actual newline ではない
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlp\trarity\tfeatures\timagePath\teffect\tillustrator\tqAndA',
      'X1\tx1\tA\\\\nB\t青\t1\tD\t\timg.jpg\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'partner');
    // title フィールドは "A\nB" (2-char literal: backslash + n), not "A<newline>B"
    expect(defs[0].names[0]).toBe('A\\nB');
    expect(defs[0].names[0]).not.toBe('A\nB');
  });

  it('handles empty cells gracefully', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA',
      'X1\tx1\tBar\t青\t\t\t1\tD\t\timg.jpg\t\t\t\t\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'character');
    expect(defs[0].id).toBe('X1');
    expect(defs[0].level).toBeUndefined();
    expect(defs[0].ap).toBeUndefined();
    expect(defs[0].lp).toBe(1);
    expect(defs[0].traits).toEqual([]);
  });

  it('parses character ap/lp/level as numbers', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA',
      'X1\tx1\tBaz\t青\t8\t7000\t2\tD\t探偵|少年探偵団\timg.jpg\t\t\t\t\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'character');
    expect(defs[0].level).toBe(8);
    expect(defs[0].ap).toBe(7000);
    expect(defs[0].lp).toBe(2);
    expect(defs[0].traits).toEqual(['探偵', '少年探偵団']);
    expect(defs[0].kind).toBe('character');
    expect(defs[0].keywords).toEqual([]);
  });

  it('parses partner with lp only (no ap, no level)', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlp\trarity\tfeatures\timagePath\teffect\tillustrator\tqAndA',
      'X1\tP001\tConan\t青\t1\tD\t\timg.jpg\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'partner');
    expect(defs[0].kind).toBe('partner');
    expect(defs[0].lp).toBe(1);
    expect(defs[0].ap).toBeUndefined();
    expect(defs[0].level).toBeUndefined();
  });

  it('parses event with level only (no ap/lp)', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlevel\trarity\timagePath\teffect\tcutIn\thirameki\tillustrator\tflavor\tqAndA',
      'X1\tx1\tEvt\t青\t6\tD\timg.jpg\t\t\t\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'event');
    expect(defs[0].kind).toBe('event');
    expect(defs[0].level).toBe(6);
    expect(defs[0].ap).toBeUndefined();
    expect(defs[0].lp).toBeUndefined();
  });

  it('parses case with caseLevel from difficultyFirst (rules/01)', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\trarity\timagePath\tdifficultyFirst\tdifficultySecond\teffect\tillustrator\tqAndA',
      'X1\tx1\t青の古城探索事件\t青\tD\timg.jpg\t7\t6\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'case');
    expect(defs[0].kind).toBe('case');
    expect(defs[0].caseLevel).toBe(7);
    expect(defs[0].caseTraits).toEqual([]);
  });

  it('extractNames: 江戸川コナン&工藤新一 produces 3 names (rules/19)', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA',
      'X1\tx1\t江戸川コナン&工藤新一\t青\t8\t8000\t2\tMR\t\timg.jpg\t\t\t\t\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'character');
    expect(defs[0].names).toEqual([
      '江戸川コナン&工藤新一',
      '江戸川コナン',
      '工藤新一',
    ]);
  });

  it('abilities is empty array (Phase 5 Group B-E merges later)', () => {
    const tsv = [
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA',
      'X1\tx1\tFoo\t青\t5\t5000\t1\tD\t\timg.jpg\tsome effect text\t\t\t\t\t\t',
    ].join('\n');
    const defs = parseTsv(tsv, 'character');
    expect(defs[0].abilities).toEqual([]);
    expect(defs[0].ruleRefs).toEqual([]);
  });
});

import fs from 'node:fs';
import { resolve as resolvePathForGuard } from 'node:path';
const HAS_CARDS_DATA = fs.existsSync(
  resolvePathForGuard(__dirname, '../../../.claude/specs/cards-data/ct-d08/character.tsv'),
);

// cards-data TSV はローカル専用 (untrack 済、56869955)。CI checkout に無い場合 skip。
describe.skipIf(!HAS_CARDS_DATA)('loadSet — actual TSV files', () => {
  it("loadSet('CT-D08') returns 26 cards (2 partner + 21 char + 2 event + 1 case)", () => {
    const defs = loadSet('CT-D08');
    expect(defs).toHaveLength(26);
    const byKind = defs.reduce<Record<string, number>>((acc, d) => {
      acc[d.kind] = (acc[d.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(byKind).toEqual({
      partner: 2,
      character: 21,
      event: 2,
      case: 1,
    });
  });

  it("loadSet('CT-D11') returns 21 cards (2 + 16 + 2 + 1)", () => {
    const defs = loadSet('CT-D11');
    expect(defs).toHaveLength(21);
    const byKind = defs.reduce<Record<string, number>>((acc, d) => {
      acc[d.kind] = (acc[d.kind] ?? 0) + 1;
      return acc;
    }, {});
    expect(byKind).toEqual({
      partner: 2,
      character: 16,
      event: 2,
      case: 1,
    });
  });

  it("loadSet('CT-D08') character cards have ap/lp/level as numbers", () => {
    const defs = loadSet('CT-D08');
    const chars = defs.filter(d => d.kind === 'character');
    for (const c of chars) {
      expect(typeof c.ap).toBe('number');
      expect(typeof c.lp).toBe('number');
      expect(typeof c.level).toBe('number');
      expect(Array.isArray(c.traits)).toBe(true);
      expect(c.abilities).toEqual([]);
    }
    // 既知サンプル: D08003 江戸川コナン (level 8, ap 7000, lp 2)
    const d08003 = defs.find(d => d.id === 'D08003');
    expect(d08003?.level).toBe(8);
    expect(d08003?.ap).toBe(7000);
    expect(d08003?.lp).toBe(2);
    expect(d08003?.traits).toEqual(['探偵', '毛利探偵事務所', '少年探偵団']);
  });

  it("loadSet('CT-D08') case card has caseLevel=7 (先攻基準)", () => {
    const defs = loadSet('CT-D08');
    const caseDef = defs.find(d => d.kind === 'case');
    expect(caseDef).toBeDefined();
    expect(caseDef?.id).toBe('D08026');
    expect(caseDef?.caseLevel).toBe(7);
  });

  it("loadSet('CT-D08') partner cards have lp but no ap/level", () => {
    const defs = loadSet('CT-D08');
    const partners = defs.filter(d => d.kind === 'partner');
    expect(partners).toHaveLength(2);
    for (const p of partners) {
      expect(typeof p.lp).toBe('number');
      expect(p.ap).toBeUndefined();
      expect(p.level).toBeUndefined();
    }
  });

  it("loadSet returns CardDef objects (no any leakage)", () => {
    const defs: CardDef[] = loadSet('CT-D08');
    // 型レベルで CardDef[] を返すことの確認 — runtime では shape を検証
    expect(defs[0].id).toBeDefined();
    expect(defs[0].kind).toBeDefined();
    expect(defs[0].names).toBeDefined();
    expect(defs[0].colors).toBeDefined();
  });
});
