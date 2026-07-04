// Track B compiler — B4 param rule (slot 汎化) 単体テスト。
// 実 data 受入 (G1 mismatch 0) は mined-rules.test.ts が exact+param 合成で回帰済 —
// ここは extractSlots / buildParamRules / instantiate の契約を pin する。
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { extractSlots, buildParamRules, instantiate, stripDesc, deepEqual } = require('../../scripts/compiler/param.cjs');

const ROOT = path.join(__dirname, '..', '..');

describe('compiler/param — extractSlots', () => {
  it('数値/色/カード名/特徴 を occurrence 順に slot 化する', () => {
    const { template, slots } = extractSlots(
      '【青】のレベル6以下の〚カード名［服部平次］〛か〚特徴［警察］〛のキャラを1枚まで選び、AP＋2000する。',
    );
    expect(template).toBe(
      '【{C}】のレベル{N}以下の〚カード名［{NAME}］〛か〚特徴［{TRAIT}］〛のキャラを{N}枚まで選び、AP＋{N}する。',
    );
    expect(slots.map((s: { type: string; value: string }) => [s.type, s.value])).toEqual([
      ['color', '青'],
      ['num', '6'],
      ['name', '服部平次'],
      ['trait', '警察'],
      ['num', '1'],
      ['num', '2000'],
    ]);
  });

  it('カード名/特徴 token 内の数字・色は slot 化しない (token 単位で消費)', () => {
    const { slots } = extractSlots('〚カード名［黒衣の騎士・スペイド］〛を1枚');
    expect(slots.map((s: { type: string }) => s.type)).toEqual(['name', 'num']);
  });

  it('全角数字は半角へ正規化', () => {
    const { slots } = extractSlots('ＡＰ＋２０００');
    expect(slots).toEqual([{ type: 'num', value: '2000' }]);
  });

  it('【ターン1】等の icon 内数字も slot (limit.n と共変)', () => {
    const { template } = extractSlots('【ターン1】カードを2枚引く。');
    expect(template).toBe('【ターン{N}】カードを{N}枚引く。');
  });
});

describe('compiler/param — buildParamRules + instantiate (合成)', () => {
  const mkRule = (key: string, ability: unknown) => ({ key, ability, exemplars: ['X'], origins: ['desc'], count: 1 });

  it('2 exemplar の共変 path で汎化し、新しい slot 値の組を instantiate できる', () => {
    const rules = [
      mkRule('character|effect|レベル6以下のキャラを1枚まで選び、AP＋2000する。', {
        effect: { kind: 'atom', verb: 'charModifyAP', args: { max: 1, filter: { levelMax: 6 }, delta: 2000 } },
        type: 'declared',
      }),
      mkRule('character|effect|レベル4以下のキャラを1枚まで選び、AP＋3000する。', {
        effect: { kind: 'atom', verb: 'charModifyAP', args: { max: 1, filter: { levelMax: 4 }, delta: 3000 } },
        type: 'declared',
      }),
    ];
    const { rules: prs } = buildParamRules(rules);
    expect(prs).toHaveLength(1);
    const pr = prs[0];
    // 「1枚まで」の 1 は両 member で同値 + max:1 に共変 path あり → 汎化对象 (path = args.max)
    expect(pr.slotTypes).toEqual(['num', 'num', 'num']);
    const line = 'レベル7以下のキャラを1枚まで選び、AP＋5000する。';
    const { slots } = extractSlots(line);
    const inst = instantiate(pr, slots, line);
    expect(inst.effect.args.filter.levelMax).toBe(7);
    expect(inst.effect.args.delta).toBe(5000);
    expect(inst.effect.args.max).toBe(1);
    expect(inst.description).toBe(line);
  });

  it('slot 値が leaf に見つからず member 間で異値 → group 放棄 (refuse-first)', () => {
    const rules = [
      mkRule('character|effect|カードを3枚引く。', { effect: { kind: 'atom', verb: 'draw', args: { n: 1 } } }),
      mkRule('character|effect|カードを5枚引く。', { effect: { kind: 'atom', verb: 'draw', args: { n: 2 } } }),
    ];
    const { rules: prs, rejected } = buildParamRules(rules);
    expect(prs).toHaveLength(0);
    expect(rejected).toHaveLength(1);
  });

  it('skeleton 構造不一致 → group 放棄', () => {
    const rules = [
      mkRule('character|effect|カードを1枚引く。', { effect: { kind: 'atom', verb: 'draw', args: { n: 1 } } }),
      mkRule('character|effect|カードを2枚引く。', {
        effect: { kind: 'atom', verb: 'discard', args: { n: 2 } },
      }),
    ];
    const { rules: prs } = buildParamRules(rules);
    expect(prs).toHaveLength(0);
  });
});

describe('compiler/param — checked-in param-rules.json 整合', () => {
  const file = path.join(ROOT, 'scripts', 'compiler', 'rules', 'param-rules.json');
  it('存在し、全 rule が exemplar と slot/path 整合を持つ', () => {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(data.ruleCount).toBe(data.rules.length);
    for (const r of data.rules) {
      expect(r.exemplars.length, r.groupKey).toBeGreaterThan(0);
      expect(r.paths.length, r.groupKey).toBe(r.slotTypes.length);
      expect(JSON.stringify(r.skeleton), r.groupKey).not.toContain('<closure>');
    }
  });

  it('deepEqual/stripDesc ヘルパ契約', () => {
    expect(deepEqual({ a: 1, b: [2] }, { b: [2], a: 1 })).toBe(true);
    expect(stripDesc({ description: 'x', type: 'declared' })).toEqual({ type: 'declared' });
  });
});
