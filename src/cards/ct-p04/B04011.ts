// cards/ct-p04/B04011 毛利小五郎 (キャラ) — Task D batch (2026-06-12)
// rules: 11-reasoning.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 21-declared-ability-cost.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚現場にいるカード名［江戸川コナン］を1枚デッキの下に移す〛：
//     ターン終了時までこのキャラをLP＋2する。
//
// 句マッピング:
//   - 【宣言】 => type:'declared' (rules/21: スリープコスト無し → スリープ/名乗り状態でも宣言可)
//   - 【ターン1】 => limit {kind:'turn', n:1}
//   - 〚現場にいるカード名［江戸川コナン］を1枚デッキの下に移す〛 => cost sceneToDeckBottom (Task D E2-b)。
//     rules/21「自分の」省略 + 公式Q&A「相手のキャラは移せない」 → query side:'self'。
//     rules/19 分割名: filter.cardName は allCardNameComponentsForDef 照合 = 《江戸川コナン&工藤新一》等も該当。
//     デッキ下移動はリムーブでない (rules/23 流儀、scene.toDeck 経由で leave:to-remove 不発火)
//   - ターン終了時までこのキャラをLP＋2する => charModifyLP {uid:'$self', delta:2, scope:'turn'} (D01003 a1 同型)。
//     base LP0 → 2 (rules/11: LP0以下は推理で証拠0枚 → 本能力で推理加点が立つ)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚現場にいるカード名［江戸川コナン］を1枚デッキの下に移す〛 (rules/21「自分の」省略 → side:'self' / rules/19 分割名一致)
  cost: { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { cardName: '江戸川コナン' } }, n: { min: 1, max: 1 }, chooser: 'owner' }, n: 1 },
  // ターン終了時までこのキャラをLP＋2する
  effect: { kind: 'atom', verb: 'charModifyLP', args: { uid: '$self', delta: 2, scope: 'turn' } },
  description: '【宣言】【ターン1】〚現場にいるカード名［江戸川コナン］を1枚デッキの下に移す〛：ターン終了時までこのキャラをLP＋2する。',
  ruleRefs: ['rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

export const B04011: CardDef = {
  id: 'B04011',
  no: '0416/B04011',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['青'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['探偵', '毛利探偵事務所'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287656254437.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
