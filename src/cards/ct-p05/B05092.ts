// cards/ct-p05/B05092 諸伏景光 (character) — Task A green候補 (engine変更0)
// rules: rules/02-deck-construction.md, rules/07-action-flow.md, rules/11-reasoning.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【登場時】手札からカードを4枚まで好きな順番でデッキの下に移し、デッキをシャッフルする。移した枚数と同じ数のカードを引く。\n【ターン1】自分の現場にいる〚特徴［警察］〛のキャラがアクションしたとき、AP7000以下のキャラを1枚まで選び、デッキの上に移す。

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'handToDeckBottom',
        // 「4枚まで好きな順番で」= multi-pick cardIds contract (short-form は 1 枚 collapse + 継続 ctx へ
        // bind 不達で後続 draw が 0 になる、miniwave3 probe 実測。B08028 evidenceFlip 同型)
        args: {
          player: 'self',
          cardIds: '$pick.cardIds',
          bind: '$moved',
          shuffleThenDrawMoved: true,
          // 0枚選択でも atom を空解決し、必須の deck shuffle を実行する。
          skipResolvesAtom: true,
          target: {
            kind: 'pick',
            query: { area: 'hand', side: 'self' },
            n: { min: 0, max: 4 },
            chooser: 'self'
          }
        }
      }
    ]
  },
  description: '【登場時】手札からカードを4枚まで好きな順番でデッキの下に移し、デッキをシャッフルする。移した枚数と同じ数のカードを引く。',
  ruleRefs: [
    'rules/02-deck-construction.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare'
  },
  condition: {
    kind: 'triggerCharMatches',
    side: 'self',
    filter: {
      trait: '警察'
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneToDeck',
    args: {
      player: 'self',
      side: 'either',
      max: 1,
      pos: 'top',
      filter: {
        apMax: 7000
      }
    }
  },
  description: '【ターン1】自分の現場にいる〚特徴［警察］〛のキャラがアクションしたとき、AP7000以下のキャラを1枚まで選び、デッキの上に移す。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B05092: CardDef = {
  id: 'B05092',
  no: '0590/B05092',
  kind: 'character',
  names: [
    '諸伏景光'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '警察',
    '警視庁',
    '公安'
  ],
  rarity: 'R',
  imageUrl: '1745322226187978.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/02-deck-construction.md',
    'rules/07-action-flow.md',
    'rules/11-reasoning.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ],
};
