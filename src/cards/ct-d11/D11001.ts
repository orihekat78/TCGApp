// cards/ct-d11/D11001 萩原千速 (パートナー)
// rules: 01-victory-conditions.md, 04-game-setup.md, 13-keywords.md
// spec: .claude/specs/cards-analysis/D11001.md (全パートナー共通)
//
// 公式テキスト (Ver 2.4):
//   【解決編】【事件解決】【スリープ】：自分の証拠が事件レベルの数以上ある場合、ゲームに勝利する。
//   【アシスト】【スリープ】：FILEエリアに移動する。自分のFILEエリアにカードが7枚以上ある場合、事件を解決編にする。

import type { CardDef } from '@/engine/types';

export const D11001: CardDef = {
  id: 'D11001',
  no: 'P076/D11001',
  kind: 'partner',
  names: ['萩原千速'],
  colors: ['黄'],
  lp: 1,
  traits: [],
  rarity: 'D',
  imageUrl: '1775608962412925.jpg',
  abilities: [],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
