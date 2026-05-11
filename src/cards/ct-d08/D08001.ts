// cards/ct-d08/D08001 江戸川コナン (パートナー)
// rules: 01-victory-conditions.md, 04-game-setup.md, 13-keywords.md
// spec: .claude/specs/cards-analysis/D08001.md
//
// 全パートナー共通能力 (アシスト / 事件解決) は engine 内蔵 (flow.canSolveCase / cost.assist)。
// abilities[] は空配列。
//
// 公式テキスト (Ver 2.4):
//   【解決編】【事件解決】【スリープ】：自分の証拠が事件レベルの数以上ある場合、ゲームに勝利する。
//   【アシスト】【スリープ】：FILEエリアに移動する。自分のFILEエリアにカードが7枚以上ある場合、事件を解決編にする。

import type { CardDef } from '@/engine/types';

export const D08001: CardDef = {
  id: 'D08001',
  no: 'P001/D08001',
  kind: 'partner',
  names: ['江戸川コナン'],
  colors: ['青'],
  lp: 1,
  traits: [],
  rarity: 'D',
  imageUrl: '1743743093420786.jpg',
  abilities: [],
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/13-keywords.md'],
};
