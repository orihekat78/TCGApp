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
//     ※「パートナーエリアでも宣言できる」= scope:'on-partner-area'
//     (現場とPA常駐MRの両方で使用可)
// MR能力①② (rules/18): engine/mr-partner-area-core (2026-06-23) で配線済 (isMR=rarity 消費 + partnerAreaMR slot)。
// 本カードを含むデッキではMR①(相手ターン離脱→PA)/②(MR重複リムーブ)が実発火し、
// card固有のPA宣言scopeもM3 PA batchで配線済み。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    matcherCondition: {
      kind: 'removedCharMatches',
      side: 'opp',
    },
  },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'turn', player: 'self' },
    ],
  },
  limit: {
    kind: 'turn',
    n: 1,
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        kind: 'character',
        levelMax: 8,
      },
    },
  },
  description: '相手の現場にいるキャラがリムーブされたとき、自分のターン中、レベル8以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area', // M3 PA batch (2026-07-10): 「この能力はパートナーエリアでも宣言できる」(rules/18)
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'atom',
    verb: 'charModifyLevel',
    args: { player: 'self', max: 1, side: 'opp', delta: -1, scope: 'turn' },
  },
  description: '【宣言】【ターン1】相手の現場のキャラを1枚までレベル-1 (ターン終了時まで)。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

// a3: 【カットイン】AP＋2000 (BUG-140 補修 2026-06-13: TSV cutIn 列の取りこぼし修正) — D08015 a2 同型
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
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
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/18-mr.md', 'rules/19-special-rules.md'],
};
