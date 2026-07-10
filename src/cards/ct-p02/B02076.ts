// cards/ct-p02/B02076 大和敢助 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/10-action-event.md
// 公式テキスト:
//   【登場時】自分のリムーブエリアにある〚特徴［長野県警］〛のキャラを1枚選び、デッキの下に移してもよい。そうした場合、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【登場時】自分のリムーブエリアにある〚特徴［長野県警］〛のキャラを1枚選び、デッキの下に移してもよい。そうした場合、カードを1枚引く => chain[removeAreaToDeckTop{dest bottom, max1, filter{trait 長野県警, kind character}}, draw1] [してもよい = max1 の 0-pick decline (PR006 a1 idiom)。そうした場合 = chain (0枚→chainStepNoApply → draw 不発、本 wave で atom に gate 追加)。dest bottom = 本 wave 新 param (旧 top 固定は B07014)]
//   - 【ヒラメキ】キャラを1枚まで選び、スリープさせる => sceneSetState $pick sleep, pick{scene, either, kind character, 0-1} [無修飾「キャラ」= side either (rules/15)。B04080 a1 の state 差替 (active→sleep)]

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
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'removeAreaToDeckTop',
        args: {
          player: 'self',
          dest: 'bottom',
          max: 1,
          filter: {
            trait: [
              '長野県警'
            ],
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【登場時】自分のリムーブエリアにある〚特徴［長野県警］〛のキャラを1枚選び、デッキの下に移してもよい。そうした場合、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md'
  ]
};

export const B02076: CardDef = {
  id: 'B02076',
  no: '0237/B02076',
  kind: 'character',
  names: [
    '大和敢助'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'R',
  imageUrl: '1721357284517434.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/10-action-event.md'
  ],
};
