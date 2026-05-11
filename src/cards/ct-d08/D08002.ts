// cards/ct-d08/D08002 哀 歩美 光彦 元太 (パートナー)
// rules: 01-victory-conditions.md, 04-game-setup.md, 13-keywords.md
// spec: .claude/specs/cards-analysis/D08001.md (全パートナー共通)
//
// 公式テキスト (Ver 2.4):
//   【解決編】【事件解決】【スリープ】：自分の証拠が事件レベルの数以上ある場合、ゲームに勝利する。
//   【アシスト】【スリープ】：FILEエリアに移動する。自分のFILEエリアにカードが7枚以上ある場合、事件を解決編にする。
//
// rules/19 注: 半角スペース区切りは「分割名カード」ルール対象外。
// 公式 TSV title は 1 つのカード名 ('哀 歩美 光彦 元太') として記録される。

import type { CardDef } from '@/engine/types';

export const D08002: CardDef = {
  id: 'D08002',
  no: 'P041/D08002',
  kind: 'partner',
  names: ['哀 歩美 光彦 元太'],
  colors: ['青'],
  lp: 1,
  traits: [],
  rarity: 'D',
  imageUrl: '1743743093429927.jpg',
  abilities: [],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
