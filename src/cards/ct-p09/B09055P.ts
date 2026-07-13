// cards/ct-p09/B09055 世良真純 (character) — Cluster WB1 exemplar (sceneEnter partner-area∪remove union source)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。
//   【パートナー赤】【FILE8】【宣言】【スリープ】〚手札からカード名［赤井秀一］を1枚リムーブする〛：このキャラをリムーブし、自分のパートナーエリアかリムーブエリアにある〚カード名［赤井秀一&世良真純］〛を1枚まで選び、登場させる。
// 句マッピング:
//   - a1【登場時】lv7以下1枚まで選びリムーブ => triggered enter selfOnly → sceneRemove 短縮形
//     {player:'self', max:1, side:'either', filter:{levelMax:7}} (B09005 同型)。
//   - a2 gate【パートナー赤】【FILE8】=> condition and[partnerColor 赤, fileAtLeast 8] (D09008 同型)。
//   - a2 コスト【スリープ】〚手札[赤井秀一]1枚リムーブ〛=> pay[sleepSelf, removeFromHand pick{cardName 赤井秀一}]。
//   - a2 効果「このキャラをリムーブし、PAかリムーブの[赤井秀一&世良真純]1枚まで登場」=>
//     sequence[ sceneRemove{uid:'$self', cause:'effect'},
//               sceneEnter{cardId:'$pick.cardId', target:{query:{area:['partner-area','remove'], side:'self',
//                          filter:{cardName:'赤井秀一&世良真純'}}, n:{min:0,max:1}, chooser:'self'}} ]。
//     ★ area:['partner-area','remove'] = union pick。Cluster WB1 で sceneEnter の union/partner-area
//     splice を解禁 (candidates.ts の area 配列 union + partnerAreaCards 列挙は既存)。MR 重複登場処理は
//     engine (applyMrEntryRemoval) 委譲 (rules/18)。「まで」= 0枚可 (rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      filter: { levelMax: 7 }
    }
  },
  description: '【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'fileAtLeast', n: 8 }
    ]
  },
  cost: {
    kind: 'pay',
    items: [
      { kind: 'sleepSelf' },
      {
        kind: 'removeFromHand',
        target: {
          kind: 'pick',
          query: { area: 'hand', side: 'self', filter: { cardName: '赤井秀一' } },
          n: { min: 1, max: 1 },
          chooser: 'self'
        },
        n: 1
      }
    ]
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          viaEffect: true,
          target: {
            kind: 'pick',
            query: {
              area: ['partner-area', 'remove'],
              side: 'self',
              filter: { cardName: '赤井秀一&世良真純' }
            },
            n: { min: 0, max: 1 },
            chooser: 'self'
          }
        }
      }
    ]
  },
  description: '【パートナー赤】【FILE8】【宣言】【スリープ】〚手札からカード名［赤井秀一］を1枚リムーブする〛：このキャラをリムーブし、自分のパートナーエリアかリムーブエリアにある〚カード名［赤井秀一&世良真純］〛を1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B09055P: CardDef = {
  id: 'B09055P',
  no: '0997/B09055P',
  kind: 'character',
  names: [
    '世良真純'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '探偵',
    '高校生',
    '赤井家'
  ],
  rarity: 'SRP',
  imageUrl: '1775608872745234.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
