import { describe, it, expect } from 'vitest';
const { extractLiterals, crosscheck } = require('../../scripts/card-text-crosscheck.cjs');
// text は印字特徴 特徴[黒ずくめの組織] を含むが、B08079 a3 の DSL は AP で除去し trait filter を持たない。
const text = '【黒】以外の色を持つ場合、AP8000以下のキャラを1枚までリムーブ。特徴[黒ずくめの組織]';
const ok = [{ type: 'declared', description: 'd', condition: { kind: 'caseColorNot', color: '黒' },
  cost: { kind: 'sleepSelf' }, effect: { kind: 'atom', verb: 'sceneRemove', filter: { apMax: 8000 }, max: 1 } }];

describe('crosscheck', () => {
  it('色・数値・枚数・特徴 を抽出', () => {
    expect(extractLiterals(text)).toEqual(expect.arrayContaining(['黒', '8000', '1', '黒ずくめの組織']));
  });
  it('印字 literal が全部 DSL に在れば ok', () => {
    // DSL に存在する literal のみを含む text (印字特徴は DSL filter ではないので除外)
    const textInDsl = '【黒】以外の色を持つ場合、AP8000以下のキャラを1枚までリムーブ';
    expect(crosscheck(ok, [textInDsl]).ok).toBe(true);
  });
  it('色を誤写 (黒→白) すると FAIL', () => {
    const bad = JSON.parse(JSON.stringify(ok)); bad[0].condition.color = '白';
    const r = crosscheck(bad, [text]);
    expect(r.ok).toBe(false); expect(r.missing).toContain('黒');
  });
  it('印字 literal が DSL に無い場合は fail-closed で FAIL (T2 escalate)', () => {
    // text の 特徴[黒ずくめの組織] は ok DSL に無い → 印字値が DSL に無い誤写は確実に FAIL する設計
    const r = crosscheck(ok, [text]);
    expect(r.ok).toBe(false); expect(r.missing).toContain('黒ずくめの組織');
  });
});
