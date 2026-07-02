// Track B compiler — norm (共有正規化) の単体テスト。
// compile (変換時) と mine (採掘時) が同一関数で key を作る前提の回帰ガード。
import { describe, it, expect } from 'vitest';
const { splitLines, stripReminders, lineKey, colKey, alignNorm } = require('../../scripts/compiler/norm.cjs');

describe('compiler/norm', () => {
  it('splitLines: literal \\n (0x5c 0x6e) と <br> を行区切りとして扱う', () => {
    expect(splitLines('A。\\nB。')).toEqual(['A。', 'B。']);
    expect(splitLines('A。<br>B。')).toEqual(['A。', 'B。']);
    expect(splitLines('  A。  ')).toEqual(['A。']);
    expect(splitLines('')).toEqual([]);
  });

  it('stripReminders: 全角/半角の括弧注記を除去する', () => {
    expect(stripReminders('〚突撃〛（登場したターンからすぐにアクションできる）')).toBe('〚突撃〛');
    expect(stripReminders('リムーブする。(上から順に行う)')).toBe('リムーブする。');
  });

  it('lineKey: 注釈の有無で同一 key になる (B04068 と B04068P の実測差)', () => {
    expect(lineKey('〚突撃〛（登場したターンからすぐにアクションできる）')).toBe(lineKey('〚突撃〛'));
  });

  it('lineKey: 括弧以外は正規化しない (数値・全角記号は key の識別子)', () => {
    expect(lineKey('AP＋2000')).not.toBe(lineKey('AP＋1000'));
  });

  it('alignNorm: description の文末「。」揺れと空白・列区切りを吸収する', () => {
    expect(alignNorm('【パートナー赤】【自分ターン中】AP＋1000。')).toBe(alignNorm('【パートナー赤】【自分ターン中】AP＋1000'));
    expect(alignNorm('A。\\nB')).toBe(alignNorm('A。B'));
  });

  it('colKey: 列の全行を行 key 正規化して連結する (COLSPAN namespace)', () => {
    expect(colKey('【カットイン】AP＋1000（注釈）\\n【相手ターン中】AP＋3000')).toBe('【カットイン】AP＋1000\n【相手ターン中】AP＋3000');
  });
});
