// cards/ct-p05/B05066 赤井秀一＆沖矢昴 (キャラ MR) — engine#2 charModifyLevel batch #2 (a2 only)
// rules: 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー赤】【自分ターン中】【ターン1】相手の現場にいるキャラがリムーブされたとき、
//     レベル8以下のキャラを1枚まで選び、リムーブする。
//   【宣言】【ターン1】相手の現場にいるキャラを1枚まで選び、ターン終了時までレベル－1する。
//     この能力はパートナーエリアでも宣言できる。
//
// a1: DEFERRED (triggered hook = 相手キャラリムーブ反応、leave:to-remove + matcher で実装可能だが
//     本バッチは declared a2 に集中)
// a2: declared + turn1 limit + 相手 1pick で turn-level-1 (B07103 a2 同型)
//     ※「パートナーエリアでも宣言できる」は partial-impl (scope:on-scene のみ、partner-area での
//     宣言は MR area 拡張要)
// MR能力 (rules/18): 相手ターン中の現場離脱で partner-area へ — engine 側で対応済 (auto)

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  description: '【宣言】【ターン1】相手の現場のキャラを1枚までレベル-1 (ターン終了時まで)。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B05066: CardDef = {
  id: 'B05066',
  no: '0566/B05066',
  kind: 'character',
  names: ['赤井秀一＆沖矢昴', '赤井秀一', '沖矢昴'], // rules/19 複数名カード
  colors: ['赤'],
  level: 9, ap: 8000, lp: 2,
  traits: ['FBI', '赤井家', '大学院生'], keywords: [],
  rarity: 'MR',
  imageUrl: '1742972384125446.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/19-special-rules.md'],
};
