// cards/ct-p06/B06076 ジェイムズ・ブラック (キャラ) — bounce batch #2 + declared backfill
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【解決編】【登場時】相手の現場にいるレベル5以下のキャラを1枚まで選び、手札に移す。
//   【宣言】【スリープ】：相手は手札を1枚リムーブする。
//     この能力は相手の手札が4枚以上ある場合に宣言できる。
//
// a1: 【解決編】 enter + 相手 levelMax:5 1枚 sceneToHand
// a3: 【宣言】【スリープ】。相手手札4枚以上を handAtLeast で使用条件にする。
//     出荷済み a1/a2 の physical ability index を維持するため末尾へ追加する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: {
    kind: 'atom',
    verb: 'sceneToHand',
    args: { player: 'self', max: 1, side: 'opp', filter: { levelMax: 5 } },
  },
  description: '【解決編】【登場時】相手 level≤5 を1枚 bounce。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  condition: { kind: 'handAtLeast', player: 'opp', n: 4 },
  cost: { kind: 'sleepSelf' },
  effect: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
  description: '【宣言】【スリープ】：相手は手札を1枚リムーブする。この能力は相手の手札が4枚以上ある場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

export const B06076: CardDef = {
  id: 'B06076',
  no: '0696/B06076',
  kind: 'character',
  names: ['ジェイムズ・ブラック'],
  colors: ['赤'],
  level: 6, ap: 5000, lp: 1,
  traits: ['FBI'], keywords: [],
  rarity: 'R',
  imageUrl: '1754285244546149.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};
