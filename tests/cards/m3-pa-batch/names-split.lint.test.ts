// BUG-185 enforcement: rules/19 複数名カードの names 分割規約 lint (全登録カード走査)
//
// 《江戸川コナン&工藤新一》型 (「&」「＆」連結カード名) は names に完全名 + 全分割名を持つこと。
// rules: 19-special-rules.md §キャラの名前が複数あるカード名のルール
//
// 注: rules/19 の適用は「&」「『 』」「( )」表記。現状の全出荷カードで該当は ＆/& のみ
// (『』/() 連結の複数名カードが出たら本 lint を拡張する)。

import { describe, it, expect } from 'vitest';
import { registerAll, ALL_CARDS } from '@/cards/index';
import { _resetRegistry } from '@/engine/read/def';

describe('BUG-185 — rules/19 複数名カード names 分割 lint', () => {
  it('names[0] に ＆/& を含む全カードが分割名を持つ', () => {
    _resetRegistry();
    registerAll();
    const bad: string[] = [];
    for (const def of ALL_CARDS) {
      const head = def.names[0] ?? '';
      if (!/[＆&]/.test(head)) continue;
      const parts = head.split(/[＆&]/).filter(Boolean);
      if (parts.length < 2) continue; // 単独 ＆ 装飾 (現状なし)
      for (const p of parts) {
        if (!def.names.includes(p)) bad.push(`${def.id}: names に分割名「${p}」が無い (${head})`);
      }
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});
